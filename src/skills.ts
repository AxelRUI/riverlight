// Build de habilidades: orden real de partidas guía de STRATZ (alto MMR) para tu héroe y rol,
// y qué te toca subir según lo que ya subiste (GSI).
import { invoke } from "@tauri-apps/api/core";

const CDN = "https://cdn.cloudflare.steamstatic.com";
const LEVELS = 18; // posiciones que se comparan entre builds (después casi todo es igual)
const TALENT_TIERS = [10, 15, 20, 25];

export type Skill = { id: number; name: string; label: string; talent: boolean; img: string };

const query = (q: string) => invoke<any>("stratz_query", { query: q });

/** La build que más se parece a las demás (medoide): siempre es una build real y válida, sin mezclar órdenes. */
export function medoid(seqs: number[][]): number[] {
  const dist = (a: number[], b: number[]) => {
    let d = 0;
    for (let i = 0; i < LEVELS; i++) if (a[i] !== b[i]) d++;
    return d;
  };
  let best = seqs[0];
  let bestD = Infinity;
  for (const s of seqs) {
    const d = seqs.reduce((sum, o) => sum + dist(s, o), 0);
    if (d < bestD) [best, bestD] = [s, d];
  }
  return best;
}

async function fetchBuild(heroId: number, pos: number): Promise<Skill[]> {
  const g = await query(`{ heroStats { guide(heroId: ${heroId}, positionId: POSITION_${pos}) { guides { matchId } } } }`);
  const ids: number[] = (g.heroStats.guide?.[0]?.guides ?? []).map((x: { matchId: number }) => x.matchId).slice(0, 10);
  if (!ids.length) throw new Error("STRATZ no tiene partidas guía de tu héroe en este rol");

  // Una sola consulta con alias: m0, m1... (matches(ids) pide permisos de admin).
  const m = await query(`{ ${ids.map((id, i) => `m${i}: match(id: ${id}) { players { heroId abilities { abilityId } } }`).join(" ")} }`);
  const seqs = ids
    .map((_, i) => m[`m${i}`]?.players?.find((p: { heroId: number }) => p.heroId === heroId)?.abilities ?? [])
    .map((a: { abilityId: number }[]) => a.map((x) => x.abilityId))
    .filter((s: number[]) => s.length >= 6);
  if (!seqs.length) throw new Error("las partidas guía no traen orden de habilidades");
  const build = medoid(seqs);

  const uniq = [...new Set(build)];
  const c = await query(`{ constants { ${uniq.map((id) => `a${id}: ability(id: ${id}) { name language { displayName } }`).join(" ")} } }`);
  return build.map((id) => {
    const a = c.constants[`a${id}`] ?? { name: String(id) };
    return {
      id,
      name: a.name,
      label: a.language?.displayName ?? a.name,
      talent: a.name.startsWith("special_bonus"),
      img: `${CDN}/apps/dota2/images/dota_react/abilities/${a.name}.png`,
    };
  });
}

const builds = new Map<string, Promise<Skill[]>>();
/** Build de héroe + rol, guardada en disco: son 3 consultas a STRATZ por combinación. */
export function loadBuild(heroId: number, pos: number) {
  const key = `skills-${heroId}-pos${pos}`;
  let p = builds.get(key);
  if (!p) {
    const cached = localStorage.getItem(key);
    p = cached
      ? Promise.resolve(JSON.parse(cached) as Skill[])
      : fetchBuild(heroId, pos).then((b) => { localStorage.setItem(key, JSON.stringify(b)); return b; });
    p.catch(() => builds.delete(key)); // reintentar más tarde
    builds.set(key, p);
  }
  return p;
}

export type SkillAdvice = { next?: Skill; upcoming: Skill[]; talent?: Skill; pending: boolean };

/**
 * Qué subir ahora: recorre la build y devuelve la primera habilidad que pide más niveles de los que ya tienes
 * (así se adapta si te saliste del orden). `levels` = nivel actual de cada habilidad por nombre (GSI).
 * Los talentos no se ven en GSI: se sugiere el del último escalón alcanzado (10/15/20/25).
 */
export function advise(build: Skill[], levels: Map<string, number>, heroLevel: number): SkillAdvice {
  const count = new Map<string, number>();
  let nextIdx = -1;
  for (let i = 0; i < build.length; i++) {
    const s = build[i];
    if (s.talent) continue;
    count.set(s.name, (count.get(s.name) ?? 0) + 1);
    if (count.get(s.name)! > (levels.get(s.name) ?? 0)) { nextIdx = i; break; }
  }
  const next = nextIdx >= 0 ? build[nextIdx] : undefined;
  const upcoming = nextIdx >= 0 ? build.slice(nextIdx + 1).filter((s) => !s.talent).slice(0, 4) : [];

  const talents = build.filter((s) => s.talent);
  const tier = TALENT_TIERS.filter((l) => heroLevel >= l).length; // escalones alcanzados
  const talent = tier > 0 && heroLevel < TALENT_TIERS[tier - 1] + 5 ? talents[tier - 1] : undefined;

  // Puntos sin gastar: nivel − puntos en habilidades de la build − talentos que ya pudiste tomar.
  // shortcut: asume que tomas cada talento al llegar a su nivel; si lo atrasas, avisa de más.
  const spent = [...new Set(build.filter((s) => !s.talent).map((s) => s.name))].reduce((n, k) => n + (levels.get(k) ?? 0), 0);
  const pending = !!next && heroLevel - spent - tier > 0;
  return { next, upcoming, talent, pending };
}

if (import.meta.env.DEV) {
  console.assert(medoid([[1, 2, 1], [1, 2, 1], [2, 1, 1]]).join() === "1,2,1", "medoide");
  const sk = (id: number, name: string, talent = false): Skill => ({ id, name, label: name, talent, img: "" });
  const [q, w, e, r, t] = [sk(1, "q"), sk(2, "w"), sk(3, "e"), sk(4, "r"), sk(9, "special_bonus_x", true)];
  const build = [q, w, q, e, q, r, q, w, w, w, t, e, r, e, e];
  const lv = (o: Record<string, number>) => new Map(Object.entries(o));
  const a1 = advise(build, lv({}), 1);
  console.assert(a1.next === q && a1.pending && a1.upcoming[0] === w, "nivel 1: Q");
  const a2 = advise(build, lv({ q: 2, w: 1 }), 3);
  console.assert(a2.next === e && !a2.pending, "nivel 3 con todo gastado: siguiente E, sin pendiente");
  const a3 = advise(build, lv({ q: 1, w: 2 }), 4);
  console.assert(a3.next === q && a3.pending, "te saliste del orden: pide Q");
  const a10 = advise(build, lv({ q: 4, w: 4, e: 1, r: 1 }), 11);
  console.assert(a10.talent === t && !a10.pending, "nivel 11: talento del nivel 10, puntos gastados");
}
