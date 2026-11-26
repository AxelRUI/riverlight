// Ventana de configuración: instalar GSI, claves de API y arrancar con Windows.
import { invoke } from "@tauri-apps/api/core";
import { keyOf, pretty } from "./keys";

type Config = { stratz_set: boolean; opendota_key: string; autostart: boolean; dev: boolean };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = (id: string, text: string, ok = true) => {
  const e = $(id);
  e.textContent = text;
  e.className = ok ? "ok" : "bad";
};
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// --- 1. GSI ---
async function refreshGsi() {
  try {
    const s = await invoke<{ path: string; installed: boolean }>("gsi_status");
    msg("gsi-status", s.installed ? "Instalado ✓" : "No instalado", s.installed);
    $("gsi-status").title = s.path;
    $("gsi-install").textContent = s.installed ? "Reinstalar" : "Instalar";
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
    $("copy-launch").textContent = "Copiado ✓";
  } catch {
    getSelection()?.selectAllChildren($("launch")); // sin portapapeles: dejarlo seleccionado para Ctrl+C
    $("copy-launch").textContent = "Ctrl+C";
  }
  setTimeout(() => ($("copy-launch").textContent = "Copiar"), 1500);
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
    msg("keys-msg", "Guardado ✓ · se aplica al abrir Dota de nuevo");
  } catch (e) {
    msg("keys-msg", errText(e), false);
  }
};

// --- 3. Arrancar con Windows ---
const autostart = $<HTMLInputElement>("autostart");
autostart.onchange = async () => {
  try {
    await invoke("set_autostart", { enabled: autostart.checked });
    msg("autostart-msg", autostart.checked ? "Se abrirá en reposo al iniciar sesión ✓" : "Ya no arranca con Windows");
  } catch (e) {
    autostart.checked = !autostart.checked;
    msg("autostart-msg", errText(e), false);
  }
};

async function load() {
  const c = await invoke<Config>("get_config");
  stratz.placeholder = c.stratz_set ? "Guardada ✓ (escribe otra para reemplazarla)" : "Pega aquí tu token de STRATZ";
  opendota.value = c.opendota_key;
  opendota.placeholder = "Opcional";
  autostart.checked = c.autostart;
  if (c.dev) msg("autostart-msg", "En desarrollo no se puede: usa el .exe compilado.", false);
}

// --- 4. Atajos actuales (los mismos que se configuran en el modo mover) ---
$("shortcuts").textContent =
  `${pretty(keyOf("edit"))} mover/ajustar paneles y cambiar atajos · ${pretty(keyOf("draft"))} draft y enemigos · ` +
  `${pretty(keyOf("post"))} historial de partidas · ${pretty(keyOf("shop"))} tienda (items).`;

load();
refreshGsi();
