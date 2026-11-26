import { applyI18n, t } from "./i18n";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DRAFT_STATES, ROLES, currentEnemies, currentRole, initDraft, onGameState, setCommandHandler, setDraftActive } from "./draft";
import { EVENTS, bossRows, fmt, nextAt } from "./timers";
import { Item, PHASE_LABEL, SOURCE_LABEL, Source, counterSuggestions, phaseFor, suggestions } from "./items";
import { initMinimap, setMinimapEditing, updateMinimap } from "./minimap";
import { advise, loadBuild } from "./skills";
import { FROM, Live, compare, loadBench } from "./benchmarks";
import { initPost, onGameEnd, postVisible, setMyAccount, setPostInteractive, setPostVisible } from "./post";
import { ACTIONS, ACTION_LABEL, Action, fromEvent, fromMouse, initKeys, keyOf, pretty, setKey } from "./keys";

type Gsi = {
  map?: { clock_time: number; game_time: number; game_state: string; matchid?: string; win_team?: string };
  events?: { event_type: string; game_time: number }[];
  player?: { last_hits: number; denies: number; gpm: number; xpm: number; kills: number; deaths: number; assists: number; team_name?: string; steamid?: string };
  hero?: { id: number; level: number };
  abilities?: Record<string, { name: string; level: number }>;
  items?: Record<string, { name: string }>;
};

const IN_GAME = ["DOTA_GAMERULES_STATE_PRE_GAME", "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS"];
const $ = (id: string) => document.getElementById(id)!;
const hud = $("hud");

let inGame = false;
let inDraft = false;
let editing = false;
let drafting = false;
let posting = false;
let shopOpen = false;

applyI18n();
initDraft();
// Cambiaste el idioma en Configuración: recargar el overlay con el nuevo idioma.
listen("lang-changed", () => location.reload());
initMinimap();
initPost(showHud);

function showHud() {
  // El resumen no tapa una partida en curso salvo que lo abras tú (modo post).
  const showPost = postVisible() && (posting || !(inGame || inDraft));
  $("post").hidden = !showPost;
  const showDraft = !showPost && (inDraft || drafting);
  $("draft").hidden = !showDraft;
  $("game").hidden = showDraft || showPost;
  $("draft").classList.toggle("ingame", inGame); // a media partida no se muestran picks recomendados
  hud.hidden = !(inGame || showDraft || showPost || editing);
  $("minimap").hidden = !(inGame || editing);
  // Panel de items: con la tienda abierta en partida; en modo mover siempre, para acomodarlo.
  $("items-hud").hidden = !((inGame && shopOpen && !showPost) || editing);
}

// --- Paneles movibles (modo mover): posición, tamaño y opacidad de cada uno por separado ---
// Claves "<id>-pos" y "<id>-look": las del asistente siguen siendo "hud-pos"/"hud-look" (no se pierde lo guardado).
const scaleInput = $("scale") as HTMLInputElement;
const opacityInput = $("opacity") as HTMLInputElement;
const panels = [hud, $("items-hud")];
let active = hud; // los sliders afectan al último panel que tocaste

type Look = { scale: string; opacity: string };
const lookOf = (p: HTMLElement): Look => JSON.parse(localStorage.getItem(`${p.id}-look`) ?? '{"scale":"1","opacity":"1"}');
function applyLook(p: HTMLElement, l: Look) {
  // Variables CSS que .panel usa en zoom y opacity (ver styles.css)
  p.style.setProperty("--scale", l.scale);
  p.style.setProperty("--opacity", l.opacity);
}
function place(p: HTMLElement, x: number, y: number) {
  p.style.left = `${Math.min(Math.max(0, x), innerWidth - p.offsetWidth)}px`;
  p.style.top = `${Math.min(Math.max(0, y), innerHeight - p.offsetHeight)}px`;
  p.style.right = "auto";
}
function select(p: HTMLElement) {
  active = p;
  panels.forEach((x) => x.classList.toggle("active-panel", x === p));
  ({ scale: scaleInput.value, opacity: opacityInput.value } = lookOf(p));
}

for (const p of panels) {
  const saved = localStorage.getItem(`${p.id}-pos`);
  if (saved) {
    const { x, y } = JSON.parse(saved);
    Object.assign(p.style, { left: `${x}px`, top: `${y}px`, right: "auto" });
  }
  applyLook(p, lookOf(p));

  p.addEventListener("pointerdown", (e) => {
    if (!editing) return;
    select(p);
    const r = p.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    p.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => place(p, ev.clientX - dx, ev.clientY - dy);
    p.addEventListener("pointermove", move);
    p.addEventListener("pointerup", () => {
      p.removeEventListener("pointermove", move);
      localStorage.setItem(`${p.id}-pos`, JSON.stringify({ x: p.offsetLeft, y: p.offsetTop }));
    }, { once: true });
  });

  // Doble clic en modo mover: ese panel vuelve a su posición, tamaño y opacidad por defecto.
  p.addEventListener("dblclick", () => {
    if (!editing) return;
    localStorage.removeItem(`${p.id}-pos`);
    localStorage.removeItem(`${p.id}-look`);
    p.style.cssText = "";
    applyLook(p, lookOf(p));
    select(p);
  });
}
select(hud);

for (const input of [scaleInput, opacityInput]) {
  input.addEventListener("input", () => {
    const l = { scale: scaleInput.value, opacity: opacityInput.value };
    applyLook(active, l);
    localStorage.setItem(`${active.id}-look`, JSON.stringify(l));
  });
}

// Modos que pone Rust con los atajos globales: "edit" (Ctrl+Shift+M), "draft" (Ctrl+Shift+D) o "none".
listen<string>("mode", ({ payload }) => {
  editing = payload === "edit";
  drafting = payload === "draft";
  const wasPosting = posting;
  posting = payload === "post";
  setPostInteractive(posting);
  if (posting) setPostVisible(true);
  else if (wasPosting) setPostVisible(false);
  document.body.classList.toggle("editing", editing);
  document.body.classList.toggle("drafting", drafting);
  document.body.classList.toggle("posting", payload === "post");
  setDraftActive(drafting);
  setMinimapEditing(editing);
  showHud();
});

// Rust avisa cuando abres/cierras la tienda (tecla de tienda / Esc): los items solo se ven con la tienda abierta.
listen<boolean>("shop", ({ payload }) => {
  shopOpen = payload;
  showHud();
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (editing || drafting || posting)) invoke("exit_mode");
});

// --- Datos del juego ---
// Cada fuente va por su lado: si una falla se sigue mostrando la otra; si las dos funcionan, se muestran ambas.
const SOURCES: Source[] = ["opendota", "stratz"];
const results: Record<Source, { items?: Item[]; error?: string }> = { opendota: {}, stratz: {} };
const retryAt: Record<Source, number> = { opendota: 0, stratz: 0 };
let lastRender = "";

const el = (tag: string, className: string, text = "") =>
  Object.assign(document.createElement(tag), { className, textContent: text });

function renderSugg(label: string) {
  // Una fuente que falla ocupa una sola línea con su error; la otra sigue mostrando íconos.
  const shown = SOURCES.filter((s) => results[s].items?.length || results[s].error);
  const key = label + JSON.stringify(shown.map((s) => results[s]));
  if (key === lastRender) return; // GSI llega cada 0.1 s: no redibujar si nada cambió
  lastRender = key;

  $("sugg").hidden = shown.length === 0;
  $("phase").textContent = label;
  $("sources").replaceChildren(
    ...shown.map((s) => {
      const { items, error } = results[s];
      const grid = el("div", "items");
      grid.replaceChildren(
        ...(items?.length
          ? items.map((i) =>
              Object.assign(document.createElement("img"), {
                src: i.img,
                alt: i.dname,
                title: i.upgrade ? t("Completar: {name}", { name: i.dname }) : i.dname,
                className: i.upgrade ? "upgrade" : "",
              }),
            )
          : [el("span", "items-error", t("{error}. Reintento en 30 s.", { error: t(error ?? "") }))]),
      );
      const row = el("div", "src");
      row.append(el("span", "src-name", SOURCE_LABEL[s]), grid);
      return row;
    }),
  );
}

// --- Roshan y Tormentor: clock_time de su última muerte ---
let roshDeadAt: number | null = null;
let lastHeroId = 0;
let wasActive = false;
let tormDeadAt: number | null = null;
let clock = 0;
const seenEvents = new Set<string>();

// "rosh" / "torm" escritos en Ctrl+Shift+D: murió ahora.
setCommandHandler((c) => {
  if (c === "roshan") roshDeadAt = clock;
  else tormDeadAt = clock;
});

listen<Gsi>("gsi", ({ payload: { map, player, hero, items, events, abilities } }) => {
  inGame = !!map && IN_GAME.includes(map.game_state);
  inDraft = !!map && DRAFT_STATES.includes(map.game_state);
  if (hero && hero.id > 0) lastHeroId = hero.id;
  if (player?.steamid) setMyAccount(player.steamid);
  if (map?.game_state === "DOTA_GAMERULES_STATE_POST_GAME" && map.matchid && lastHeroId > 0) {
    onGameEnd({
      matchId: map.matchid,
      heroId: lastHeroId,
      date: Date.now(),
      kills: player?.kills,
      deaths: player?.deaths,
      assists: player?.assists,
      win: map.win_team && player?.team_name ? map.win_team === player.team_name : null,
    });
  }
  if ((inDraft || inGame) && !wasActive && postVisible()) setPostVisible(false); // partida nueva: fuera el resumen
  wasActive = inDraft || inGame;
  if (map) onGameState(map.game_state);
  if (inDraft) roshDeadAt = tormDeadAt = null; // partida nueva
  showHud();
  if (!inGame || !map) return;

  if (player) {
    $("lhdn").textContent = `${player.last_hits} / ${player.denies}`;
    $("gpm").textContent = String(player.gpm);
    $("xpm").textContent = String(player.xpm);
    $("kda").textContent = `${player.kills}/${player.deaths}/${player.assists}`;
  }

  const t = (clock = map.clock_time);
  updateMinimap(t, player?.team_name);
  // shortcut: el evento "roshan_killed" de GSI no está confirmado para jugadores; si no llega, escribir "rosh".
  for (const ev of events ?? []) {
    const id = `${ev.event_type}@${ev.game_time}`;
    if (seenEvents.has(id)) continue;
    seenEvents.add(id);
    if (ev.event_type === "roshan_killed") roshDeadAt = t - (map.game_time - ev.game_time); // game_time y clock_time avanzan igual
  }

  $("timers").innerHTML = [
    ...bossRows(t, roshDeadAt, tormDeadAt).map(
      (b) => `<li class="${b.cls}"><span>${b.name}</span><time>${b.text}</time></li>`,
    ),
    ...EVENTS.map((e) => {
      const left = nextAt(t, e.start, e.every) - t;
      return `<li class="${left <= 10 ? "soon" : ""}"><span>${e.name}</span><time>${fmt(left)}</time></li>`;
    }),
  ].join("");

  if (hero && hero.id > 0) {
    const owned = new Set(Object.values(items ?? {}).map((i) => i.name));
    renderCounters(hero.id, owned);
    renderSkills(hero.id, hero.level, abilities);
    if (player) renderBench(hero.id, map.clock_time, player);
    const label = PHASE_LABEL[phaseFor(t)];
    for (const s of SOURCES) {
      if (Date.now() < retryAt[s]) continue;
      suggestions(s, hero.id, t, owned)
        .then((list) => {
          results[s] = { items: list };
          renderSugg(label);
        })
        .catch((e) => {
          retryAt[s] = Date.now() + 30_000; // no martillar una API caída cada 0.1 s
          results[s] = { error: e instanceof Error ? e.message : String(e) }; // invoke rechaza con string
          renderSugg(label);
        });
    }
  }
});

// --- Items counter por enemigo (enemigos escritos con Ctrl+Shift+D, en el draft o a media partida) ---
let lastCounters = "";

function renderCounters(heroId: number, owned: Set<string>) {
  const enemies = currentEnemies();
  const role = ROLES.find((r) => r.pos === currentRole())!;
  const key = [heroId, role.pos, enemies.map((e) => e.id), [...owned].sort()].join("|");
  if (key === lastCounters) return; // solo recalcular si cambió algo
  lastCounters = key;
  $("counter-role").textContent = role.label;

  const list = $("counter-list");
  if (!enemies.length) {
    list.replaceChildren(el("li", "items-error", t("{key} para agregar enemigos", { key: pretty(keyOf("draft")) })));
    return;
  }
  counterSuggestions(heroId, owned, enemies)
    .then(({ rows, priority }) => {
      if (key !== lastCounters) return; // llegó tarde: ya hay datos más nuevos
      // Fila de prioridad: items que sirven contra varios enemigos, con su conteo ×N.
      const top = document.createElement("li");
      top.className = "priority";
      top.append(
        el("span", "priority-label", t("Prioridad")),
        ...priority.map((i) => {
          const wrap = el("span", "counted");
          wrap.append(
            Object.assign(document.createElement("img"), { src: i.img, alt: i.dname, title: t("{name} · sirve contra {n} enemigos", { name: i.dname, n: i.count }) }),
            el("b", "", `×${i.count}`),
          );
          return wrap;
        }),
      );
      list.replaceChildren(
        ...(priority.length ? [top] : []),
        ...rows.map(({ enemy, items }) => {
          const li = document.createElement("li");
          li.append(
            Object.assign(document.createElement("img"), { className: "enemy", src: enemy.img, alt: enemy.name, title: enemy.name }),
            el("span", "arrow", "→"),
            ...items.map((i) => Object.assign(document.createElement("img"), { src: i.img, alt: i.dname, title: t("{name} · contra {why}", { name: i.dname, why: i.why }) })),
          );
          return li;
        }),
      );
    })
    .catch((e) => {
      lastCounters = ""; // reintentar en el siguiente tick
      list.replaceChildren(el("li", "items-error", t(e instanceof Error ? e.message : String(e))));
    });
}

// --- Build de habilidades: qué subir ahora (STRATZ por héroe y rol, comparado con tus niveles de GSI) ---
let lastSkills = "";
let skillsRetryAt = 0;

function renderSkills(heroId: number, heroLevel: number, abilities: Gsi["abilities"]) {
  const levels = new Map(Object.values(abilities ?? {}).map((a) => [a.name, a.level]));
  const role = ROLES.find((r) => r.pos === currentRole())!;
  const key = [heroId, role.pos, heroLevel, [...levels].join()].join("|");
  if (key === lastSkills || Date.now() < skillsRetryAt) return; // solo al cambiar algo
  lastSkills = key;
  $("skill-role").textContent = role.label;

  loadBuild(heroId, role.pos)
    .then((build) => {
      if (key !== lastSkills) return;
      const { next, upcoming, talent, pending } = advise(build, levels, heroLevel);
      $("skills").hidden = !next && !talent;
      $("skills").classList.toggle("pending", pending); // tienes puntos sin gastar: resaltar
      const img = $("skill-img") as HTMLImageElement;
      img.hidden = !next;
      if (next) Object.assign(img, { src: next.img, title: next.label });
      $("skill-name").textContent = next ? t(pending ? "Sube: {label}" : "Siguiente: {label}", { label: next.label }) : "";
      $("skill-talent").textContent = talent ? t("Talento: {label}", { label: talent.label }) : "";
      $("skill-next").replaceChildren(
        ...upcoming.map((s) => Object.assign(document.createElement("img"), { src: s.img, alt: s.label, title: s.label })),
      );
    })
    .catch((e) => {
      skillsRetryAt = Date.now() + 30_000;
      lastSkills = "";
      $("skills").hidden = false;
      $("skill-name").textContent = t(e instanceof Error ? e.message : String(e));
      ($("skill-img") as HTMLImageElement).hidden = true;
    });
}

// --- Comparativa en vivo: percentil de tus stats contra el héroe (OpenDota), desde el 10:00 ---
let benchRetryAt = 0;
let lastBenchSec = -1;

function renderBench(heroId: number, clock: number, p: NonNullable<Gsi["player"]>) {
  const sec = Math.floor(clock);
  if (sec === lastBenchSec || Date.now() < benchRetryAt) return; // una vez por segundo basta
  lastBenchSec = sec;
  const ids = ["lh", "gpm", "xpm", "kda"] as const;
  if (clock < FROM) return ids.forEach((k) => ($(`pct-${k}`).textContent = ""));
  const live: Live = { clock, gpm: p.gpm, xpm: p.xpm, lastHits: p.last_hits, kills: p.kills, deaths: p.deaths, assists: p.assists };
  loadBench(heroId)
    .then((b) => {
      const c = compare(b, live);
      for (const k of ids) {
        const el = $(`pct-${k}`);
        el.textContent = Number.isNaN(c[k]) ? "" : `p${c[k]}`;
        el.className = `pct ${c[k] >= 60 ? "good" : c[k] >= 40 ? "mid" : "bad"}`;
        el.title = t("Percentil contra jugadores de este héroe (promedios de final de partida, OpenDota)");
      }
    })
    .catch(() => (benchRetryAt = Date.now() + 30_000));
}

// --- Atajos configurables (barra del modo mover): clic en uno y presiona la tecla nueva ---
let capturing: Action | null = null;
let keyError: { action: Action; msg: string } | null = null;

function renderKeybinds() {
  $("keybinds").replaceChildren(
    ...ACTIONS.map((a) => {
      const row = el("label", "keybind");
      const btn = Object.assign(document.createElement("button"), {
        textContent: capturing === a ? (a === "shop" ? t("Presiona tecla o botón del mouse…") : t("Ctrl/Alt/Shift + tecla, o botón del mouse…")) : pretty(keyOf(a)),
        onclick: () => { capturing = a; keyError = null; renderKeybinds(); },
      });
      btn.classList.toggle("capturing", capturing === a);
      row.append(ACTION_LABEL[a], btn);
      if (keyError?.action === a) row.append(el("span", "key-error", keyError.msg));
      return row;
    }),
  );
  // Textos de ayuda con los atajos actuales
  $("edit-hint").textContent = t("Arrastra los paneles · Clic: elegir panel para tamaño/opacidad · Doble clic: restablecer ese panel · {key}: fijar", { key: pretty(keyOf("edit")) });
  $("draft-hint").textContent = t("{key}: escribir · Enter: agregar · 1-5: rol · rosh / torm: marcar muerte · Retroceso: quitar · Esc: cerrar", { key: pretty(keyOf("draft")) });
}

// Captura en fase de captura para que Esc cancele sin salir del modo mover.
addEventListener("keydown", (e) => {
  if (!capturing) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.key === "Escape") { capturing = null; return renderKeybinds(); }
  const value = fromEvent(capturing, e);
  if (!value) return; // solo un modificador: esperar la tecla
  const action = capturing;
  capturing = null;
  setKey(action, value)
    .catch((err) => (keyError = { action, msg: err instanceof Error ? err.message : String(err) }))
    .finally(renderKeybinds);
}, true);

// Botones del mouse: rueda, Mouse 4 y Mouse 5 (izquierdo/derecho se ignoran para poder hacer clic).
addEventListener("mousedown", (e) => {
  if (!capturing) return;
  const value = fromMouse(e);
  if (!value) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const action = capturing;
  capturing = null;
  setKey(action, value)
    .catch((err) => (keyError = { action, msg: err instanceof Error ? err.message : String(err) }))
    .finally(renderKeybinds);
}, true);

// Mouse 4/5 harían "atrás/adelante" en el webview y recargarían el overlay.
addEventListener("mouseup", (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });

initKeys(renderKeybinds);
