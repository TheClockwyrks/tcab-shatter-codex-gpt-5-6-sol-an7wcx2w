import {
  BULLET_LIFE,
  CORE_R,
  FACE_UP,
  FIELD_H,
  FIELD_W,
  ROCK_HEALTH,
  ROCK_RADIUS,
  SAFE_X,
  SAFE_Y,
  SAUCER_BULLET_LIFE,
  SAUCER_FIRE_INTERVAL,
  SAUCER_FIRST_DELAY,
  SAUCER_SPEED,
  SAUCER_WEAVE_INTERVAL,
  SHATTER_DEBUG_VERSION,
  START_LIVES,
  TORPEDO_LIFE,
  TORPEDO_SPEED,
} from "./constants";
import type {
  BulletState,
  ReadState,
  ShatterDebugApi,
  ShatterState,
  ShipState,
  Snapshot,
} from "./types";
import type { RockSize } from "./constants";

export const BACKGROUND = "#050812";
export const MENU_RECTS = [
  { x: 480, y: 420, w: 320, h: 58 },
  { x: 480, y: 492, w: 320, h: 58 },
  { x: 480, y: 564, w: 320, h: 58 },
] as const;
export const shipStart = (invuln = 0): ShipState => ({
  x: SAFE_X,
  y: SAFE_Y,
  vx: 0,
  vy: 0,
  angle: FACE_UP,
  thrusting: false,
  invuln,
  collision: true,
  fireCooldown: 0,
});
export const initialState = (muted = false): ShatterState => ({
  screen: "title",
  menuIndex: 0,
  score: 0,
  lives: START_LIVES,
  wave: 0,
  waveBanner: 0,
  ship: shipStart(),
  bullets: [],
  rocks: [],
  saucer: null,
  enemyBullets: [],
  torpedoes: [],
  torpedoCharge: 1,
  waveSpawning: true,
  saucerSpawning: true,
  saucerClock: 0,
  saucerDue: SAUCER_FIRST_DELAY,
  nextSaucerEdge: null,
  nextSaucerRow: null,
  nextSaucerAim: null,
  nextRockSpeed: null,
  nextRecycleEdge: null,
  tickClock: 0,
  nextId: 1,
  simTime: 0,
  muted,
  extraLifeFlash: 0,
  pointerPress: null,
});
export const clone = (s: ReadState): ShatterState => ({
  ...s,
  ship: { ...s.ship },
  bullets: s.bullets.map((x) => ({ ...x })),
  rocks: s.rocks.map((x) => ({ ...x })),
  saucer: s.saucer ? { ...s.saucer } : null,
  enemyBullets: s.enemyBullets.map((x) => ({ ...x })),
  torpedoes: s.torpedoes.map((x) => ({ ...x })),
});
export const wrap = (n: number, size: number): number =>
  ((n % size) + size) % size;
export const axisDelta = (a: number, b: number, size: number): number =>
  wrap(b - a + size / 2, size) - size / 2;
export const separation = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => ({ x: axisDelta(a.x, b.x, FIELD_W), y: axisDelta(a.y, b.y, FIELD_H) });
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => {
  const d = separation(a, b);
  return Math.hypot(d.x, d.y);
};
export const touching = (
  a: { x: number; y: number },
  ar: number,
  b: { x: number; y: number },
  br: number,
): boolean => distance(a, b) <= ar + br;
const finite = (n: number, name = "value"): number => {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
};
const boolean = (v: boolean): boolean => {
  if (typeof v !== "boolean") throw new Error("enabled must be boolean");
  return v;
};
export function menuCount(screen: string): number {
  return screen === "title"
    ? 2
    : screen === "paused"
      ? 3
      : screen === "gameover"
        ? 2
        : 0;
}
export function snapshot(s: ReadState): Snapshot {
  return {
    version: SHATTER_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    score: s.score,
    lives: s.lives,
    wave: s.wave,
    waveBanner: s.waveBanner,
    muted: s.muted,
    waveSpawning: s.waveSpawning,
    saucerSpawning: s.saucerSpawning,
    saucerClock: s.saucerClock,
    saucerDue: s.saucerDue,
    nextSaucerEdge: s.nextSaucerEdge,
    nextSaucerRow: s.nextSaucerRow,
    nextSaucerAim: s.nextSaucerAim,
    nextRockSpeed: s.nextRockSpeed,
    nextRecycleEdge: s.nextRecycleEdge,
    ship: { ...s.ship, speed: Math.hypot(s.ship.vx, s.ship.vy) },
    bullets: s.bullets.map((x) => ({ ...x })),
    rocks: s.rocks.map(({ id, x, y, vx, vy, size, health }) => ({
      id,
      x,
      y,
      vx,
      vy,
      size,
      health,
      radius: ROCK_RADIUS[size],
    })),
    saucer: s.saucer ? { ...s.saucer } : null,
    enemyBullets: s.enemyBullets.map((x) => ({ ...x })),
    torpedoes: s.torpedoes.map((x) => ({ ...x })),
    torpedoCharge: s.torpedoCharge,
    torpedoReady: s.torpedoCharge === 1,
    simTime: s.simTime,
  };
}
function index<T extends { readonly id: number }>(
  xs: readonly T[],
  id: number,
  name: string,
) {
  finite(id, "id");
  const i = xs.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`${name} id ${id} is not live`);
  return i;
}
export function makeDebug(): ShatterDebugApi {
  const set = (s: ReadState, p: Partial<ShatterState>): ShatterState => ({
    ...clone(s),
    ...p,
  });
  const ship = (s: ReadState, p: Partial<ShipState>) => ({
    ...clone(s),
    ship: { ...s.ship, ...p },
  });
  const saucer = (s: ReadState, p: Record<string, unknown>) => {
    if (!s.saucer) throw new Error("no live saucer");
    return { ...clone(s), saucer: { ...s.saucer, ...p } } as ShatterState;
  };
  const addBullet = (
    s: ReadState,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    key: "bullets" | "enemyBullets",
  ) => {
    const b: BulletState = {
      id: s.nextId,
      x: finite(x),
      y: finite(y),
      vx: finite(vx),
      vy: finite(vy),
      life,
    };
    return set(s, { [key]: [...s[key], b], nextId: s.nextId + 1 });
  };
  return {
    version: SHATTER_DEBUG_VERSION,
    reset: (s) => initialState(s.muted),
    snapshot,
    reconcile: clone,
    menuItemRect: (s, i) =>
      Number.isInteger(i) && i >= 0 && i < menuCount(s.screen)
        ? (MENU_RECTS[i] ?? null)
        : null,
    setScreen: (s, v) => {
      if (!["title", "howto", "playing", "paused", "gameover"].includes(v))
        throw new Error("invalid screen");
      return set(s, { screen: v });
    },
    setMenuIndex: (s, n) => set(s, { menuIndex: finite(n) }),
    setScore: (s, n) => set(s, { score: finite(n) }),
    setLives: (s, n) => set(s, { lives: finite(n) }),
    setWave: (s, n) => set(s, { wave: finite(n) }),
    setWaveBanner: (s, n) => set(s, { waveBanner: finite(n) }),
    setWaveSpawning: (s, v) => set(s, { waveSpawning: boolean(v) }),
    setSaucerSpawning: (s, v) => set(s, { saucerSpawning: boolean(v) }),
    setSaucerDue: (s, n) => set(s, { saucerDue: finite(n) }),
    setShipPosition: (s, x, y) => ship(s, { x: finite(x), y: finite(y) }),
    setShipVelocity: (s, vx, vy) => ship(s, { vx: finite(vx), vy: finite(vy) }),
    setShipAngle: (s, n) => ship(s, { angle: finite(n) }),
    setShipInvuln: (s, n) => ship(s, { invuln: finite(n) }),
    setFireCooldown: (s, n) => ship(s, { fireCooldown: finite(n) }),
    setShipCollision: (s, v) => ship(s, { collision: boolean(v) }),
    addBullet: (s, x, y, vx, vy) =>
      addBullet(s, x, y, vx, vy, BULLET_LIFE, "bullets"),
    removeBullet: (s, id) => {
      index(s.bullets, id, "bullet");
      return set(s, { bullets: s.bullets.filter((x) => x.id !== id) });
    },
    clearBullets: (s) => set(s, { bullets: [] }),
    addEnemyBullet: (s, x, y, vx, vy) =>
      addBullet(s, x, y, vx, vy, SAUCER_BULLET_LIFE, "enemyBullets"),
    removeEnemyBullet: (s, id) => {
      index(s.enemyBullets, id, "enemy bullet");
      return set(s, {
        enemyBullets: s.enemyBullets.filter((x) => x.id !== id),
      });
    },
    clearEnemyBullets: (s) => set(s, { enemyBullets: [] }),
    addRock: (s, z, x, y) => {
      if (!(["large", "medium", "small"] as const).includes(z))
        throw new Error("invalid rock size");
      return set(s, {
        rocks: [
          ...s.rocks,
          {
            id: s.nextId,
            x: finite(x),
            y: finite(y),
            vx: 0,
            vy: 0,
            size: z,
            spin: 0,
            health: ROCK_HEALTH[z],
            flash: 0,
          },
        ],
        nextId: s.nextId + 1,
      });
    },
    setRockVelocity: (s, id, vx, vy) => {
      index(s.rocks, id, "rock");
      return set(s, {
        rocks: s.rocks.map((r) =>
          r.id === id ? { ...r, vx: finite(vx), vy: finite(vy) } : r,
        ),
      });
    },
    setRockHealth: (s, id, hp) => {
      const r = s.rocks[index(s.rocks, id, "rock")]!;
      finite(hp);
      if (!Number.isInteger(hp) || hp < 1 || hp > ROCK_HEALTH[r.size])
        throw new Error("invalid rock health");
      return set(s, {
        rocks: s.rocks.map((x) => (x.id === id ? { ...x, health: hp } : x)),
      });
    },
    removeRock: (s, id) => {
      index(s.rocks, id, "rock");
      return set(s, { rocks: s.rocks.filter((x) => x.id !== id) });
    },
    clearRocks: (s) => set(s, { rocks: [] }),
    addSaucer: (s, x, y) =>
      set(s, {
        saucer: {
          id: s.nextId,
          x: finite(x),
          y: finite(y),
          vx: SAUCER_SPEED,
          vy: 0,
          mind: true,
          gun: true,
          travel: true,
          weave: 1,
          fireClock: SAUCER_FIRE_INTERVAL,
          weaveClock: SAUCER_WEAVE_INTERVAL,
          age: 0,
        },
        nextId: s.nextId + 1,
      }),
    setSaucerVelocity: (s, vx, vy) =>
      saucer(s, { vx: finite(vx), vy: finite(vy) }),
    setSaucerWeave: (s, d) => {
      if (d !== 1 && d !== -1) throw new Error("weave must be 1 or -1");
      return saucer(s, { weave: d });
    },
    removeSaucer: (s) => set(s, { saucer: null }),
    setSaucerMind: (s, v) => saucer(s, { mind: boolean(v) }),
    setSaucerGun: (s, v) => saucer(s, { gun: boolean(v) }),
    setSaucerTravel: (s, v) => saucer(s, { travel: boolean(v) }),
    setNextSaucerEdge: (s, e) => {
      if (e !== "left" && e !== "right") throw new Error("invalid saucer edge");
      return set(s, { nextSaucerEdge: e });
    },
    setNextSaucerRow: (s, n) => set(s, { nextSaucerRow: finite(n) }),
    setNextSaucerAim: (s, n) => set(s, { nextSaucerAim: finite(n) }),
    setNextRockSpeed: (s, n) => set(s, { nextRockSpeed: finite(n) }),
    setNextRecycleEdge: (s, e) => {
      if (!["top", "bottom", "left", "right"].includes(e))
        throw new Error("invalid field edge");
      return set(s, { nextRecycleEdge: e });
    },
    setTorpedoCharge: (s, n) => {
      finite(n);
      if (n < 0 || n > 1) throw new Error("charge must be 0 to 1");
      return set(s, { torpedoCharge: n });
    },
    addTorpedo: (s, x, y, h) => {
      finite(h);
      return set(s, {
        torpedoes: [
          ...s.torpedoes,
          {
            id: s.nextId,
            x: finite(x),
            y: finite(y),
            vx: Math.cos(h) * TORPEDO_SPEED,
            vy: Math.sin(h) * TORPEDO_SPEED,
            heading: h,
            life: TORPEDO_LIFE,
            homing: true,
          },
        ],
        nextId: s.nextId + 1,
      });
    },
    setTorpedoHeading: (s, id, h) => {
      index(s.torpedoes, id, "torpedo");
      finite(h);
      return set(s, {
        torpedoes: s.torpedoes.map((t) =>
          t.id === id
            ? {
                ...t,
                heading: h,
                vx: Math.cos(h) * TORPEDO_SPEED,
                vy: Math.sin(h) * TORPEDO_SPEED,
              }
            : t,
        ),
      });
    },
    setTorpedoHoming: (s, id, v) => {
      index(s.torpedoes, id, "torpedo");
      return set(s, {
        torpedoes: s.torpedoes.map((t) =>
          t.id === id ? { ...t, homing: boolean(v) } : t,
        ),
      });
    },
    removeTorpedo: (s, id) => {
      index(s.torpedoes, id, "torpedo");
      return set(s, { torpedoes: s.torpedoes.filter((t) => t.id !== id) });
    },
    clearTorpedoes: (s) => set(s, { torpedoes: [] }),
  };
}
export function coreHit(b: { x: number; y: number }, r: number): boolean {
  return touching(b, r, { x: FIELD_W / 2, y: FIELD_H / 2 }, CORE_R);
}
export function radius(z: RockSize): number {
  return ROCK_RADIUS[z];
}
