# Dota Plus Local

Overlay ligero (Tauri 2 + TypeScript sin framework) encima de Dota 2, alimentado por **Game State Integration** (oficial de Valve, sin riesgo de VAC).

## Configuración (una sola vez)

1. Copia `gsi/gamestate_integration_dotapluslocal.cfg` a
   `...\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\` (crea la carpeta si no existe).
2. En Steam → Dota 2 → Propiedades → Opciones de lanzamiento agrega: `-gamestateintegration`
3. En Dota pon **Modo de ventana: Ventana sin bordes**. Con pantalla completa exclusiva el overlay no se ve.

## Desarrollo

```
npm install
npm run tauri dev
```

El overlay deja pasar todos los clics al juego y solo aparece durante la partida.

## OBS

La "Captura de juego" de Dota no incluye el overlay. Agrega una **Captura de ventana** de "Dota Plus Local" encima, con "Permitir transparencia" activado.
