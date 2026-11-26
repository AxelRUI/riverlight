import { t } from "./i18n";
import { invoke } from "@tauri-apps/api/core";
import { od } from "./opendota";
import { currentRole } from "./draft";
import { TRAIT_LABEL, counterItems, sharedCounters } from "./counters";

// dotaconstants en jsDelivr: mismo JSON que /constants/items de OpenDota, pero no depende de su API.
const ITEMS_URL = "https://cdn.jsdelivr.net/npm/dotaconstants/build/items.json";
const CDN = "https://cdn.cloudflare.steamstatic.com";

/** upgrade = se arma con algo que ya compraste. */
export type Item = { key: string; dname: string; img: string; components: string[]; upgrade?: boolean };
export type Source = "opendota" | "stratz";
type Phase = "start_game_items" | "early_game_items" | "mid_game_items" | "late_game_items";
/** Conteo de compras por id de item en cada fase (formato de OpenDota itemPopularity). */
type Popularity = Partial<Record<Phase, Record<string, number>>>;

export const SOURCE_LABEL: Record<Source, string> = { opendota: "OpenDota", stratz: "STRATZ" };

export const PHASE_LABEL: Record<Phase, string> = {
  start_game_items: t("Inicial"),
  early_game_items: t("Temprano"),
  mid_game_items: t("Medio"),
  late_game_items: t("Tardío"),
};

// Mismos cortes que usa OpenDota en itemPopularity (0, <10, 10-25, >25 min).
export function phaseFor(t: number): Phase {
  if (t < 0) return "start_game_items";
  if (t < 600) return "early_game_items";
  if (t < 1500) return "mid_game_items";
  return "late_game_items";
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(t("{host} respondió {status}", { host: new URL(url).host, status: r.status }));
  return r.json();
}

type StratzRow = { itemId: number; time: number; matchCount: number };
type StratzStart = { itemId: number; matchCount: number };

/**
 * STRATZ da compras {itemId, time (minuto), matchCount} (varias filas por item: posición, instancia);
 * se suman en las fases de OpenDota. Los items iniciales vienen aparte (itemStartingPurchase).
 */
export function stratzToPopularity(full: StratzRow[], start: StratzStart[] = []): Popularity {
  const pop: Popularity = {};
  const add = (phase: Phase, id: number, n: number) => {
    const bucket = (pop[phase] ??= {});
    bucket[id] = (bucket[id] ?? 0) + n;
  };
  for (const e of full) {
    const phase = phaseFor(e.time <= 0 ? -1 : e.time * 60);
    if (!(start.length && phase === "start_game_items")) add(phase, e.itemId, e.matchCount);
  }
  for (const s of start) add("start_game_items", s.itemId, s.matchCount);
  return pop;
}

type StratzData = { full: StratzRow[] | null; start: StratzStart[] | null } | null;
const hasRows = (d: StratzData) => !!(d?.full?.length || d?.start?.length);

const FETCHERS: Record<Source, (heroId: number) => Promise<Popularity>> = {
  opendota: async (heroId) => getJson<Popularity>(await od(`/heroes/${heroId}/itemPopularity`)),
  stratz: async (heroId) => {
    // Items de tu rol del draft; si casi nadie juega el héroe en ese rol, todas las posiciones.
    let data = await invoke<StratzData>("stratz_items", { heroId, position: currentRole() });
    if (!hasRows(data)) data = await invoke<StratzData>("stratz_items", { heroId, position: null });
    if (!hasRows(data)) throw new Error(t("STRATZ no devolvió datos para este héroe"));
    return stratzToPopularity(data!.full ?? [], data!.start ?? []);
  },
};

let itemsById: Promise<Map<number, Item>> | null = null;
const popularity = new Map<string, Promise<Popularity>>();

export function loadItems() {
  itemsById ??= getJson<Record<string, { id: number; dname?: string; img: string; components?: string[] | null }>>(ITEMS_URL)
    .then((all) =>
      new Map(Object.entries(all).map(([key, v]) => [v.id, { key, dname: v.dname ?? key, img: CDN + v.img, components: v.components ?? [] }])),
    )
    .catch((e) => { itemsById = null; throw e; }); // permite reintentar
  return itemsById;
}

// shortcut: caché sin expiración en localStorage; si los datos envejecen mucho, agregar fecha y refrescar cada X días.
function loadPopularity(source: Source, heroId: number) {
  // STRATZ depende del rol: cambiar de rol pide (y guarda) otra lista.
  const key = source === "stratz" ? `pop-stratz-${heroId}-pos${currentRole()}` : `pop-${source}-${heroId}`;
  let p = popularity.get(key);
  if (!p) {
    p = FETCHERS[source](heroId)
      .then((data) => { localStorage.setItem(key, JSON.stringify(data)); return data; })
      .catch((e) => {
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached) as Popularity; // fuente caída: usar la última respuesta buena
        popularity.delete(key); // sin caché: se reintenta (main.ts espacia los reintentos)
        throw e;
      });
    popularity.set(key, p);
  }
  return p;
}

const MAX_UPGRADES = 3;
const isBootUpgrade = (i: Item) => i.components.includes("boots") || i.key.startsWith("travel_boots");

/**
 * Arma la lista a partir de lo que ya compraste:
 * 1. Si tienes un componente, primero van los items que se arman con él y que este héroe suele comprar ("completar").
 * 2. Luego los más comprados de la fase, quitando lo que tienes, los componentes de lo que tienes
 *    y otras botas si ya tienes botas mejoradas.
 */
/** Popularidad del héroe por item sumando todas las fases. */
function totals(items: Map<number, Item>, pop: Popularity) {
  const total = new Map<string, number>();
  for (const bucket of Object.values(pop)) {
    for (const [id, n] of Object.entries(bucket ?? {})) {
      const it = items.get(Number(id));
      if (it) total.set(it.key, (total.get(it.key) ?? 0) + n);
    }
  }
  return total;
}

/** Lo que ya está cubierto: lo que tienes y, recursivamente, sus componentes. */
function coverage(byKey: Map<string, Item>, ownedKeys: Set<string>) {
  const covered = new Set<string>();
  const cover = (k: string) => {
    if (covered.has(k)) return;
    covered.add(k);
    byKey.get(k)?.components.forEach(cover);
  };
  ownedKeys.forEach(cover);
  return covered;
}

const keyMap = (items: Map<number, Item>) => new Map([...items.values()].map((i) => [i.key, i]));
const ownedKeysOf = (owned: Set<string>) => new Set([...owned].map((n) => n.replace(/^item_/, "")));

export function pickItems(items: Map<number, Item>, pop: Popularity, phase: Phase, ownedKeys: Set<string>, max = 6): Item[] {
  const byKey = keyMap(items);
  const total = totals(items, pop);
  const covered = coverage(byKey, ownedKeys);
  const hasBootUpgrade = [...ownedKeys].some((k) => { const i = byKey.get(k); return !!i && isBootUpgrade(i); });

  const allowed = (i: Item) =>
    !i.key.startsWith("recipe_") && !covered.has(i.key) && !(hasBootUpgrade && (i.key === "boots" || isBootUpgrade(i)));

  const upgrades = [...items.values()]
    .filter((i) => allowed(i) && (total.get(i.key) ?? 0) > 0 && i.components.some((c) => ownedKeys.has(c)))
    .sort((a, b) => total.get(b.key)! - total.get(a.key)!)
    .slice(0, MAX_UPGRADES)
    .map((i) => ({ ...i, upgrade: true }));

  const taken = new Set(upgrades.map((i) => i.key));
  const regular = Object.entries(pop[phase] ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => items.get(Number(id)))
    .filter((i): i is Item => !!i && allowed(i) && !taken.has(i.key));

  return [...upgrades, ...regular].slice(0, max);
}

/** Sugerencias de una fuente para el héroe, la fase actual y lo que llevas (nombres de GSI, "item_blink"). */
export async function suggestions(source: Source, heroId: number, t: number, owned: Set<string>, max = 6): Promise<Item[]> {
  const [items, pop] = await Promise.all([loadItems(), loadPopularity(source, heroId)]);
  return pickItems(items, pop, phaseFor(t), ownedKeysOf(owned), max);
}

export type CounterRow = { enemy: { name: string; img: string }; items: (Item & { why: string })[] };
export type Counters = { rows: CounterRow[]; priority: (Item & { count: number })[] };

/**
 * Por cada enemigo, items que lo contrarrestan para tu héroe y rol (STRATZ por rol si hay; si no, OpenDota),
 * más los que se repiten entre varios enemigos (prioridad).
 */
export async function counterSuggestions(heroId: number, owned: Set<string>, enemies: { key: string; name: string; img: string }[]): Promise<Counters> {
  const items = await loadItems();
  const pop = await loadPopularity("stratz", heroId)
    .catch(() => loadPopularity("opendota", heroId))
    .catch(() => ({}) as Popularity); // sin popularidad igual sirve la tabla
  const byKey = keyMap(items);
  const tot = totals(items, pop);
  const covered = coverage(byKey, ownedKeysOf(owned));
  const rows = enemies
    .map((enemy) => ({
      enemy,
      items: counterItems(enemy.key, currentRole(), tot, covered)
        .filter((c) => byKey.has(c.key))
        .map((c) => ({ ...byKey.get(c.key)!, why: TRAIT_LABEL[c.trait] })),
    }))
    .filter((r) => r.items.length);
  const priority = sharedCounters(enemies.map((e) => e.key), currentRole(), tot, covered)
    .filter((s) => byKey.has(s.key))
    .map((s) => ({ ...byKey.get(s.key)!, count: s.count }));
  return { rows, priority };
}

if (import.meta.env.DEV) {
  console.assert(phaseFor(-30) === "start_game_items", "fase inicial");
  console.assert(phaseFor(599) === "early_game_items" && phaseFor(600) === "mid_game_items", "corte 10 min");
  console.assert(phaseFor(1500) === "late_game_items", "corte 25 min");
  const p = stratzToPopularity([
    { itemId: 1, time: 0, matchCount: 5 },
    { itemId: 1, time: 3, matchCount: 2 },
    { itemId: 1, time: 4, matchCount: 3 },
    { itemId: 2, time: 30, matchCount: 7 },
  ]);
  console.assert(p.start_game_items?.[1] === 5 && p.early_game_items?.[1] === 5 && p.late_game_items?.[2] === 7, "stratz → fases");
  const p2 = stratzToPopularity([{ itemId: 1, time: 0, matchCount: 5 }], [{ itemId: 9, matchCount: 3 }, { itemId: 9, matchCount: 2 }]);
  console.assert(p2.start_game_items?.[9] === 5 && p2.start_game_items?.[1] === undefined, "iniciales de STRATZ reemplazan minuto 0");

  const it = (id: number, key: string, components: string[] = []): [number, Item] => [id, { key, dname: key, img: "", components }];
  const items = new Map([
    it(1, "boots"), it(2, "power_treads", ["boots", "gloves"]), it(3, "phase_boots", ["boots", "blades"]),
    it(4, "ogre_axe"), it(5, "black_king_bar", ["ogre_axe", "mithril_hammer"]), it(6, "blink"), it(7, "gloves"),
  ]);
  const pop: Popularity = { early_game_items: { 1: 9, 2: 8, 3: 7, 6: 1 }, late_game_items: { 5: 5 } };
  const keys = (owned: string[]) => pickItems(items, pop, "early_game_items", new Set(owned)).map((i) => i.key).join();
  console.assert(keys([]) === "boots,power_treads,phase_boots,blink", "sin compras");
  console.assert(keys(["ogre_axe"]).startsWith("black_king_bar,"), "componente → completar");
  console.assert(keys(["phase_boots"]) === "blink", "botas mejoradas excluyen otras botas");
  console.assert(keys(["gloves"]).startsWith("power_treads,"), "guantes → treads");
}
