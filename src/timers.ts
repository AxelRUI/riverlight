// shortcut: tiempos del parche 7.3x escritos a mano, revisar con cada parche grande.
export const EVENTS = [
  { name: "Runa de recompensa", start: 180, every: 180 },
  { name: "Runa de poder", start: 360, every: 120 },
  { name: "Runa de sabiduría", start: 420, every: 420 },
  { name: "Loto", start: 180, every: 180 },
  { name: "Stack de neutrales", start: 113, every: 60 },
];

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
}
