// Atajos configurables desde el modo mover. Se guardan en localStorage y se aplican en Rust al arrancar.
// - "shop": tecla de tienda de Dota, solo se LEE (Dota la sigue recibiendo); va sin modificadores.
// - "edit" / "draft" / "post": atajos globales (registrados en Windows), siempre con Ctrl/Alt/Shift.
// - Cualquiera acepta también rueda, Mouse 4 o Mouse 5 ("Mouse3"/"Mouse4"/"Mouse5"): Rust lee el botón, no lo bloquea.
import { invoke } from "@tauri-apps/api/core";

export type Action = "shop" | "edit" | "draft" | "post";
export const ACTIONS: Action[] = ["shop", "edit", "draft", "post"];
export const ACTION_LABEL: Record<Action, string> = { shop: "Tienda", edit: "Mover", draft: "Draft", post: "Resumen" };
const DEFAULTS: Record<Action, string> = { shop: "F4", edit: "Control+Shift+KeyM", draft: "Control+Shift+KeyD", post: "Control+Shift+KeyP" };
const STORE = "keys";

let keys: Record<Action, string> = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") };
let onChange = () => {};

export const keyOf = (a: Action) => keys[a];

/** "Control+Shift+KeyM" → "Ctrl+Shift+M"; "F4" → "F4". */
export const pretty = (accel: string) =>
  accel.replace("Control", "Ctrl").replace(/Key([A-Z])$/, "$1").replace(/Digit(\d)$/, "$1").replace(/Numpad(\d)$/, "Num$1").replace(/^Mouse(\d)$/, "Mouse $1");

/** Código de tecla del navegador (KeyboardEvent.code) → código virtual de Windows, para leer la tecla de tienda. */
export function vk(code: string): number | null {
  let m: RegExpExecArray | null;
  const mouse: Record<string, number> = { Mouse3: 0x04, Mouse4: 0x05, Mouse5: 0x06 }; // rueda, atrás, adelante
  if (code in mouse) return mouse[code];
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1].charCodeAt(0);
  if ((m = /^Digit(\d)$/.exec(code))) return 0x30 + Number(m[1]);
  if ((m = /^F(\d{1,2})$/.exec(code)) && Number(m[1]) >= 1 && Number(m[1]) <= 24) return 0x6f + Number(m[1]);
  if ((m = /^Numpad(\d)$/.exec(code))) return 0x60 + Number(m[1]);
  const other: Record<string, number> = {
    Space: 0x20, Tab: 0x09, Backquote: 0xc0, Minus: 0xbd, Equal: 0xbb, BracketLeft: 0xdb, BracketRight: 0xdd,
    Backslash: 0xdc, Semicolon: 0xba, Quote: 0xde, Comma: 0xbc, Period: 0xbe, Slash: 0xbf, Insert: 0x2d,
    Delete: 0x2e, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22, CapsLock: 0x14,
  };
  return other[code] ?? null;
}

/** Botón del mouse presionado → valor de atajo. Izquierdo y derecho no: romperían el juego. */
export function fromMouse(e: MouseEvent): string | null {
  return ({ 1: "Mouse3", 3: "Mouse4", 4: "Mouse5" } as Record<number, string>)[e.button] ?? null;
}

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta)(Left|Right)$/;

/** Lo que se guarda para una tecla presionada, o null si todavía es solo un modificador. */
export function fromEvent(a: Action, e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.test(e.code)) return null;
  if (a === "shop") return e.code;
  const mods = [e.ctrlKey && "Control", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super"].filter(Boolean);
  return [...mods, e.code].join("+");
}

async function apply(a: Action, value: string) {
  if (a === "shop") {
    if (value === "Escape") throw new Error("Esc ya cierra la tienda");
    const code = vk(value);
    if (code === null) throw new Error("esa tecla no está soportada");
    await invoke("set_shop_key", { vk: code });
  } else if (value.startsWith("Mouse")) {
    await invoke("set_mouse_bind", { action: a, vk: vk(value) });
  } else {
    await invoke("set_shortcut", { action: a, accel: value });
  }
}

/** Cambia y guarda un atajo. Rechaza (con el motivo) si Rust no lo acepta: sin modificador, repetido u ocupado. */
export async function setKey(a: Action, value: string) {
  const taken = ACTIONS.find((o) => o !== a && keys[o] === value);
  if (taken) throw new Error(`ya lo usa ${ACTION_LABEL[taken]}`);
  await apply(a, value);
  keys = { ...keys, [a]: value };
  localStorage.setItem(STORE, JSON.stringify(keys));
  onChange();
}

/** Al arrancar: aplica lo guardado; lo que falle vuelve a su valor por defecto. */
export async function initKeys(changed: () => void) {
  onChange = changed;
  for (const a of ACTIONS) {
    if (keys[a] === DEFAULTS[a]) continue;
    await apply(a, keys[a]).catch(() => (keys = { ...keys, [a]: DEFAULTS[a] }));
  }
  localStorage.setItem(STORE, JSON.stringify(keys));
  onChange();
}

if (import.meta.env.DEV) {
  console.assert(vk("F4") === 0x73 && vk("KeyB") === 0x42 && vk("Digit1") === 0x31 && vk("Space") === 0x20, "códigos VK");
  console.assert(pretty("Control+Shift+KeyM") === "Ctrl+Shift+M" && pretty("Alt+Digit3") === "Alt+3", "pretty");
  console.assert(vk("Mouse5") === 0x06 && pretty("Mouse5") === "Mouse 5", "mouse");
}
