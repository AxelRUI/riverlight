// Overlay sobre el minimapa con las flechas de stack/pull. En modo mover (Ctrl+Shift+M) se alinea con
// el minimapa real y se editan los campamentos.
import { Camp, CampType, DEFAULT_AT, Phase, Side, Step, TYPE_LABEL, campState, defaultCamps, loadCamps, resetCamps, saveCamps } from "./stacks";

const RECT_KEY = "minimap-rect";
const TYPES: CampType[] = ["small", "medium", "large", "ancient"];
const $ = (id: string) => document.getElementById(id)!;

let camps = loadCamps();
let editing = false;
let selected: string | null = null;
let linking = false; // "L": el siguiente clic en un campamento define el doble stack
let lastT: number | null = null;
let mySide: Side | null = null;

const box = () => $("minimap");
const svg = () => $("mm-svg") as unknown as SVGSVGElement;

// --- Posición y tamaño (cuadrado), guardados ---
function applyRect(r: { left: number; top: number; size: number }) {
  Object.assign(box().style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.size}px`, height: `${r.size}px`, right: "auto", bottom: "auto" });
}
function saveRect() {
  const b = box();
  localStorage.setItem(RECT_KEY, JSON.stringify({ left: b.offsetLeft, top: b.offsetTop, size: b.offsetWidth }));
}

/** Punto del puntero en coordenadas 0-100 del minimapa. */
function toMap(e: { clientX: number; clientY: number }) {
  const r = svg().getBoundingClientRect();
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
  return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
}

/** `target`: elemento que captura el puntero; para campamentos es el SVG, porque render() reemplaza los círculos. */
function dragging(e: PointerEvent, onMove: (ev: PointerEvent) => void, target = e.target as Element) {
  target.setPointerCapture(e.pointerId);
  target.addEventListener("pointermove", onMove as EventListener);
  target.addEventListener("pointerup", () => {
    target.removeEventListener("pointermove", onMove as EventListener);
    saveCamps(camps);
    saveRect();
  }, { once: true });
}

// --- Dibujo ---
const COLOR = { stack: "#e3c77c", double: "#e3c77c", pull: "#6fd36a" };

function arrow(x: number, y: number, dx: number, dy: number, kind: keyof typeof COLOR, ph: Phase, dashed = false) {
  return `<line class="arr ${ph}" x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="${COLOR[kind]}"
    stroke-width="0.9" ${dashed ? 'stroke-dasharray="1.5 1"' : ""} marker-end="url(#ah-${kind})" />`;
}

function render() {
  const t = lastT;
  const byId = new Map(camps.map((c) => [c.id, c]));
  const visible = camps.filter((c) => editing || !mySide || c.side === mySide || c.side === "river");
  let out = "";
  for (const c of visible) {
    const edit: Step = { ph: "soon", left: Infinity };
    const st = editing ? { stack: edit, double: edit, pull: edit } : t === null ? null : campState(c, t);
    if (!st) continue;
    const sel = editing && c.id === selected ? " sel" : "";
    // Etiqueta: el segundo (:53) mientras te preparas; cuenta regresiva en los últimos 10 s.
    const lbl = (s: Step, at: number) => (s.ph === "soon" && s.left !== Infinity ? `${Math.ceil(s.left)}` : `:${at}`);
    if (st.stack.ph !== "hidden") out += arrow(c.x, c.y, c.dx, c.dy, "stack", st.stack.ph);
    const to = c.double && byId.get(c.double.to);
    if (to && st.double.ph !== "hidden") {
      out += arrow(c.x, c.y, (to.x - c.x) * 0.85, (to.y - c.y) * 0.85, "double", st.double.ph, true);
      out += `<text class="lbl ${st.double.ph}" x="${(c.x + to.x) / 2}" y="${(c.y + to.y) / 2 - 1.2}">${lbl(st.double, c.double!.at)}</text>`;
    }
    if (c.pull && st.pull.ph !== "hidden") {
      out += arrow(c.x, c.y, c.pull.dx, c.pull.dy, "pull", st.pull.ph);
      out += `<text class="lbl pull ${st.pull.ph}" x="${c.x + c.pull.dx}" y="${c.y + c.pull.dy + 3}">${lbl(st.pull, c.pull.at)}</text>`;
    }
    if (st.stack.ph !== "hidden" || st.pull.ph !== "hidden" || editing) {
      out += `<circle class="camp ${c.type} ${st.stack.ph}${sel}" data-camp="${c.id}" cx="${c.x}" cy="${c.y}" r="${c.type === "ancient" ? 2.2 : 1.7}" />`;
      if (st.stack.ph !== "hidden") out += `<text class="lbl ${st.stack.ph}" x="${c.x}" y="${c.y - 2.8}">${lbl(st.stack, c.at)}</text>`;
    }
    if (editing) {
      out += `<circle class="handle" data-head="stack" data-camp="${c.id}" cx="${c.x + c.dx}" cy="${c.y + c.dy}" r="1.4" />`;
      if (c.pull) out += `<circle class="handle pull" data-head="pull" data-camp="${c.id}" cx="${c.x + c.pull.dx}" cy="${c.y + c.pull.dy}" r="1.4" />`;
    }
  }
  $("mm-layer").innerHTML = out;
  renderInfo();
}

function renderInfo() {
  const info = $("mm-info");
  if (!editing) return void (info.textContent = "");
  const c = camps.find((x) => x.id === selected);
  const head = c
    ? `${TYPE_LABEL[c.type]} · ${c.side} · stack :${c.at}` +
      (c.double ? ` · doble → :${c.double.at}` : "") +
      (c.pull ? ` · pull :${c.pull.at} (impares)` : "")
    : "Clic en un campamento para editarlo · doble clic en vacío: nuevo";
  const keys = linking
    ? "Clic en el campamento al que se hace el doble stack (Esc cancela)"
    : "Arrastra campamento/punta · +/− segundo · T tipo · P pull · ,/. seg. pull · L doble · [/] seg. doble · Supr borrar";
  info.replaceChildren(
    Object.assign(document.createElement("div"), { textContent: head }),
    Object.assign(document.createElement("div"), { className: "keys", textContent: keys }),
    Object.assign(document.createElement("button"), {
      textContent: "Restablecer campamentos",
      onclick: () => { resetCamps(); camps = defaultCamps(); selected = null; render(); },
    }),
  );
}

// --- Edición ---
function update(fn: (c: Camp) => void) {
  const c = camps.find((x) => x.id === selected);
  if (!c) return;
  fn(c);
  saveCamps(camps);
  render();
}

function onPointerDown(e: PointerEvent) {
  if (!editing) return;
  const el = e.target as Element;
  const id = el.getAttribute("data-camp");
  if (!id) return;
  e.stopPropagation();
  const c = camps.find((x) => x.id === id)!;
  if (linking && el.classList.contains("camp")) {
    linking = false;
    if (selected && selected !== id) update((s) => (s.double = { to: id, at: s.double?.at ?? s.at + 2 }));
    return;
  }
  selected = id;
  const head = el.getAttribute("data-head");
  dragging(e, (ev) => {
    const p = toMap(ev);
    if (head === "stack") { c.dx = p.x - c.x; c.dy = p.y - c.y; }
    else if (head === "pull" && c.pull) { c.pull.dx = p.x - c.x; c.pull.dy = p.y - c.y; }
    else { c.x = p.x; c.y = p.y; }
    render();
  }, svg());
  render();
}

function onDblClick(e: MouseEvent) {
  if (!editing || (e.target as Element).getAttribute("data-camp")) return;
  const p = toMap(e);
  const side: Side = p.y > p.x ? "radiant" : "dire"; // debajo de la diagonal = Radiant
  const c: Camp = { id: `u-${Date.now()}`, side, type: "medium", x: p.x, y: p.y, dx: 5, dy: -5, at: DEFAULT_AT.medium };
  camps.push(c);
  selected = c.id;
  saveCamps(camps);
  render();
}

function onKey(e: KeyboardEvent) {
  if (!editing || !selected || (e.target as Element).tagName === "INPUT") return;
  if (document.querySelector(".keybind .capturing")) return; // se está asignando un atajo: la tecla no es para el editor
  const k = e.key.toLowerCase();
  const sec = (v: number) => Math.min(59, Math.max(0, v));
  if (k === "escape" && linking) { linking = false; renderInfo(); e.stopPropagation(); return; }
  if (k === "+" || k === "=") update((c) => (c.at = sec(c.at + 1)));
  else if (k === "-") update((c) => (c.at = sec(c.at - 1)));
  else if (k === "t") update((c) => (c.type = TYPES[(TYPES.indexOf(c.type) + 1) % TYPES.length]));
  else if (k === "p") update((c) => (c.pull = c.pull ? undefined : { at: c.type === "small" ? 17 : 15, dx: 0, dy: 8 }));
  else if (k === ",") update((c) => c.pull && (c.pull.at = sec(c.pull.at - 1)));
  else if (k === ".") update((c) => c.pull && (c.pull.at = sec(c.pull.at + 1)));
  else if (k === "[") update((c) => c.double && (c.double.at = sec(c.double.at - 1)));
  else if (k === "]") update((c) => c.double && (c.double.at = sec(c.double.at + 1)));
  else if (k === "l") {
    const c = camps.find((x) => x.id === selected)!;
    if (c.double) update((x) => (x.double = undefined)); // L sobre uno con doble lo quita
    else { linking = true; renderInfo(); }
  } else if (k === "delete" || k === "supr") {
    camps = camps.filter((c) => c.id !== selected).map((c) => (c.double?.to === selected ? { ...c, double: undefined } : c));
    selected = null;
    saveCamps(camps);
    render();
  }
}

export function initMinimap() {
  const saved = localStorage.getItem(RECT_KEY);
  if (saved) applyRect(JSON.parse(saved));
  svg().addEventListener("pointerdown", onPointerDown);
  svg().addEventListener("dblclick", onDblClick);
  addEventListener("keydown", onKey, true);

  // Mover el recuadro por su barra y escalarlo por la esquina (solo en modo mover).
  $("mm-bar").addEventListener("pointerdown", (e) => {
    if (!editing) return;
    const b = box();
    const dx = e.clientX - b.offsetLeft;
    const dy = e.clientY - b.offsetTop;
    dragging(e, (ev) => applyRect({ left: ev.clientX - dx, top: ev.clientY - dy, size: b.offsetWidth }));
  });
  $("mm-resize").addEventListener("pointerdown", (e) => {
    if (!editing) return;
    e.stopPropagation();
    const b = box();
    dragging(e, (ev) => applyRect({ left: b.offsetLeft, top: b.offsetTop, size: Math.max(120, ev.clientX - b.getBoundingClientRect().left) }));
  });
  render();
}

export function setMinimapEditing(on: boolean) {
  editing = on;
  linking = false;
  box().classList.toggle("editing", on);
  render();
}

/** En cada tick de GSI: reloj y tu lado (para mostrar solo tus campamentos). */
export function updateMinimap(t: number, side: string | undefined) {
  const s = side === "radiant" || side === "dire" ? side : null;
  // Redibujar solo al cambiar de segundo o de lado (GSI llega cada 0.1 s).
  if (lastT !== null && Math.floor(lastT) === Math.floor(t) && s === mySide) return;
  lastT = t;
  mySide = s;
  if (!editing) render();
}
