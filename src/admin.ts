// Ventana de configuración: instalar GSI, claves de API, arrancar con Windows e idioma.
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { LANG, Lang, applyI18n, setLang, t } from "./i18n";
import { keyOf, pretty } from "./keys";

type Config = { stratz_set: boolean; opendota_key: string; autostart: boolean; dev: boolean };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = (id: string, text: string, ok = true) => {
  const e = $(id);
  e.textContent = text;
  e.className = ok ? "ok" : "bad";
};
// Los errores de Rust vienen en español (clave de traducción): se traducen al mostrarlos.
const errText = (e: unknown) => t(e instanceof Error ? e.message : String(e));

applyI18n();
document.title = `Dota Plus Local · ${t("Configuración")}`;

// --- 1. GSI ---
async function refreshGsi() {
  try {
    const s = await invoke<{ path: string; installed: boolean }>("gsi_status");
    msg("gsi-status", s.installed ? t("Instalado ✓") : t("No instalado"), s.installed);
    $("gsi-status").title = s.path;
    $("gsi-install").textContent = s.installed ? t("Reinstalar") : t("Instalar");
  } catch (e) {
    msg("gsi-status", errText(e), false);
  }
}
$("gsi-install").onclick = async () => {
  try {
    await invoke("gsi_install");
    await refreshGsi();
  } catch (e) {
    msg("gsi-status", errText(e), false);
  }
};
$("copy-launch").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("launch").textContent ?? "");
    $("copy-launch").textContent = t("Copiado ✓");
  } catch {
    getSelection()?.selectAllChildren($("launch")); // sin portapapeles: dejarlo seleccionado para Ctrl+C
    $("copy-launch").textContent = "Ctrl+C";
  }
  setTimeout(() => ($("copy-launch").textContent = t("Copiar")), 1500);
};

// --- 2. Claves (STRATZ nunca vuelve al frontend: solo se sabe si está puesta) ---
const stratz = $<HTMLInputElement>("stratz");
const opendota = $<HTMLInputElement>("opendota");
$("toggle-stratz").onclick = () => (stratz.type = stratz.type === "password" ? "text" : "password");
$("save-keys").onclick = async () => {
  try {
    await invoke("set_keys", {
      stratzToken: stratz.value.trim() || null, // vacío = dejar la que ya está
      opendotaKey: opendota.value.trim(),
    });
    stratz.value = "";
    await load();
    msg("keys-msg", t("Guardado ✓ · se aplica al abrir Dota de nuevo"));
  } catch (e) {
    msg("keys-msg", errText(e), false);
  }
};

// --- 3. Arrancar con Windows ---
const autostart = $<HTMLInputElement>("autostart");
autostart.onchange = async () => {
  try {
    await invoke("set_autostart", { enabled: autostart.checked });
    msg("autostart-msg", autostart.checked ? t("Se abrirá en reposo al iniciar sesión ✓") : t("Ya no arranca con Windows"));
  } catch (e) {
    autostart.checked = !autostart.checked;
    msg("autostart-msg", errText(e), false);
  }
};

async function load() {
  const c = await invoke<Config>("get_config");
  stratz.placeholder = c.stratz_set ? t("Guardada ✓ (escribe otra para reemplazarla)") : t("Pega aquí tu token de STRATZ");
  opendota.value = c.opendota_key;
  opendota.placeholder = t("Opcional");
  autostart.checked = c.autostart;
  if (c.dev) msg("autostart-msg", t("En desarrollo no se puede: usa el .exe compilado."), false);
}

// --- 4. Atajos actuales (los mismos que se configuran en el modo mover) ---
$("shortcuts").textContent = t(
  "{edit} mover/ajustar paneles y cambiar atajos · {draft} draft y enemigos · {post} historial de partidas · {shop} tienda (items).",
  { edit: pretty(keyOf("edit")), draft: pretty(keyOf("draft")), post: pretty(keyOf("post")), shop: pretty(keyOf("shop")) },
);

// --- 5. Idioma: se guarda, Rust actualiza el menú de la bandeja y el overlay se recarga ---
const lang = $<HTMLSelectElement>("lang");
lang.value = LANG;
lang.onchange = async () => {
  setLang(lang.value as Lang);
  await invoke("set_lang", { lang: lang.value }).catch(() => {});
  await emit("lang-changed");
  location.reload();
};
invoke("set_lang", { lang: LANG }).catch(() => {}); // la bandeja usa el mismo idioma desde el arranque

load();
refreshGsi();
