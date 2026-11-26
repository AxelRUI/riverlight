// Items counter por héroe enemigo. Ninguna API pública da "item contra héroe", así que es una tabla curada:
// cada héroe tiene rasgos (evasión, invisibilidad...) y cada rasgo tiene items para cores (pos 1-3) y soportes (4-5).
// shortcut: tabla a mano del parche 7.3x; revisar con parches grandes o héroes nuevos.

type Trait =
  | "evasion" | "break" | "invis" | "magic" | "heal" | "illusions"
  | "physical" | "disable" | "mobile" | "targeted" | "buffs" | "mana";

export const TRAIT_LABEL: Record<Trait, string> = {
  evasion: "evasión",
  break: "pasivas",
  invis: "invisibilidad",
  magic: "daño mágico",
  heal: "curación",
  illusions: "ilusiones/unidades",
  physical: "daño físico",
  disable: "control",
  mobile: "movilidad",
  targeted: "ulti a objetivo",
  buffs: "buffs",
  mana: "maná",
};

const ITEMS: Record<Trait, { core: string[]; support: string[] }> = {
  evasion: { core: ["monkey_king_bar", "bloodthorn"], support: [] },
  break: { core: ["silver_edge"], support: [] },
  invis: { core: ["dust", "gem"], support: ["dust", "ward_sentry", "gem"] },
  magic: { core: ["black_king_bar", "pipe", "mage_slayer", "eternal_shroud"], support: ["glimmer_cape", "pipe", "lotus_orb"] },
  heal: { core: ["skadi", "shivas_guard", "spirit_vessel"], support: ["spirit_vessel"] },
  illusions: { core: ["bfury", "mjollnir", "shivas_guard"], support: [] },
  physical: { core: ["blade_mail", "heavens_halberd", "assault", "butterfly"], support: ["ghost", "force_staff", "solar_crest", "heavens_halberd"] },
  disable: { core: ["black_king_bar", "manta", "aeon_disk"], support: ["lotus_orb", "force_staff", "glimmer_cape", "cyclone"] },
  mobile: { core: ["orchid", "bloodthorn", "abyssal_blade", "sheepstick"], support: ["rod_of_atos", "gungir", "sheepstick"] },
  targeted: { core: ["sphere"], support: ["lotus_orb"] },
  buffs: { core: ["nullifier"], support: ["cyclone"] },
  mana: { core: ["diffusal_blade"], support: [] },
};

// Clave = nombre interno sin "npc_dota_hero_". Rasgos en orden de importancia.
const HEROES: Record<string, Trait[]> = {
  antimage: ["mobile"], axe: ["disable"], bane: ["disable", "targeted"], bloodseeker: ["heal"],
  crystal_maiden: ["magic"], drow_ranger: ["physical"], earthshaker: ["disable", "magic"], juggernaut: ["physical", "heal"],
  mirana: ["invis", "magic"], morphling: ["mobile"], nevermore: ["magic", "physical"], phantom_lancer: ["illusions", "evasion"],
  puck: ["mobile", "magic"], pudge: ["magic"], razor: ["physical"], sand_king: ["magic", "disable"],
  storm_spirit: ["mobile", "magic"], sven: ["physical"], tiny: ["physical", "disable"], vengefulspirit: ["physical"],
  windrunner: ["evasion", "mobile"], zuus: ["magic"], kunkka: ["physical", "disable"], lina: ["magic"],
  lion: ["magic", "disable", "targeted"], shadow_shaman: ["disable"], slardar: ["disable", "physical"], tidehunter: ["disable"],
  witch_doctor: ["magic", "heal"], lich: ["magic"], riki: ["invis", "physical"], enigma: ["disable"],
  tinker: ["mobile", "magic"], sniper: ["physical"], necrolyte: ["heal", "magic"], warlock: ["disable", "heal"],
  beastmaster: ["disable", "illusions"], queenofpain: ["mobile", "magic"], venomancer: ["magic"], faceless_void: ["disable", "mobile"],
  skeleton_king: ["heal", "physical"], death_prophet: ["magic", "heal"], phantom_assassin: ["evasion", "physical"], pugna: ["magic"],
  templar_assassin: ["physical", "invis", "mobile"], viper: ["magic"], luna: ["physical"], dragon_knight: ["physical"],
  dazzle: ["heal", "buffs"], rattletrap: ["disable", "magic"], leshrac: ["magic"], furion: ["mobile", "illusions"],
  life_stealer: ["heal", "physical"], dark_seer: ["magic"], clinkz: ["invis", "physical"], omniknight: ["heal", "buffs"],
  enchantress: ["heal"], huskar: ["heal", "physical"], night_stalker: ["disable", "physical"], broodmother: ["illusions"],
  bounty_hunter: ["invis"], weaver: ["invis", "mobile"], jakiro: ["magic"], batrider: ["disable", "mobile"],
  chen: ["heal"], spectre: ["physical"], ancient_apparition: ["magic"], doom_bringer: ["disable", "targeted"],
  ursa: ["physical"], spirit_breaker: ["disable", "mobile"], gyrocopter: ["physical", "magic"], alchemist: ["heal", "physical"],
  invoker: ["magic", "mobile"], silencer: ["disable"], obsidian_destroyer: ["magic"], lycan: ["physical", "illusions"],
  brewmaster: ["disable", "evasion"], shadow_demon: ["magic", "disable"], lone_druid: ["physical"], chaos_knight: ["illusions", "physical"],
  meepo: ["illusions", "mobile"], treant: ["heal"], ogre_magi: ["magic", "buffs"], undying: ["heal"],
  rubick: ["magic"], disruptor: ["magic", "disable"], nyx_assassin: ["invis", "magic"], naga_siren: ["illusions"],
  keeper_of_the_light: ["magic"], wisp: ["heal", "mobile"], visage: ["physical"], slark: ["mobile", "invis"],
  medusa: ["physical", "mana"], troll_warlord: ["physical", "disable"], centaur: ["disable"], magnataur: ["disable"],
  shredder: ["magic"], bristleback: ["break"], tusk: ["disable", "mobile"], skywrath_mage: ["magic"],
  abaddon: ["heal", "buffs"], elder_titan: ["magic", "disable"], legion_commander: ["targeted", "disable"], techies: ["invis", "magic"],
  ember_spirit: ["mobile", "magic", "physical"], earth_spirit: ["disable", "mobile"], abyssal_underlord: ["disable", "magic"],
  terrorblade: ["illusions", "physical"], phoenix: ["magic", "heal"], oracle: ["heal", "buffs"], winter_wyvern: ["heal", "disable"],
  arc_warden: ["illusions", "mobile"], monkey_king: ["physical", "mobile"], dark_willow: ["magic", "disable"],
  pangolier: ["disable", "mobile"], grimstroke: ["magic", "disable"], hoodwink: ["mobile", "physical"], void_spirit: ["mobile", "magic"],
  snapfire: ["magic"], mars: ["disable"], ringmaster: ["disable"], dawnbreaker: ["heal", "physical"],
  marci: ["physical", "mobile"], primal_beast: ["disable", "magic"], muerta: ["magic", "physical"], kez: ["mobile", "physical"],
};

export type Counter = { key: string; trait: Trait };

/**
 * Items contra un enemigo para tu rol. Primero los que tu héroe ya suele comprar en tu posición
 * (popularidad), luego el orden de la tabla. Quita los que ya tienes (o cubres con un item armado).
 */
export function counterItems(enemyKey: string, role: number, heroPopularity: Map<string, number>, covered: Set<string>, max = 2): Counter[] {
  const group = role <= 3 ? "core" : "support";
  const seen = new Set<string>();
  const list: (Counter & { order: number })[] = [];
  for (const trait of HEROES[enemyKey] ?? []) {
    for (const key of ITEMS[trait][group]) {
      if (seen.has(key) || covered.has(key)) continue;
      seen.add(key);
      list.push({ key, trait, order: list.length });
    }
  }
  const pop = (k: string) => heroPopularity.get(k) ?? 0;
  return list
    .sort((a, b) => pop(b.key) - pop(a.key) || a.order - b.order)
    .slice(0, max)
    .map(({ key, trait }) => ({ key, trait }));
}

/**
 * Items que sirven contra 2 o más enemigos a la vez: la recomendación más fuerte.
 * Cuenta sobre todos los counters de cada enemigo (no solo los 2 que se muestran por fila).
 */
export function sharedCounters(enemyKeys: string[], role: number, heroPopularity: Map<string, number>, covered: Set<string>, max = 3) {
  const count = new Map<string, number>();
  for (const k of enemyKeys) {
    for (const c of counterItems(k, role, heroPopularity, covered, Infinity)) count.set(c.key, (count.get(c.key) ?? 0) + 1);
  }
  const pop = (k: string) => heroPopularity.get(k) ?? 0;
  return [...count]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || pop(b[0]) - pop(a[0]))
    .slice(0, max)
    .map(([key, n]) => ({ key, count: n }));
}

if (import.meta.env.DEV) {
  const shared = sharedCounters(["phantom_assassin", "windrunner", "huskar"], 1, new Map(), new Set());
  console.assert(shared[0]?.key === "monkey_king_bar" && shared[0].count === 2, "MKB sirve contra PA y Windranger");
  console.assert(sharedCounters(["phantom_assassin"], 1, new Map(), new Set()).length === 0, "un solo enemigo no repite");
  const none = new Map<string, number>();
  console.assert(counterItems("phantom_assassin", 1, none, new Set()).map((c) => c.key).join() === "monkey_king_bar,bloodthorn", "PA core");
  console.assert(counterItems("phantom_assassin", 5, none, new Set())[0]?.key === "ghost", "PA soporte: evasión no tiene items de soporte");
  console.assert(counterItems("phantom_assassin", 1, new Map([["bloodthorn", 10]]), new Set())[0]?.key === "bloodthorn", "prioriza lo que compra tu héroe");
  console.assert(counterItems("phantom_assassin", 1, none, new Set(["monkey_king_bar"]))[0]?.key === "bloodthorn", "quita lo que ya tienes");
  console.assert(counterItems("heroe_desconocido", 1, none, new Set()).length === 0, "héroe sin tabla");
}
