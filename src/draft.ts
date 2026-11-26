import { keyOf, pretty } from "./keys";
import { od } from "./opendota";
// Recomendaciones de pick: picks enemigos escritos a mano (GSI no los da al jugador) + matchups de OpenDota.
const HEROES_URL = "https://cdn.jsdelivr.net/npm/dotaconstants/build/heroes.json";
const CDN = "https://cdn.cloudflare.steamstatic.com";
const MIN_GAMES = 20; // por debajo, el matchup es ruido
const ROLE_KEY = "draft-role";

export const DRAFT_STATES = ["DOTA_GAMERULES_STATE_HERO_SELECTION", "DOTA_GAMERULES_STATE_STRATEGY_TIME"];

export type Hero = { id: number; key: string; name: string; roles: string[]; img: string; norm: string; initials: string };
type Matchup = { hero_id: number; games_played: number; wins: number };

// shortcut: posición inferida de las etiquetas de rol de dotaconstants (roles[0] = rol principal);
// si se queda corto, cambiar a estadísticas por posición de STRATZ.
export const ROLES: { pos: number; label: string; fits: (r: string[]) => boolean }[] = [
  { pos: 1, label: "Carry", fits: (r) => r[0] === "Carry" },
  { pos: 2, label: "Mid", fits: (r) => r[0] !== "Support" && (r.includes("Nuker") || r.includes("Escape")) },
  { pos: 3, label: "Offlane", fits: (r) => r[0] !== "Support" && (r.includes("Initiator") || r.includes("Durable")) },
  { pos: 4, label: "Soporte 4", fits: (r) => r.includes("Support") || (r.includes("Initiator") && r.includes("Disabler")) },
  { pos: 5, label: "Soporte 5", fits: (r) => r.includes("Support") },
];

// Guion cuenta como espacio para que "Anti-Mage" tenga iniciales "am".
const norm = (s: string) => s.toLowerCase().replace(/-/g, " ").replace(/[^a-z0-9 ]/g, "");

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}`);
  return r.json();
}

let heroes: Promise<Hero[]> | null = null;
export function loadHeroes() {
  heroes ??= getJson<Record<string, { id: number; name: string; localized_name: string; roles: string[]; img: string }>>(HEROES_URL)
    .then((all) =>
      Object.values(all).map((h) => ({
        id: h.id,
        key: h.name.replace("npc_dota_hero_", ""),
        name: h.localized_name,
        roles: h.roles,
        img: CDN + h.img,
        norm: norm(h.localized_name).replace(/ /g, ""),
        initials: norm(h.localized_name).split(/ +/).map((w) => w[0]).join(""),
      })),
    )
    .catch((e) => { heroes = null; throw e; });
  return heroes;
}

/** Mejor coincidencia para lo que escribiste: nombre que empieza igual, luego iniciales ("am" → Anti-Mage), luego contiene. */
export function search(list: Hero[], q: string, exclude: Set<number>): Hero | undefined {
  const s = norm(q).replace(/ /g, "");
  if (!s) return;
  const pool = list.filter((h) => !exclude.has(h.id));
  return (
    pool.find((h) => h.norm.startsWith(s)) ??
    pool.find((h) => h.initials.startsWith(s)) ??
    pool.find((h) => h.norm.includes(s))
  );
}

const matchups = new Map<number, Promise<Matchup[]>>();
function loadMatchups(heroId: number) {
  const key = `mu-${heroId}`;
  let p = matchups.get(heroId);
  if (!p) {
    p = od(`/heroes/${heroId}/matchups`)
      .then((url) => getJson<Matchup[]>(url))
      .then((d) => { localStorage.setItem(key, JSON.stringify(d)); return d; })
      .catch((e) => {
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached) as Matchup[];
        matchups.delete(heroId);
        throw e;
      });
    matchups.set(heroId, p);
  }
  return p;
}

/**
 * Ventaja de cada candidato contra los enemigos: suma de (win rate del candidato contra el enemigo − 50 %).
 * Los matchups vienen del lado del enemigo, por eso el win rate del candidato es 1 − wins/games.
 */
export function score(enemyMatchups: Matchup[][], candidates: Hero[]) {
  const adv = new Map<number, number>();
  for (const list of enemyMatchups) {
    for (const m of list) {
      if (m.games_played < MIN_GAMES) continue;
      adv.set(m.hero_id, (adv.get(m.hero_id) ?? 0) + (1 - m.wins / m.games_played - 0.5));
    }
  }
  return candidates
    .filter((h) => adv.has(h.id))
    .map((h) => ({ hero: h, adv: adv.get(h.id)! * 100 }))
    .sort((a, b) => b.adv - a.adv);
}

export async function recommend(enemies: Hero[], pos: number, max = 5) {
  const [list, mus] = await Promise.all([loadHeroes(), Promise.all(enemies.map((e) => loadMatchups(e.id)))]);
  const role = ROLES.find((r) => r.pos === pos)!;
  const taken = new Set(enemies.map((e) => e.id));
  return score(mus, list.filter((h) => role.fits(h.roles) && !taken.has(h.id))).slice(0, max);
}

// --- Estado y UI del panel de draft ---
const $ = (id: string) => document.getElementById(id)!;
const input = () => $("draft-input") as HTMLInputElement;

let enemies: Hero[] = [];
/** Enemigos escritos en el draft o durante la partida (Ctrl+Shift+D). */
export const currentEnemies = () => enemies;
let pos = Number(localStorage.getItem(ROLE_KEY)) || 1;
let prevState = "";
let renderToken = 0;

// Palabras que en la caja de texto marcan una muerte en vez de buscar héroe (respaldo si GSI no manda el evento).
export type Command = "roshan" | "tormentor";
const COMMANDS: Record<string, Command> = { rosh: "roshan", roshan: "roshan", torm: "tormentor", tormentor: "tormentor" };
let onCommand: ((c: Command) => void) | undefined;
export const setCommandHandler = (fn: (c: Command) => void) => (onCommand = fn);

/** Rol elegido en el draft (1-5); también filtra los items de STRATZ. */
export const currentRole = () => pos;

function setRole(p: number) {
  pos = p;
  localStorage.setItem(ROLE_KEY, String(p));
  render();
}

async function render() {
  $("roles").replaceChildren(
    ...ROLES.map((r) => {
      const b = Object.assign(document.createElement("button"), { textContent: `${r.pos}`, title: r.label });
      b.classList.toggle("active", r.pos === pos);
      b.onclick = () => setRole(r.pos);
      return b;
    }),
  );
  $("draft-role").textContent = ROLES.find((r) => r.pos === pos)!.label;
  $("enemies").replaceChildren(
    ...enemies.map((h) => {
      const chip = Object.assign(document.createElement("img"), { src: h.img, alt: h.name, title: `${h.name} (clic para quitar)` });
      chip.onclick = () => { enemies = enemies.filter((e) => e !== h); render(); };
      return chip;
    }),
  );

  const recs = $("recs");
  if (!enemies.length) {
    recs.replaceChildren(Object.assign(document.createElement("li"), { className: "items-error", textContent: `Agrega picks enemigos con ${pretty(keyOf("draft"))}` }));
    return;
  }
  const token = ++renderToken; // si cambian los enemigos mientras carga, solo vale la última respuesta
  try {
    const list = await recommend(enemies, pos);
    if (token !== renderToken) return;
    recs.replaceChildren(
      ...list.map(({ hero, adv }) => {
        const li = document.createElement("li");
        li.append(
          Object.assign(document.createElement("img"), { src: hero.img, alt: "" }),
          Object.assign(document.createElement("span"), { textContent: hero.name }),
          Object.assign(document.createElement("b"), { className: adv >= 0 ? "pos" : "neg", textContent: `${adv >= 0 ? "+" : ""}${adv.toFixed(1)}%` }),
        );
        return li;
      }),
    );
  } catch (e) {
    if (token !== renderToken) return;
    recs.replaceChildren(Object.assign(document.createElement("li"), { className: "items-error", textContent: e instanceof Error ? e.message : String(e) }));
  }
}

async function preview() {
  const list = await loadHeroes().catch(() => []);
  const h = search(list, input().value, new Set(enemies.map((e) => e.id)));
  $("draft-match").textContent = h ? `→ ${h.name}` : "";
  return h;
}

export function initDraft() {
  input().addEventListener("input", preview);
  input().addEventListener("keydown", async (e) => {
    if (/^[1-5]$/.test(e.key)) { e.preventDefault(); setRole(Number(e.key)); return; } // ningún héroe lleva dígitos
    if (e.key === "Enter") {
      const cmd = COMMANDS[input().value.trim().toLowerCase()];
      if (cmd) {
        onCommand?.(cmd);
        input().value = "";
        return;
      }
      const h = await preview();
      if (h && enemies.length < 5) { enemies = [...enemies, h]; render(); }
      input().value = "";
      $("draft-match").textContent = "";
    } else if (e.key === "Backspace" && !input().value && enemies.length) {
      enemies = enemies.slice(0, -1);
      render();
    }
  });
  loadHeroes().catch(() => {}); // precarga para que el autocompletado sea instantáneo
  render();
}

/** Llamar en cada tick de GSI: un draft nuevo limpia los enemigos anteriores. */
export function onGameState(state: string) {
  if (state === DRAFT_STATES[0] && prevState !== state && enemies.length) {
    enemies = [];
    render();
  }
  prevState = state;
}

export function setDraftActive(on: boolean) {
  if (on) setTimeout(() => input().focus(), 50); // tras set_focus de la ventana
}

if (import.meta.env.DEV) {
  const h = (id: number, name: string): Hero => ({ id, key: "", name, roles: [], img: "", norm: norm(name).replace(/ /g, ""), initials: norm(name).split(/ +/).map((w) => w[0]).join("") });
  const list = [h(1, "Anti-Mage"), h(2, "Axe"), h(3, "Queen of Pain")];
  console.assert(search(list, "ax", new Set())?.id === 2, "prefijo");
  console.assert(search(list, "qop", new Set())?.id === 3, "iniciales");
  console.assert(search(list, "am", new Set())?.id === 1, "iniciales con guion");
  console.assert(search(list, "ax", new Set([2])) === undefined, "excluye pickeados");
  // Enemigo con 40 victorias de 100 contra el héroe 1 → el héroe 1 gana 60 % → +10.
  const s = score([[{ hero_id: 1, games_played: 100, wins: 40 }, { hero_id: 2, games_played: 5, wins: 0 }]], list);
  console.assert(s.length === 1 && Math.abs(s[0].adv - 10) < 1e-9, "ventaja");
}
