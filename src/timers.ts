import { t } from "./i18n";
// shortcut: tiempos del parche 7.3x escritos a mano, revisar con cada parche grande.
export const EVENTS = [
  { name: t("Runa de recompensa"), start: 0, every: 180 },
  { name: t("Runa de poder"), start: 360, every: 120 },
  { name: t("Runa de sabiduría"), start: 420, every: 420 },
  { name: t("Loto"), start: 180, every: 180 },
  { name: t("Stack de neutrales"), start: 113, every: 60 },
];

// shortcut: tiempos del parche 7.3x (Roshan 8-11 min, Tormentor 15:00 y 10 min tras morir); revisar con parches grandes.
const ROSH_MIN = 480;
const ROSH_MAX = 660;
const TORM_FIRST = 900;
const TORM_RESPAWN = 600;

export type BossRow = { name: string; text: string; cls: "" | "soon" | "ready" | "maybe" };

/** Estado de Roshan y Tormentor. deadAt = clock_time de la última muerte (null = no ha muerto). */
export function bossRows(t: number, roshDeadAt: number | null, tormDeadAt: number | null): BossRow[] {
  const countdown = (left: number): Pick<BossRow, "text" | "cls"> => ({ text: fmt(left), cls: left <= 10 ? "soon" : "" });

  let rosh: Pick<BossRow, "text" | "cls"> = { text: "READY", cls: "ready" };
  if (roshDeadAt !== null) {
    const since = t - roshDeadAt;
    if (since < ROSH_MIN) rosh = countdown(ROSH_MIN - since);
    else if (since < ROSH_MAX) rosh = { text: `¿? ${fmt(ROSH_MAX - since)}`, cls: "maybe" }; // puede haber salido ya
  }

  const tormAt = tormDeadAt === null ? TORM_FIRST : tormDeadAt + TORM_RESPAWN;
  const torm: Pick<BossRow, "text" | "cls"> = t >= tormAt ? { text: "READY", cls: "ready" } : countdown(tormAt - t);

  return [{ name: "Roshan", ...rosh }, { name: "Tormentor", ...torm }];
}

/** Segundos de juego en que ocurre el próximo evento (>= t). */
export function nextAt(t: number, start: number, every: number): number {
  if (t <= start) return start;
  return start + Math.ceil((t - start) / every) * every;
}

export function fmt(s: number): string {
  const sign = s < 0 ? "-" : "";
  s = Math.abs(Math.floor(s));
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

if (import.meta.env.DEV) {
  console.assert(nextAt(-90, 360, 120) === 360, "antes del inicio");
  console.assert(nextAt(360, 360, 120) === 360, "justo en el evento");
  console.assert(nextAt(361, 360, 120) === 480, "después del evento");
  console.assert(fmt(-75) === "-1:15" && fmt(605) === "10:05", "fmt");
  const [r0, t0] = bossRows(300, null, null);
  console.assert(r0.cls === "ready" && t0.text === "10:00", "inicio: Roshan vivo, Tormentor al 15:00");
  console.assert(bossRows(1000, 700, null)[0].text === "3:00", "Roshan: 8 min mínimo");
  console.assert(bossRows(1250, 700, null)[0].cls === "maybe", "Roshan: ventana 8-11");
  console.assert(bossRows(1400, 700, null)[0].cls === "ready", "Roshan: después de 11 min");
  console.assert(bossRows(1500, null, 1000)[1].text === "1:40" && bossRows(1600, null, 1000)[1].cls === "ready", "Tormentor reaparece a los 10 min");
}
