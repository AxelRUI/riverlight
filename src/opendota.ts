// URL de la API de OpenDota con la clave opcional de Configuración (sin clave también funciona, con menos límite).
import { invoke } from "@tauri-apps/api/core";

const BASE = "https://api.opendota.com/api";
let key: Promise<string> | null = null;

export async function od(path: string): Promise<string> {
  key ??= invoke<{ opendota_key: string }>("get_config")
    .then((c) => c.opendota_key ?? "")
    .catch(() => "");
  const k = await key;
  return k ? `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(k)}` : BASE + path;
}
