# Shatter

Shatter is a fast, top-down gravity-well rock shooter. Pilot an inertial ship through a wrapping starfield, curve gunfire around the central star, break armored rocks through three generations, and save a guided torpedo for the targets that refuse to die. Enemy saucers arrive to hunt as the waves grow denser and faster.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Create the self-contained static production site in `dist/` with:

```sh
npm run build
```

## Controls

- Arrow keys or WASD: turn and thrust
- Space: fire
- F: launch the homing torpedo
- Enter: select a menu item
- Escape or P: pause, resume, or go back
- M: mute
- Backtick: toggle diagnostics

Run `npm test` for the simulation tests. `npm run typecheck`, `npm run lint`, and `npm run format` run the remaining repository checks.
