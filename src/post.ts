import { LANG, t } from "./i18n";
// Análisis post-partida, resumen de muertes e historial de las últimas 24 partidas. GSI no manda el daño
// recibido en vivo, así que todo sale de la partida ya analizada por STRATZ (necesita "Exponer datos públicos
// de partidas" en Dota; las partidas de práctica/lobby con bots no llegan a STRATZ). La partida recién
// terminada se reintenta cada minuto hasta que esté lista; las del historial se piden al abrirlas.
import { invoke } from "@tauri-apps/api/core";
import { Bench, loadBench, percentile } from "./benchmarks";
import { Hero, loadHeroes } from "./draft";
import { loadItems } from "./items";
import { keyOf, pretty } from "./keys";
import { fmt } from "./timers";

const HISTORY_KEY = "match-history";
const ACCOUNT_KEY = "my-account";
const MAX_HISTORY = 24;
const RETRY_MS = 60_000;
const MAX_TRIES = 20; // ~20 min: STRATZ suele tardar unos minutos en analizar

type Death = { time: number; attacker: number; byAbility: number | null; byItem: number | null; goldLost: number; timeDead: number; isBurst: boolean };
type Received = {
  receivedTotal: { physicalDamage: number; magicalDamage: number; pureDamage: number; stunDuration: number; disableDuration: number };
  receivedTargets: { target: number; amount: number }[] | null;
  receivedSourceAbility: { abilityId: number; amount: number }[] | null;
};
type Player = {
  steamAccountId: number; heroId: number; isVictory: boolean; kills: number; deaths: number; assists: number; numLastHits: number;
  goldPerMinute: number; experiencePerMinute: number; heroDamage: number; imp: number | null; award: string | null;
  stats: { deathEvents: Death[] | null; heroDamageReport: Received | null } | null;
};
type Match = { duration: number; p: Player };

/** Una partida del historial: lo que se sabe al terminarla (GSI) para reconocerla sin recordar el ID. */
export type Entry = { matchId: string; heroId: number; date: number; kills?: number; deaths?: number; assists?: number; win?: boolean | null; imp?: number | null };

let history: Entry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
let selected = 0;
let content: HTMLElement | null = null; // resumen ya armado de la partida seleccionada
let status = "";
let tries = 0;
let timer: number | undefined;
let visible = false;
let interactive = false; // modo "post" (Ctrl+Shift+P): lista clicable y flechas
let heroes: Hero[] = [];
let onChange = () => {};

const saveHistory = () => localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

// --- Construcción del DOM (textos externos siempre como textContent) ---
const el = (tag: string, cls = "", text = "") => Object.assign(document.createElement(tag), { className: cls, textContent: text });
const img = (src: string, title: string, cls = "") => Object.assign(document.createElement("img"), { src, title, alt: title, className: cls });
const pctClass = (p: number) => (p >= 60 ? "good" : p >= 40 ? "mid" : "bad");
const heroById = (id: number) => heroes.find((h) => h.id === id);

const query = (q: string) => invoke<any>("stratz_query", { query: q });

/** Tu cuenta: GSI da el steamid64; STRATZ usa el id de cuenta de 32 bits. */
export function setMyAccount(steamid64: string) {
  const id = String(BigInt(steamid64) - 76561197960265728n);
  if (localStorage.getItem(ACCOUNT_KEY) !== id) localStorage.setItem(ACCOUNT_KEY, id);
}

async function fetchMatch(e: Entry): Promise<Match> {
  const cacheKey = `match-${e.matchId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as Match;
  const d = await query(`{ match(id: ${e.matchId}) { durationSeconds players { steamAccountId heroId isVictory kills deaths assists numLastHits
    goldPerMinute experiencePerMinute heroDamage imp award stats { deathEvents { time attacker byAbility byItem goldLost timeDead isBurst }
    heroDamageReport { receivedTotal { physicalDamage magicalDamage pureDamage stunDuration disableDuration }
    receivedTargets { target amount } receivedSourceAbility { abilityId amount } } } } } }`);
  const account = Number(localStorage.getItem(ACCOUNT_KEY) ?? 0);
  const players: Player[] = d.match?.players ?? [];
  const p = players.find((x) => account && x.steamAccountId === account) ?? players.find((x) => e.heroId && x.heroId === e.heroId);
  if (!d.match) throw new Error(t("STRATZ todavía no tiene la partida"));
  if (!p) throw new Error(t("no te encontré en esa partida (¿es tuya y con datos públicos?)"));
  if (!p.stats?.heroDamageReport) throw new Error(t("STRATZ todavía no termina de analizarla"));
  const m = { duration: d.match.durationSeconds as number, p };
  localStorage.setItem(cacheKey, JSON.stringify(m)); // ya analizada no cambia: no volver a pedirla
  return m;
}

async function abilityNames(ids: number[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map<number, string>();
  const c = await query(`{ constants { ${uniq.map((id) => `a${id}: ability(id: ${id}) { language { displayName } }`).join(" ")} } }`);
  return new Map(uniq.map((id) => [id, c.constants[`a${id}`]?.language?.displayName ?? `#${id}`]));
}

/** Arma el resumen de una partida analizada y completa su fila del historial (héroe, K/D/A, IMP). */
async function build(e: Entry) {
  const { duration, p } = await fetchMatch(e);
  Object.assign(e, { heroId: p.heroId, kills: p.kills, deaths: p.deaths, assists: p.assists, win: p.isVictory, imp: p.imp });
  saveHistory();

  const deaths = p.stats!.deathEvents ?? [];
  const rep = p.stats!.heroDamageReport!;
  const topAbilities = [...(rep.receivedSourceAbility ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const [, items, names, bench] = await Promise.all([
    heroes.length ? heroes : loadHeroes().then((h) => (heroes = h)),
    loadItems(),
    abilityNames([...deaths.map((d) => d.byAbility ?? 0), ...topAbilities.map((a) => a.abilityId)]),
    loadBench(p.heroId).catch(() => null as Bench | null),
  ]);

  const root = el("div");
  // Encabezado
  const me = heroById(p.heroId);
  const head = el("div", "post-head");
  if (me) head.append(img(me.img, me.name, "post-hero"));
  const title = el("div");
  title.append(
    el("div", p.isVictory ? "win" : "loss", `${p.isVictory ? t("Victoria") : t("Derrota")} · ${fmt(duration)}`),
    el("div", "muted", `${p.kills}/${p.deaths}/${p.assists}` + (p.imp !== null ? ` · IMP ${p.imp}` : "") + (p.award && p.award !== "NONE" ? ` · ${p.award.replace(/_/g, " ").toLowerCase()}` : "")),
  );
  head.append(title);
  root.append(head);

  // Tus stats contra el héroe (percentiles OpenDota)
  if (bench) {
    const min = duration / 60;
    const rows: [string, number, number][] = [
      ["GPM", p.goldPerMinute, percentile(p.goldPerMinute, bench.gold_per_min ?? [])],
      ["XPM", p.experiencePerMinute, percentile(p.experiencePerMinute, bench.xp_per_min ?? [])],
      ["LH/min", +(p.numLastHits / min).toFixed(1), percentile(p.numLastHits / min, bench.last_hits_per_min ?? [])],
      [t("Daño/min"), Math.round(p.heroDamage / min), percentile(p.heroDamage / min, bench.hero_damage_per_min ?? [])],
    ];
    const grid = el("div", "post-stats");
    for (const [label, value, pc] of rows) {
      const cell = el("div");
      cell.append(el("span", "lbl", label), el("span", "", String(value)), el("span", `pct ${pctClass(pc)}`, Number.isNaN(pc) ? "" : `p${pc}`));
      grid.append(cell);
    }
    root.append(el("div", "sub-title", t("Contra jugadores de tu héroe")), grid);
  }

  // Daño recibido por tipo
  const rt = rep.receivedTotal; // (no se llama t: t() es la traducción)
  const total = rt.physicalDamage + rt.magicalDamage + rt.pureDamage || 1;
  const bar = el("div", "dmg-bar");
  for (const [cls, v, label] of [["phys", rt.physicalDamage, t("Físico")], ["mag", rt.magicalDamage, t("Mágico")], ["pure", rt.pureDamage, t("Puro")]] as const) {
    const seg = el("span", cls);
    seg.style.width = `${(v / total) * 100}%`;
    seg.title = `${label}: ${v.toLocaleString()} (${Math.round((v / total) * 100)}%)`;
    bar.append(seg);
  }
  const legend = el(
    "div",
    "muted",
    t("Físico {p}% · Mágico {m}% · Puro {u}% · stun {s} s", { p: Math.round((rt.physicalDamage / total) * 100), m: Math.round((rt.magicalDamage / total) * 100), u: Math.round((rt.pureDamage / total) * 100), s: (rt.stunDuration / 100).toFixed(1) }),
  );
  root.append(el("div", "sub-title", t("Daño recibido · {n}", { n: total.toLocaleString() })), bar, legend);

  // Quién te hizo daño
  const who = el("div", "who");
  for (const r of [...(rep.receivedTargets ?? [])].sort((a, b) => b.amount - a.amount)) {
    const h = heroById(r.target);
    if (!h) continue;
    const w = el("span", "who-item");
    w.append(img(h.img, h.name), el("b", "", `${(r.amount / 1000).toFixed(1)}k`));
    who.append(w);
  }
  if (topAbilities.length) who.append(el("div", "muted", t("Más daño: ") + topAbilities.map((a) => `${names.get(a.abilityId)} ${(a.amount / 1000).toFixed(1)}k`).join(" · ")));
  root.append(who);

  // Muertes
  const list = el("ul", "deaths");
  for (const d of deaths) {
    const li = el("li");
    const k = heroById(d.attacker);
    const how = d.byAbility ? names.get(d.byAbility) : d.byItem ? items.get(d.byItem)?.dname : t("ataque");
    li.append(el("span", "muted", fmt(d.time)));
    if (k) li.append(img(k.img, k.name));
    li.append(el("span", "", `${k?.name ?? "?"} · ${how ?? "?"}`));
    li.append(el("span", "muted", t("−{gold} oro · {s} s", { gold: d.goldLost, s: d.timeDead }) + (d.isBurst ? " · burst" : "")));
    list.append(li);
  }
  root.append(el("div", "sub-title", t("Muertes · {n}", { n: deaths.length })), deaths.length ? list : el("div", "muted", t("Sin muertes 👌")));
  return root;
}

// --- Historial ---
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(LANG === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function historyList() {
  const ul = el("ul", "history");
  history.forEach((e, i) => {
    const h = heroById(e.heroId);
    const li = el("li", i === selected ? "sel" : "");
    if (h) li.append(img(h.img, h.name));
    const kda = e.kills !== undefined ? `${e.kills}/${e.deaths}/${e.assists}` : "";
    li.append(
      el("span", "muted", fmtDate(e.date)),
      el("span", "", h?.name ?? (e.heroId ? `#${e.heroId}` : `ID ${e.matchId}`)),
      el("span", e.win === true ? "win" : e.win === false ? "loss" : "muted", `${e.win === true ? t("V") : e.win === false ? t("D") : ""} ${kda}`.trim()),
    );
    if (e.imp !== undefined && e.imp !== null) li.append(el("span", "muted", `IMP ${e.imp}`));
    li.onclick = () => select(i);
    ul.append(li);
  });
  // Ver cualquier partida pública escribiendo su ID (p. ej. una que jugaste con la app cerrada).
  const input = Object.assign(document.createElement("input"), { placeholder: t("ID de partida + Enter"), inputMode: "numeric" });
  input.className = "match-input";
  input.onkeydown = (ev) => {
    if (ev.key !== "Enter") return;
    const id = input.value.trim();
    if (!/^\d{6,}$/.test(id)) return;
    addEntry({ matchId: id, heroId: 0, date: Date.now() });
    select(0);
  };
  const box = el("div");
  box.append(ul, input);
  return box;
}

function addEntry(e: Entry) {
  history = [e, ...history.filter((x) => x.matchId !== e.matchId)].slice(0, MAX_HISTORY);
  saveHistory();
}

function render() {
  const box = document.getElementById("post")!;
  const head = el("div", "sub-title", interactive ? t("Partidas · ↑/↓ o clic para elegir · Esc cierra") : t("Última partida · {key}: historial", { key: pretty(keyOf("post")) }));
  const body = content ?? el("div", "items-error", status || (history.length ? "" : t("Aún no hay partidas registradas.")));
  box.replaceChildren(head, ...(interactive && history.length ? [historyList()] : []), body);
}

/** Abre una partida del historial: usa la caché o la pide una vez a STRATZ. */
function select(i: number) {
  if (i < 0 || i >= history.length) return;
  selected = i;
  const e = history[i];
  content = null;
  status = t("Cargando…");
  render();
  build(e)
    .then((c) => { if (history[selected] === e) { content = c; status = ""; render(); } })
    .catch((err) => { if (history[selected] === e) { status = t(err instanceof Error ? err.message : String(err)); render(); } });
}

/** La partida recién terminada: reintenta hasta que STRATZ la analice y entonces se muestra sola. */
async function attempt(e: Entry) {
  tries++;
  try {
    const c = await build(e);
    if (history[selected] === e) { content = c; status = ""; }
    visible = true;
    render();
    onChange();
  } catch (err) {
    if (history[selected] === e) {
      status = t("{msg} (intento {n}/{max})", { msg: t(err instanceof Error ? err.message : String(err)), n: tries, max: MAX_TRIES });
      if (tries >= MAX_TRIES) status = t("STRATZ no analizó la partida. ¿Tienes activado exponer datos públicos de partidas?");
      render();
    }
    if (tries < MAX_TRIES) timer = window.setTimeout(() => attempt(e), RETRY_MS);
  }
}

/** Llamar cuando GSI reporta POST_GAME: guarda la partida en el historial y pide el análisis (una vez por partida). */
export function onGameEnd(e: Entry) {
  if (history[0]?.matchId === e.matchId) return;
  addEntry(e);
  clearTimeout(timer);
  tries = 0;
  selected = 0;
  content = null;
  status = t("Esperando a que STRATZ analice la partida…");
  render();
  attempt(history[0]);
}

export const postVisible = () => visible;
export function setPostVisible(on: boolean) {
  visible = on;
  onChange();
}

/** Modo "post" (atajo Resumen): la lista se puede usar con clic y flechas. */
export function setPostInteractive(on: boolean) {
  interactive = on;
  render();
}

export function initPost(changed: () => void) {
  onChange = changed;
  addEventListener("keydown", (ev) => {
    if (!interactive || (ev.target as Element).tagName === "INPUT") return;
    if (ev.key === "ArrowDown") select(selected + 1);
    else if (ev.key === "ArrowUp") select(selected - 1);
  });
  const old = localStorage.getItem("last-match"); // versión anterior: solo guardaba la última
  if (old && !history.length) addEntry({ ...(JSON.parse(old) as Entry), date: Date.now() });
  localStorage.removeItem("last-match");
  loadHeroes().then((h) => { heroes = h; render(); }).catch(() => {});
  render();
  if (history.length) select(0); // al abrir la app, la última partida lista para ver (desde la caché si ya estaba)
}
