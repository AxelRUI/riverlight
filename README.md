# Dota Plus Local

Overlay ligero (Tauri 2 + TypeScript sin framework) encima de Dota 2, alimentado por **Game State Integration** (oficial de Valve, sin riesgo de VAC).

## Instalar (para compartir con amigos)

1. Compila el instalador: `npm run tauri build` → `src-tauri\target\release\bundle\nsis\*-setup.exe` (o `msi\*.msi`). Eso es lo que se comparte.
2. Al abrir la app la primera vez se abre **Configuración** (también desde el ícono de la bandeja, o abriendo el .exe otra vez):
   - **Instalar** copia el archivo GSI a la carpeta de Dota (la busca en todas las bibliotecas de Steam).
   - Copia `-gamestateintegration` a **Steam → Dota 2 → Propiedades → Opciones de lanzamiento**.
   - Pega la clave de **STRATZ** (gratis en stratz.com/api) y, si quieres, la de **OpenDota** (opcional).
   - Activa **Arrancar con Windows**.
3. En Dota: **Ventana sin bordes** (en pantalla completa exclusiva el overlay no se ve) y **Exponer datos públicos de partidas** para el resumen post-partida.

La app vive en la bandeja en reposo (sin ventana) y crea el overlay solo cuando detecta la ventana de Dota; al cerrar Dota lo destruye. "Salir" en la bandeja la cierra del todo. En desarrollo (`npm run tauri dev`) el overlay se abre al instante para probar sin Dota.

Las claves se guardan en `%APPDATA%\app.dotapluslocal\config.json` (no en el repo). La variable `STRATZ_TOKEN` sigue funcionando como respaldo.

## Sugerencias de items

Salen de dos fuentes a la vez, cada una en su fila: **OpenDota** (sin configuración) y **STRATZ**.
Si una falla se sigue viendo la otra; si fallan las dos, el panel muestra el error de cada una.

STRATZ necesita un token gratuito (stratz.com/api): se pone en Configuración.

## Atajos

Todos se cambian en el modo mover: en la barra de arriba haz clic en el atajo y presiona la tecla nueva (Esc cancela). Mover, Draft y Resumen necesitan Ctrl, Alt o Shift para no robarle teclas al juego; la tecla de tienda va sola y Dota la sigue recibiendo. Cualquiera acepta también rueda, Mouse 4 o Mouse 5 (se leen sin bloquearlos). Abajo, los valores por defecto.

| Atajo | Qué hace |
|---|---|
| `Ctrl+Shift+M` | Modo mover: arrastrar cada panel (Asistente, Items, minimapa); los sliders de tamaño y opacidad aplican al último panel que tocaste |
| `Ctrl+Shift+D` | Modo draft: escribir picks enemigos (Enter agrega, 1-5 cambia tu rol, Retroceso quita el último) |
| `Esc` | Salir del modo y devolver los clics al juego |
| `Ctrl+Shift+P` | Resumen e historial de partidas (clic o ↑/↓ para elegir, Esc cierra) |
| `F4` (tecla de tienda de Dota) | Muestra/oculta los items (sugeridos, counters y prioridad) junto con la tienda. `Esc` también los oculta. Abrir la tienda con el mouse no se detecta. |

En modo draft también se puede escribir `rosh` o `torm` + Enter para marcar que Roshan o el Tormentor murieron (si GSI no lo detecta solo). Los enemigos que agregues a media partida alimentan la sección "Contra enemigos" (enemigo → items según tu héroe y rol).

Durante la selección de héroes el panel muestra recomendaciones según tu rol y los enemigos que escribiste (matchups de OpenDota). Dota no le pasa los picks enemigos al jugador por GSI, por eso se escriben a mano.

## Resumen post-partida

Al terminar una partida, la app pide el análisis a STRATZ (reintenta cada minuto hasta ~20 min) y muestra solo el resumen cuando está listo:
resultado, IMP, tus GPM/XPM/LH/daño por minuto contra jugadores de tu héroe (percentil), daño recibido por tipo (físico/mágico/puro) y por héroe,
y cada muerte (minuto, quién te mató, con qué habilidad o item, oro perdido, tiempo muerto, si fue burst).

`Ctrl+Shift+P` abre el historial de tus últimas 24 partidas (fecha, héroe, victoria/derrota, K/D/A, IMP): elige una con clic o ↑/↓, o escribe un ID de partida para ver cualquiera pública. Las ya analizadas se guardan y no se vuelven a pedir. `Esc` cierra.

Requiere activar en Dota *Opciones → Social → Exponer datos públicos de partidas*. Las partidas de práctica/lobby con bots no llegan a STRATZ.

## Comparativa en vivo

Desde el 10:00, bajo LH, GPM, XPM y K/D/A aparece tu percentil contra jugadores del mismo héroe (OpenDota `/benchmarks`): verde ≥ p60, dorado p40-59, rojo < p40. Son promedios de final de partida y mezclan posiciones, por eso no se muestra antes del minuto 10.

## Build de habilidades

En partida, el panel muestra qué habilidad subir (y las 4 siguientes) según el orden de partidas guía de alto MMR en STRATZ para tu héroe y tu rol del draft. Si tienes puntos sin gastar, el ícono parpadea en dorado ("Sube: …"). Si te sales del orden, se ajusta a lo que ya subiste. Al llegar a 10/15/20/25 sugiere el talento. Requiere `STRATZ_TOKEN`.

## Stacks y pulls en el minimapa

20 s antes de cada stack aparecen sobre el minimapa el círculo y la flecha tenue de tus campamentos (hacia dónde jalar y el segundo, p. ej. `:53`); 10 s antes se marcan con cuenta regresiva y en el segundo exacto parpadean. Las punteadas son dobles stacks (primer campamento y luego el segundo, p. ej. :53 → :55). En minutos impares salen flechas verdes de pull a la línea (:15-:22).

Primera vez: `Ctrl+Shift+M` y alinea el recuadro con tu minimapa (arrastra la barra, escala con la esquina dorada). Las posiciones vienen aproximadas de guías públicas; corrígelas ahí mismo:

| En modo mover | Qué hace |
|---|---|
| Arrastrar campamento / punta de flecha | Mover campamento / cambiar dirección |
| Doble clic en vacío | Nuevo campamento |
| `+` / `−` | Segundo del stack |
| `T` | Tipo (pequeño, mediano, grande, ancestral) |
| `P`, luego `,` / `.` | Activar pull a la línea y su segundo |
| `L` + clic en otro campamento, luego `[` / `]` | Doble stack y segundo del segundo campamento (`L` de nuevo lo quita) |
| `Supr` | Borrar campamento |

## Desarrollo

```
npm install
npm run tauri dev
```

El overlay deja pasar todos los clics al juego y solo aparece durante la partida.

## OBS

La "Captura de juego" de Dota no incluye el overlay. Agrega una **Captura de ventana** de "Dota Plus Local" encima, con "Permitir transparencia" activado.
