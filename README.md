# Dota Plus Local

A lightweight, local Dota 2 companion overlay: item and skill builds, counter items, timers, a stacking guide on the minimap, live benchmarks and post-game analysis.

![Platform](https://img.shields.io/badge/platform-Windows-0078D6)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)
![Rust](https://img.shields.io/badge/Rust-stable-CE422B)
![TypeScript](https://img.shields.io/badge/TypeScript-no%20framework-3178C6)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Dota Plus Local reads Dota 2 through **Game State Integration (GSI)**, Valve's official game-data feed, so it never touches game memory. Hero and item data come from the public [OpenDota](https://www.opendota.com) and [STRATZ](https://stratz.com) APIs. The interface is available in **English and Spanish**.

> [!NOTE]
> This is an independent, community project. It is not affiliated with or endorsed by Valve, OpenDota or STRATZ. "Dota 2" and "Dota Plus" are trademarks of Valve Corporation.

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Privacy](#privacy)
- [Streaming with OBS](#streaming-with-obs)
- [Development](#development)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Features

### In game

| Feature | Description |
|---|---|
| **Item suggestions** | Most-bought items for your hero and the current game phase, from OpenDota and STRATZ (filtered by your role). Adapts to your purchases: components bring up what they build into, and owned items and duplicate boots are dropped. |
| **Counter items** | For each enemy you enter, the items that counter it for your hero and role, plus a priority row for items that counter several enemies at once. |
| **Skill build** | What to level next, based on high-MMR games for your hero and role, with talent suggestions. Highlights unspent skill points. |
| **Live benchmarks** | Your GPM, XPM, last hits and K/D/A as percentiles against players of the same hero (from 10:00). |
| **Timers** | Bounty, power and wisdom runes, lotus, neutral stacks, Roshan (8–11 min window) and Tormentor. |
| **Stacking guide** | Arrows on the minimap showing where and when to stack or pull each camp, including double stacks, with a 20 s heads-up and a 10 s countdown. |

### Before and after the game

| Feature | Description |
|---|---|
| **Draft helper** | Hero recommendations for your role against the enemy picks you type in. |
| **Post-game summary** | Percentiles, damage taken by type and by hero, and a breakdown of every death (killer, ability or item, gold lost). |
| **Match history** | Your last 24 matches, listed by date, hero, result and K/D/A. You can also look up any public match by ID. |

### App

| Feature | Description |
|---|---|
| **Runs in the background** | Sits in the system tray, shows the overlay only while Dota is running, and can start with Windows. |
| **Customizable** | Every panel can be moved, resized and made transparent. Shortcuts can be rebound, including mouse buttons. |

## How it works

```
Dota 2 ──(GSI, localhost:52700)──► Rust backend ──(events)──► Overlay (WebView)
                                        │                         │
                                        └── STRATZ API            └── OpenDota API
```

- **Rust backend (Tauri 2):**
  - Receives GSI updates on `127.0.0.1` only.
  - Manages global shortcuts and the tray.
  - Calls STRATZ, so your token never reaches the web layer.
  - Creates the overlay window only while the Dota window exists.
- **Overlay:** a transparent, click-through window in plain TypeScript, with no UI framework.

> [!IMPORTANT]
> GSI doesn't send enemy picks or incoming damage to players. Enemy heroes are entered manually (Draft mode), and death details come from the post-game analysis.

## Requirements

- Windows 10 or 11 with [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/), which ships with Windows 11.
- Dota 2 running in **Borderless Window** mode. The overlay can't draw over exclusive fullscreen.
- A free [STRATZ API token](https://stratz.com/api), used for role builds, skill builds and post-game analysis.
- Optional: an [OpenDota API key](https://www.opendota.com/api-keys) for higher rate limits.

## Installation

Download the latest installer (`*-setup.exe` or `.msi`) from the [Releases](../../releases) page and run it.

> [!TIP]
> The installer isn't code-signed, so Windows SmartScreen may warn you. Choose **More info → Run anyway**.

To build from source instead, see [Development](#development).

## Setup

The **Settings** window opens on first launch. You can reopen it from the tray icon, or by launching the app again.

1. **Connect to Dota:** click **Install**. It writes the GSI config file into your Dota folder, searching every Steam library.
2. **Steam launch option:**
   - In Steam, go to **Library → right-click Dota 2 → Properties → General → Launch Options**.
   - Add `-gamestateintegration` (the Settings window has a **Copy** button for it).
3. **API keys:** paste your STRATZ token, and optionally an OpenDota key.
4. **Startup:** enable **Start with Windows** if you want the app to wait in the tray.
5. **Language:** choose English or Spanish.
6. **In Dota:**
   - Set **Options → Video → Display Mode** to **Borderless Window**.
   - For post-game analysis, enable **Options → Social → Expose Public Match Data**.
   - Restart Dota if it was already running, because it only reads the GSI file at launch.

## Usage

### Shortcuts

Defaults below. Every shortcut can be changed in **Move mode**, including mouse buttons (wheel, Mouse 4, Mouse 5).

| Shortcut | Action |
|---|---|
| `Ctrl` + `Shift` + `M` | **Move mode.** Drag, resize and set the opacity of panels; align the minimap; rebind shortcuts. |
| `Ctrl` + `Shift` + `D` | **Draft mode.** Type enemy heroes (`Enter` adds, `1`–`5` sets your role, `Backspace` removes). Type `rosh` or `torm` to log a kill. |
| `Ctrl` + `Shift` + `P` | **Match summary and history** (click or `↑`/`↓` to pick a match). |
| `F4` | Shows the Items panel together with Dota's shop. Use the same key as your in-game shop. |
| `Esc` | Leave the current mode and give mouse input back to the game. |

### Stacking guide on the minimap

The first time, open Move mode and align the minimap box so the circles sit on the camp icons. Camp positions and timings come from public guides and can be adjusted there:

| In Move mode | Action |
|---|---|
| Drag a camp / arrow tip | Move the camp / change the pull direction |
| Double-click an empty spot | Add a camp |
| `+` / `−` | Stack second |
| `T` | Cycle the camp type |
| `P`, then `,` / `.` | Toggle the lane pull / set its second |
| `L`, then click a camp; `[` / `]` | Link a double stack / set its second |
| `Del` | Delete the camp |

## Privacy

- **API keys** are stored locally in `%APPDATA%\app.dotapluslocal\config.json`. They're only sent to the service they belong to, and the STRATZ token never leaves the Rust backend.
- **Preferences and match history** stay on your machine. This includes panel layout, shortcuts, the match list and cached match data.
- **Network requests** go only to `api.stratz.com`, `api.opendota.com`, `cdn.jsdelivr.net` (game constants) and `cdn.cloudflare.steamstatic.com` (hero and item icons).
- **No telemetry:** the app has no telemetry and no accounts.

## Streaming with OBS

Dota's *Game Capture* doesn't include the overlay. Add a **Window Capture** source for **"Dota Plus Local"** above the game and enable **Allow Transparency**.

## Development

**Prerequisites:**
- [Node.js](https://nodejs.org) 20 or newer.
- [Rust](https://rustup.rs) (stable).
- The [Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev     # overlay opens immediately, no Dota needed
npm run tauri build   # installers in src-tauri/target/release/bundle/
```

You can also set the STRATZ token through the `STRATZ_TOKEN` environment variable during development.

### Project structure

```
├── index.html             Overlay page
├── admin.html             Settings window
├── gsi/                   GSI config file installed into Dota
├── src/
│   ├── main.ts            Overlay wiring: GSI events, panels, modes
│   ├── items.ts           Item suggestions (OpenDota + STRATZ)
│   ├── counters.ts        Counter-item table per enemy hero
│   ├── skills.ts          Skill builds from STRATZ guide games
│   ├── benchmarks.ts      Live percentiles (OpenDota)
│   ├── draft.ts           Draft helper and enemy input
│   ├── stacks.ts          Camp data and stack timing
│   ├── minimap.ts         Minimap overlay and camp editor
│   ├── post.ts            Post-game summary and match history
│   ├── timers.ts          Rune, Roshan and Tormentor timers
│   ├── keys.ts            Configurable shortcuts
│   ├── i18n.ts            English / Spanish strings
│   └── admin.ts           Settings window logic
└── src-tauri/src/
    ├── lib.rs             GSI server, shortcuts, tray, overlay lifecycle, STRATZ client
    └── admin.rs           Settings: config file, autostart, GSI installer
```

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

When adding UI text, write it in Spanish (the translation key) and add the English version to `src/i18n.ts`.

## Acknowledgements

- [Valve](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration) for Game State Integration.
- [OpenDota](https://www.opendota.com) and [STRATZ](https://stratz.com) for their public APIs.
- [odota/dotaconstants](https://github.com/odota/dotaconstants) for hero, item and ability data.
- u/Bu3nyy for the ranged-hero stacking map used as the base for camp routes.

## License

Released under the [MIT License](LICENSE).
