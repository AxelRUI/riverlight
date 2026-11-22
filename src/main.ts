import { listen } from "@tauri-apps/api/event";
import { EVENTS, fmt, nextAt } from "./timers";

type Gsi = {
  map?: { clock_time: number; game_state: string };
  player?: { last_hits: number; denies: number; gpm: number; xpm: number };
};

const IN_GAME = ["DOTA_GAMERULES_STATE_PRE_GAME", "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS"];
const $ = (id: string) => document.getElementById(id)!;

listen<Gsi>("gsi", ({ payload: { map, player } }) => {
  const hud = $("hud");
  hud.hidden = !map || !IN_GAME.includes(map.game_state);
  if (hud.hidden || !map) return;

  if (player) {
    $("lhdn").textContent = `${player.last_hits} / ${player.denies}`;
    $("gpm").textContent = String(player.gpm);
    $("xpm").textContent = String(player.xpm);
  }

  const t = map.clock_time;
  $("timers").innerHTML = EVENTS.map((e) => {
    const left = nextAt(t, e.start, e.every) - t;
    return `<li class="${left <= 10 ? "soon" : ""}"><span>${e.name}</span><time>${fmt(left)}</time></li>`;
  }).join("");
});
