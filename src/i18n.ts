// Idioma de la interfaz (español / inglés). El texto en español es la clave: t("Prioridad") → "Priority" en inglés.
// Se elige en Configuración; se guarda en localStorage (compartido por el overlay y la ventana de configuración).
export type Lang = "es" | "en";

const saved = localStorage.getItem("lang");
export const LANG: Lang = saved === "es" || saved === "en" ? saved : navigator.language.startsWith("es") ? "es" : "en";

export const setLang = (l: Lang) => localStorage.setItem("lang", l);

const EN: Record<string, string> = {
  // Paneles (index.html)
  Asistente: "Assistant",
  Sugeridos: "Suggested",
  "Contra enemigos": "Vs enemies",
  Habilidades: "Skills",
  "Tu rol": "Your role",
  Enemigos: "Enemies",
  "Héroe enemigo… (am, qop, axe)": "Enemy hero… (am, qop, axe)",
  Recomendados: "Recommended",
  "Minimapa · arrastra para alinear": "Minimap · drag to align",
  Tamaño: "Size",
  Opacidad: "Opacity",
  "Arrastra los paneles · Clic: elegir panel para tamaño/opacidad · Doble clic: restablecer ese panel · {key}: fijar":
    "Drag the panels · Click: pick panel for size/opacity · Double-click: reset that panel · {key}: lock",
  "{key}: escribir · Enter: agregar · 1-5: rol · rosh / torm: marcar muerte · Retroceso: quitar · Esc: cerrar":
    "{key}: type · Enter: add · 1-5: role · rosh / torm: mark death · Backspace: remove · Esc: close",
  // Timers
  "Runa de recompensa": "Bounty rune",
  "Runa de poder": "Power rune",
  "Runa de sabiduría": "Wisdom rune",
  Loto: "Lotus",
  "Stack de neutrales": "Neutral stack",
  // Items
  Inicial: "Starting",
  Temprano: "Early",
  Medio: "Mid",
  Tardío: "Late",
  "Completar: {name}": "Complete: {name}",
  "{error}. Reintento en 30 s.": "{error}. Retrying in 30 s.",
  "{key} para agregar enemigos": "{key} to add enemies",
  Prioridad: "Priority",
  "{name} · sirve contra {n} enemigos": "{name} · counters {n} enemies",
  "{name} · contra {why}": "{name} · vs {why}",
  "STRATZ no devolvió datos para este héroe": "STRATZ returned no data for this hero",
  "{host} respondió {status}": "{host} responded {status}",
  // Rasgos de los counters
  evasión: "evasion",
  pasivas: "passives",
  invisibilidad: "invisibility",
  "daño mágico": "magic damage",
  curación: "healing",
  "ilusiones/unidades": "illusions/units",
  "daño físico": "physical damage",
  control: "disables",
  movilidad: "mobility",
  "ulti a objetivo": "targeted ultimate",
  maná: "mana",
  // Draft
  "Soporte 4": "Support 4",
  "Soporte 5": "Support 5",
  "{name} (clic para quitar)": "{name} (click to remove)",
  "Agrega picks enemigos con {key}": "Add enemy picks with {key}",
  // Habilidades y comparativa
  "Sube: {label}": "Level up: {label}",
  "Siguiente: {label}": "Next: {label}",
  "Talento: {label}": "Talent: {label}",
  "STRATZ no tiene partidas guía de tu héroe en este rol": "STRATZ has no guide games for your hero in this role",
  "las partidas guía no traen orden de habilidades": "guide games have no skill order",
  "Percentil contra jugadores de este héroe (promedios de final de partida, OpenDota)":
    "Percentile vs players of this hero (end-of-game averages, OpenDota)",
  // Atajos
  Tienda: "Shop",
  Mover: "Move",
  Resumen: "Summary",
  "Presiona tecla o botón del mouse…": "Press a key or mouse button…",
  "Ctrl/Alt/Shift + tecla, o botón del mouse…": "Ctrl/Alt/Shift + key, or mouse button…",
  "Esc ya cierra la tienda": "Esc already closes the shop",
  "esa tecla no está soportada": "that key isn't supported",
  "ya lo usa {name}": "already used by {name}",
  "usa Ctrl, Alt o Shift + tecla para no bloquear teclas del juego": "use Ctrl, Alt or Shift + key so game keys aren't blocked",
  "ese atajo ya lo usa otra acción": "another action already uses that shortcut",
  "no se pudo registrar (¿lo usa otro programa?)": "couldn't register it (is another program using it?)",
  // Minimapa
  Pequeño: "Small",
  Mediano: "Medium",
  Grande: "Large",
  Ancestral: "Ancient",
  " · doble → :{at}": " · double → :{at}",
  " · pull :{at} (impares)": " · pull :{at} (odd minutes)",
  "Clic en un campamento para editarlo · doble clic en vacío: nuevo": "Click a camp to edit it · double-click empty space: new",
  "Clic en el campamento al que se hace el doble stack (Esc cancela)": "Click the camp to double-stack into (Esc cancels)",
  "Arrastra campamento/punta · +/− segundo · T tipo · P pull · ,/. seg. pull · L doble · [/] seg. doble · Supr borrar":
    "Drag camp/tip · +/− second · T type · P pull · ,/. pull second · L double · [/] double second · Del delete",
  "Restablecer campamentos": "Reset camps",
  // Resumen post-partida
  "STRATZ todavía no tiene la partida": "STRATZ doesn't have the match yet",
  "no te encontré en esa partida (¿es tuya y con datos públicos?)": "couldn't find you in that match (is it yours, with public data?)",
  "STRATZ todavía no termina de analizarla": "STRATZ hasn't finished analyzing it yet",
  Victoria: "Victory",
  Derrota: "Defeat",
  "Contra jugadores de tu héroe": "Against players of your hero",
  "Daño/min": "Dmg/min",
  Físico: "Physical",
  Mágico: "Magical",
  Puro: "Pure",
  "Físico {p}% · Mágico {m}% · Puro {u}% · stun {s} s": "Physical {p}% · Magical {m}% · Pure {u}% · stun {s} s",
  "Daño recibido · {n}": "Damage taken · {n}",
  "Más daño: ": "Most damage: ",
  ataque: "attack",
  "−{gold} oro · {s} s": "−{gold} gold · {s} s",
  "Muertes · {n}": "Deaths · {n}",
  "Sin muertes 👌": "No deaths 👌",
  V: "W",
  D: "L",
  "ID de partida + Enter": "Match ID + Enter",
  "Partidas · ↑/↓ o clic para elegir · Esc cierra": "Matches · ↑/↓ or click to pick · Esc closes",
  "Última partida · {key}: historial": "Last match · {key}: history",
  "Aún no hay partidas registradas.": "No matches recorded yet.",
  "{msg} (intento {n}/{max})": "{msg} (attempt {n}/{max})",
  "STRATZ no analizó la partida. ¿Tienes activado exponer datos públicos de partidas?":
    "STRATZ didn't analyze the match. Is Expose Public Match Data turned on?",
  "Esperando a que STRATZ analice la partida…": "Waiting for STRATZ to analyze the match…",
  "Cargando…": "Loading…",
  // Mensajes de Rust (configuración y STRATZ)
  "falta la clave de STRATZ (ícono de la bandeja → Configuración)": "missing STRATZ key (tray icon → Settings)",
  "solo en la versión compilada (.exe); en desarrollo registraría la copia de prueba":
    "only in the compiled .exe (in development it would register the test build)",
  "no encontré Steam en este equipo": "Steam not found on this PC",
  "no encontré Dota 2 en tus bibliotecas de Steam": "Dota 2 not found in your Steam libraries",
  // Configuración (admin.html)
  Configuración: "Settings",
  "1 · Conectar con Dota": "1 · Connect to Dota",
  "Archivo de integración (GSI)": "Game State Integration file",
  "Buscando Dota…": "Looking for Dota…",
  Instalar: "Install",
  Reinstalar: "Reinstall",
  "Instalado ✓": "Installed ✓",
  "No instalado": "Not installed",
  "Opción de lanzamiento en Steam": "Steam launch option",
  Copiar: "Copy",
  "Copiado ✓": "Copied ✓",
  "Abre <b>Steam → Biblioteca</b>.": "Open <b>Steam → Library</b>.",
  "Clic derecho en <b>Dota 2 → Propiedades</b>.": "Right-click <b>Dota 2 → Properties</b>.",
  "En <b>General → Opciones de lanzamiento</b>, pega el texto de arriba (si ya hay otras opciones, déjalas y agrega esta separada por un espacio).":
    "In <b>General → Launch Options</b>, paste the text above (if there are other options, keep them and add this one separated by a space).",
  "En Dota, pon <b>Opciones → Video → Modo de ventana: Ventana sin bordes</b>. En pantalla completa el overlay no se ve.":
    "In Dota, set <b>Options → Video → Display Mode: Borderless Window</b>. The overlay can't draw over exclusive fullscreen.",
  "Para el resumen post-partida: <b>Opciones → Social → Exponer datos públicos de partidas</b>.":
    "For the post-game summary: <b>Options → Social → Expose Public Match Data</b>.",
  "Reinicia Dota si estaba abierto (lee el archivo GSI al arrancar).": "Restart Dota if it was open (it reads the GSI file at launch).",
  "2 · Claves de API": "2 · API keys",
  "(builds por rol, habilidades, resumen post-partida)": "(role builds, skill builds, post-game summary)",
  "Mostrar/ocultar": "Show/hide",
  "Gratis: entra a <code>stratz.com/api</code> con tu cuenta de Steam y copia el token.":
    "Free: log in with Steam at <code>stratz.com/api</code> and copy your token.",
  "(opcional: más consultas por día)": "(optional: higher daily limit)",
  "Funciona sin clave. Si quieres más límite: <code>opendota.com/api-keys</code>.":
    "Works without a key. For a higher limit: <code>opendota.com/api-keys</code>.",
  "Guardar claves": "Save keys",
  "Guardado ✓ · se aplica al abrir Dota de nuevo": "Saved ✓ · applies next time Dota opens",
  "Guardada ✓ (escribe otra para reemplazarla)": "Saved ✓ (type a new one to replace it)",
  "Pega aquí tu token de STRATZ": "Paste your STRATZ token here",
  Opcional: "Optional",
  "3 · Inicio": "3 · Startup",
  "Arrancar con Windows": "Start with Windows",
  "(en reposo: el overlay aparece solo al abrir Dota)": "(idle in the tray: the overlay appears only when Dota opens)",
  "Se abrirá en reposo al iniciar sesión ✓": "Will start idle when you sign in ✓",
  "Ya no arranca con Windows": "No longer starts with Windows",
  "En desarrollo no se puede: usa el .exe compilado.": "Not available in development: use the compiled .exe.",
  "4 · Atajos": "4 · Shortcuts",
  "{edit} mover/ajustar paneles y cambiar atajos · {draft} draft y enemigos · {post} historial de partidas · {shop} tienda (items).":
    "{edit} move/resize panels and change shortcuts · {draft} draft and enemies · {post} match history · {shop} shop (items).",
  "Se cambian en el juego, dentro del modo mover.": "Change them in-game, inside Move mode.",
  "La app vive en el ícono de la bandeja (junto al reloj): ahí está Configuración y Salir.":
    "The app lives in the tray icon (next to the clock): Settings and Exit are there.",
  "5 · Idioma": "5 · Language",
};

/** Texto en el idioma actual, con {variables}. Sin traducción: queda el español. */
export function t(es: string, vars: Record<string, string | number> = {}): string {
  const s = LANG === "en" ? EN[es] ?? es : es;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Traduce el HTML estático: data-i18n (texto), data-i18n-html (con <b>/<code>), data-i18n-placeholder, data-i18n-title. */
export function applyI18n(root: ParentNode = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n || e.textContent!.trim())));
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((e) => (e.innerHTML = t(e.dataset.i18nHtml || e.innerHTML.trim())));
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((e) => (e.placeholder = t(e.dataset.i18nPlaceholder!)));
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((e) => (e.title = t(e.dataset.i18nTitle!)));
}

if (import.meta.env.DEV) {
  console.assert(t("{x} y {y}", { x: 1 }) === "1 y {y}", "variables");
}
