// Comparativa en vivo: tus stats por minuto contra los percentiles del héroe en OpenDota (/benchmarks).
// shortcut: OpenDota da promedios de final de partida y mezcla posiciones (STRATZ heroStats.stats, que
// era por minuto y posición, hoy devuelve vacío); por eso solo se compara desde el 10:00.
import { od } from "./opendota";
export const FROM = 600;

type Row = { percentile: number; value: number };
export type Bench = Record<"gold_per_min" | "xp_per_min" | "last_hits_per_min" | "kills_per_min" | "deaths_per_min" | "assists_per_min" | "hero_damage_per_min", Row[]>;

/** Percentil (0-100) de `v` interpolando entre los puntos de OpenDota (10, 20... 99). */
export function percentile(v: number, rows: Row[]): number {
  if (!rows.length) return NaN;
  if (v <= rows[0].value) return Math.max(1, Math.round((rows[0].percentile * 100 * v) / (rows[0].value || 1)));
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1], rows[i]];
    if (v <= b.value) return Math.round((a.percentile + ((v - a.value) / (b.value - a.value || 1)) * (b.percentile - a.percentile)) * 100);
  }
  return 99;
}

const cache = new Map<number, Promise<Bench>>();
export function loadBench(heroId: number) {
  let p = cache.get(heroId);
  if (!p) {
    const key = `bench-${heroId}`;
    p = od(`/benchmarks?hero_id=${heroId}`)
      .then((url) => fetch(url))
      .then((r) => { if (!r.ok) throw new Error(`api.opendota.com respondió ${r.status}`); return r.json(); })
      .then((j) => { localStorage.setItem(key, JSON.stringify(j.result)); return j.result as Bench; })
      .catch((e) => {
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached) as Bench; // OpenDota caído: últimos datos buenos
        cache.delete(heroId);
        throw e;
      });
    cache.set(heroId, p);
  }
  return p;
}

export type Live = { clock: number; gpm: number; xpm: number; lastHits: number; kills: number; deaths: number; assists: number };
export type Compared = { gpm: number; xpm: number; lh: number; kda: number };

/** KDA = promedio del percentil de kills, asistencias y muertes (invertido: menos muertes es mejor). */
export function compare(b: Bench, s: Live): Compared {
  const min = s.clock / 60;
  const p = (v: number, k: keyof Bench) => percentile(v, b[k] ?? []);
  return {
    gpm: p(s.gpm, "gold_per_min"),
    xpm: p(s.xpm, "xp_per_min"),
    lh: p(s.lastHits / min, "last_hits_per_min"),
    kda: Math.round((p(s.kills / min, "kills_per_min") + p(s.assists / min, "assists_per_min") + (100 - p(s.deaths / min, "deaths_per_min"))) / 3),
  };
}

if (import.meta.env.DEV) {
  const rows = [{ percentile: 0.1, value: 100 }, { percentile: 0.5, value: 300 }, { percentile: 0.99, value: 700 }];
  console.assert(percentile(300, rows) === 50 && percentile(200, rows) === 30, "interpolación");
  console.assert(percentile(50, rows) === 5 && percentile(900, rows) === 99, "extremos");
}
