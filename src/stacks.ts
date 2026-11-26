import { t } from "./i18n";
// Campamentos neutrales para el overlay del minimapa: dónde están, hacia dónde jalar y en qué segundo.
// Fuentes (nov 2026): dota2-tools.com/stack-timer (grandes/ancestrales :53, medianos :54, pequeños :55;
// el mediano junto a la T2 de arriba de Dire ~:56, sin aplicar: no se sabe cuál triángulo es) y teamsmurf
// "stacking masterclass" (parche 7.41d: doble stack = primer campamento :53 y el segundo :55-:56; pulls a la
// línea en minutos impares, pequeño :17-:22 y grande :15-:20).
// shortcut: direcciones de flecha genéricas (ninguna guía da rutas por campamento); se corrigen con el editor
// del modo mover y se guardan en localStorage.

export type CampType = "small" | "medium" | "large" | "ancient";
export type Side = "radiant" | "dire" | "river";

/** Coordenadas en 0-100 sobre el minimapa (y hacia abajo). dx/dy = punta de la flecha relativa al campamento. */
export type Camp = {
  id: string;
  side: Side;
  type: CampType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Segundo del minuto en que hay que atacar para stackear. */
  at: number;
  /** Doble stack: tras stackear este, caminar a `to` y atacarlo en el segundo `at`. */
  double?: { to: string; at: number };
  /** Pull a la línea en minutos impares, atacando en el segundo `at`. */
  pull?: { at: number; dx: number; dy: number };
};

export const TYPE_LABEL: Record<CampType, string> = { small: t("Pequeño"), medium: t("Mediano"), large: t("Grande"), ancient: t("Ancestral") };
export const DEFAULT_AT: Record<CampType, number> = { small: 55, medium: 54, large: 53, ancient: 53 };

// Posiciones medidas en una captura del minimapa (nov 2026): cada triángulo dorado es un campamento; los dos
// triángulos grandes con borde son campamentos grandes. Los dos de abajo salieron cortados en la captura.
// El cuadrado 0-100 está centrado en el centro de simetría del mapa; puede salirse un poco del marco del
// minimapa (el marco tapa los bordes), por eso se alinea haciendo coincidir círculos con triángulos.
// Rutas y segundos: mapa "Ranged Heroes stack timing" de u/Bu3nyy (7.38b), emparejado por posición con los
// campamentos medidos (25 de 28 coinciden a <4 unidades). Ese mapa nota que cada stack extra resta ~0.5 s.
// shortcut: [15,4.3] y [89.8,92.3] no están en el mapa de 7.38b (nuevos o movidos en 7.41): flecha genérica.
// Tipos: solo los grandes se distinguen en el ícono; el resto queda como mediano, los de pull como pequeño.
// Lado: debajo de la diagonal del río (y > x) es Radiant.
type Spot = [x: number, y: number, type?: CampType, extra?: Partial<Camp>];
const PULL_SMALL = 17; // teamsmurf: pequeño :17-:22 en minutos impares
const PULL_LARGE = 15; // teamsmurf: grande :15-:20
const r = (at: number, dx: number, dy: number) => ({ at, dx, dy }); // segundo + dirección de la ruta del mapa

const SPOTS: Spot[] = [
  // Dire (arriba a la derecha)
  [15, 4.3],
  [27.3, 2.9, "medium", r(56, -2.4, 5.5)],
  [53.4, 5, "small", { ...r(56, 3.2, 5.1), pull: { at: PULL_SMALL, dx: 0, dy: -7 } }],
  [63, 4, "medium", r(55, 0.9, 5.9)],
  [29.1, 21.7, "medium", r(56, -6, 0.2)],
  [23.9, 26.1, "medium", r(55, -5.7, 1.9)],
  [36.7, 27, "medium", r(56, -3.2, -5.1)],
  [46.6, 20.8, "medium", { ...r(54, -5.4, 2.7), pull: { at: PULL_LARGE, dx: 0, dy: -8 } }],
  [58.5, 25.1, "medium", r(56, -5.7, -2)],
  [57.4, 34.5, "medium", r(54, -1.1, -5.9)],
  [94.3, 40.3, "medium", r(55, -4.4, -4.1)],
  [96.5, 49.1, "medium", r(55, 1.7, 5.8)],
  [76.1, 49.4, "large", r(54, -6, -0.7)],
  [70.8, 56.9, "medium", r(53, -6, 0.4)],
  [77.8, 69.6, "medium", r(55, 5.9, 1.2)],
  // Radiant (abajo a la izquierda)
  [28.6, 43.3, "medium", r(53, -3.6, 4.8)],
  [22.7, 50.3, "large", r(54, 6, 0.5)],
  [4.1, 51.6, "medium", r(56, 1.7, -5.7)],
  [5.7, 59.7, "medium", r(55, 0.3, -6)],
  [43, 67.7, "medium", r(54, 4.5, 4)],
  [62.4, 71.5, "medium", r(56, -5.5, -2.4)],
  [40.2, 76.4, "medium", r(56, 6, -0.6)],
  [74, 77.9, "medium", r(55, 5.9, -0.8)],
  [52.6, 78.6, "medium", { ...r(53, 4.4, -4.1), pull: { at: PULL_LARGE, dx: 0, dy: 8 } }],
  [47.4, 92.7, "small", { ...r(55, -6, 0), pull: { at: PULL_SMALL, dx: 0, dy: 7 } }],
  [37.1, 96.1, "medium", r(52, 5.9, -1.3)],
  [76.9, 96.1, "medium", r(55, -4.1, -4.4)],
  [89.8, 92.3],
];

// Dobles stacks del mapa (ruta verde): stackear el primero en su segundo, caminar y atacar el segundo en `at`.
const DOUBLES: [from: string, to: string, at: number][] = [
  ["d-46.6-20.8", "d-36.7-27", 56],
  ["d-57.4-34.5", "d-58.5-25.1", 56],
  ["d-70.8-56.9", "d-76.1-49.4", 54],
  ["r-28.6-43.3", "r-22.7-50.3", 54],
  ["r-43-67.7", "r-40.2-76.4", 56],
  ["r-52.6-78.6", "r-62.4-71.5", 56],
];

export function defaultCamps(): Camp[] {
  const camps = SPOTS.map(([x, y, type = "medium", extra]): Camp => {
    const side: Side = y > x ? "radiant" : "dire";
    const out = side === "radiant" ? -1 : 1; // flecha por defecto alejándose del río; se corrige en el editor
    return { id: `${side[0]}-${x}-${y}`, side, type, x, y, dx: 4 * out, dy: -4 * out, at: DEFAULT_AT[type], ...extra };
  });
  for (const [from, to, at] of DOUBLES) {
    const c = camps.find((x) => x.id === from);
    if (c) c.double = { to, at };
  }
  return camps;
}

// v3: rutas del mapa de stacks; ignora lo guardado con las flechas genéricas anteriores.
const CAMPS_KEY = "camps-v3";
export function loadCamps(): Camp[] {
  const saved = localStorage.getItem(CAMPS_KEY);
  return saved ? (JSON.parse(saved) as Camp[]) : defaultCamps();
}
export const saveCamps = (camps: Camp[]) => localStorage.setItem(CAMPS_KEY, JSON.stringify(camps));
export const resetCamps = () => localStorage.removeItem(CAMPS_KEY);

/** hidden → prep (círculo, 20 s antes) → soon (cuenta regresiva, 10 s antes) → now (segundo exacto, parpadea). */
export type Phase = "hidden" | "prep" | "soon" | "now";
export type Step = { ph: Phase; left: number };
const PREP = 20; // aparecen los círculos para ir caminando
const SOON = 10; // empieza la cuenta regresiva
const NOW_BEFORE = 1; // 1 s antes ya parpadea
const STACK_WINDOW = 1; // ±1 s alrededor del segundo exacto
const PULL_WINDOW = 5; // ventanas de pull de las guías: 5 s (p. ej. :17-:22)
const HIDDEN: Step = { ph: "hidden", left: Infinity };

/**
 * Próxima vez que toca una acción que se repite cada `period` s en el segundo `at` (desplazada `offset`),
 * contando como vigente hasta `window` s después. Los neutrales aparecen al 1:00: nada antes.
 */
function step(t: number, at: number, period: number, offset: number, window: number): Step {
  const base = offset + at;
  let e = base + Math.ceil((t - window - base) / period) * period;
  if (e < 60) e += Math.ceil((60 - e) / period) * period;
  const left = e - t;
  const ph: Phase = left > PREP ? "hidden" : left > SOON ? "prep" : left > NOW_BEFORE ? "soon" : "now";
  return { ph, left };
}

/** Qué mostrar de un campamento en el segundo de juego t (clock_time). */
export function campState(c: Camp, t: number): { stack: Step; double: Step; pull: Step } {
  return {
    stack: step(t, c.at, 60, 0, STACK_WINDOW),
    double: c.double ? step(t, c.double.at, 60, 0, STACK_WINDOW) : HIDDEN,
    // Pull a la línea en minutos impares (1:15, 3:15…); la preparación puede empezar en el minuto par anterior.
    pull: c.pull ? step(t, c.pull.at, 120, 60, PULL_WINDOW) : HIDDEN,
  };
}

if (import.meta.env.DEV) {
  const camps = defaultCamps();
  console.assert(camps.length === 28 && new Set(camps.map((c) => c.id)).size === 28, "28 campamentos con id único");
  const first = camps.find((c) => c.id === "d-70.8-56.9")!;
  console.assert(first.at === 53 && first.double?.to === "d-76.1-49.4" && first.double.at === 54, "doble Dire :53 → :54");
  console.assert(DOUBLES.every(([a, b]) => camps.some((c) => c.id === a) && camps.some((c) => c.id === b)), "dobles apuntan a campamentos existentes");
  console.assert(camps.filter((c) => c.side === "radiant").length === 13, "13 de Radiant");
  const c = camps.find((x) => x.id === "r-47.4-92.7")!; // pequeño de la línea segura: stack :55, pull :17
  const ph = (t: number, k: "stack" | "pull" = "stack") => campState(c, t)[k].ph;
  console.assert(ph(50) === "hidden", "antes del 1:00 nada");
  console.assert(ph(94) === "hidden" && ph(96) === "prep", "círculos 20 s antes (1:35 para 1:55)");
  console.assert(ph(104) === "prep" && ph(106) === "soon" && campState(c, 106).stack.left === 9, "cuenta regresiva desde 10 s");
  console.assert(ph(115) === "now" && ph(116) === "now" && ph(117) === "hidden", "parpadea en el segundo exacto");
  console.assert(ph(198, "pull") === "now" && ph(138, "pull") === "hidden", "pull solo en minuto impar");
  console.assert(ph(178, "pull") === "prep", "preparación del pull desde el minuto par anterior");
}
