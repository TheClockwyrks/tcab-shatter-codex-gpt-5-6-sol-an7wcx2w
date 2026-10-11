import {
  BULLET_LIFE,
  BULLET_R,
  CORE_R,
  EXTRA_LIFE_STEP,
  FIELD_H,
  FIELD_W,
  FIRE_INTERVAL_TICKS,
  HIT_FLASH_TIME,
  INVULN_TIME,
  MAX_BULLETS,
  MU,
  MUZZLE_SPEED,
  ROCK_CHILD,
  ROCK_HEALTH,
  ROCK_RADIUS,
  ROCK_SPEED_MAX,
  ROCK_SPEED_MIN,
  SAUCER_AIM_ERROR,
  SAUCER_BULLET_LIFE,
  SAUCER_BULLET_R,
  SAUCER_BULLET_SPEED,
  SAUCER_FIRE_INTERVAL,
  SAUCER_GAP_MAX,
  SAUCER_GAP_MIN,
  SAUCER_LIFETIME,
  SAUCER_R,
  SAUCER_SPEED,
  SAUCER_WEAVE_INTERVAL,
  SAUCER_WEAVE_SPEED,
  SCORE_LARGE,
  SCORE_MEDIUM,
  SCORE_SAUCER,
  SCORE_SMALL,
  SHIP_DRAG_HALFLIFE,
  SHIP_MAX,
  SHIP_R,
  SHIP_THRUST,
  SHIP_TURN,
  SOFTEN,
  SPLIT_KICK,
  STAR_X,
  STAR_Y,
  TICK_DT,
  TORPEDO_CONE,
  TORPEDO_LIFE,
  TORPEDO_R,
  TORPEDO_RECHARGE,
  TORPEDO_SCATTER,
  TORPEDO_SPEED,
  TORPEDO_TURN,
  WAVE_BANNER_TIME,
  WAVE_BASE_ROCKS,
  WAVE_MIN_SHIP_DIST,
  WAVE_MIN_STAR_DIST,
  WAVE_SPEED_CAP,
  WAVE_SPEED_STEP,
} from "./constants";
import { distance, separation, shipStart, touching, wrap } from "./core";
import type { BulletState, RockState, ShatterState } from "./types";
import type { RockSize } from "./constants";
export interface Controls {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
  torpedo: boolean;
}
export interface Sounds {
  fire: boolean;
  shatter: boolean;
  saucer: boolean;
  death: boolean;
  extra: boolean;
}
export const sounds = (): Sounds => ({
  fire: false,
  shatter: false,
  saucer: false,
  death: false,
  extra: false,
});
const grav = <T extends { x: number; y: number; vx: number; vy: number }>(
  b: T,
): T => {
  const dx = STAR_X - b.x,
    dy = STAR_Y - b.y,
    d = Math.hypot(dx, dy);
  if (!d) return b;
  const a = MU / Math.max(d, SOFTEN) ** 2;
  return {
    ...b,
    vx: b.vx + (dx / d) * a * TICK_DT,
    vy: b.vy + (dy / d) * a * TICK_DT,
  };
};
const move = <T extends { x: number; y: number; vx: number; vy: number }>(
  b: T,
): T => ({
  ...b,
  x: wrap(b.x + b.vx * TICK_DT, FIELD_W),
  y: wrap(b.y + b.vy * TICK_DT, FIELD_H),
});
const score = (z: RockSize) =>
  z === "large" ? SCORE_LARGE : z === "medium" ? SCORE_MEDIUM : SCORE_SMALL;
function award(s: ShatterState, n: number, fx: Sounds) {
  const total = s.score + n,
    g =
      Math.floor(total / EXTRA_LIFE_STEP) -
      Math.floor(s.score / EXTRA_LIFE_STEP);
  if (g) fx.extra = true;
  return {
    ...s,
    score: total,
    lives: s.lives + g,
    extraLifeFlash: g ? 0.8 : s.extraLifeFlash,
  };
}
function rock(
  id: number,
  z: RockSize,
  x: number,
  y: number,
  v: number,
  a: number,
): RockState {
  return {
    id,
    x,
    y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    size: z,
    spin: Math.random() * 6.28,
    health: ROCK_HEALTH[z],
    flash: 0,
  };
}
export function spawnWave(s: ShatterState) {
  let id = s.nextId;
  const rs: RockState[] = [];
  for (let i = 0; i < WAVE_BASE_ROCKS + s.wave; i++) {
    let position: { x: number; y: number };
    for (;;) {
      const candidate = {
        x: Math.random() * FIELD_W,
        y: Math.random() * FIELD_H,
      };
      if (
        distance(candidate, s.ship) >= WAVE_MIN_SHIP_DIST &&
        distance(candidate, { x: STAR_X, y: STAR_Y }) >= WAVE_MIN_STAR_DIST
      ) {
        position = candidate;
        break;
      }
    }
    const { x, y } = position;
    const base =
      s.nextRockSpeed ??
      ROCK_SPEED_MIN.large +
        Math.random() * (ROCK_SPEED_MAX.large - ROCK_SPEED_MIN.large);
    rs.push(
      rock(
        id++,
        "large",
        x,
        y,
        base * (1 + Math.min(WAVE_SPEED_CAP, WAVE_SPEED_STEP * (s.wave - 1))),
        Math.random() * 6.28,
      ),
    );
  }
  return { ...s, rocks: rs, nextId: id, nextRockSpeed: null };
}
function breakRock(
  s: ShatterState,
  r: RockState,
  w: { vx: number; vy: number },
  torp: boolean,
  fx: Sounds,
) {
  fx.shatter = true;
  const q = award(s, score(r.size), fx);
  const left = q.rocks.filter((x) => x.id !== r.id),
    child = ROCK_CHILD[r.size];
  if (!child) return { ...q, rocks: left };
  const m = Math.hypot(w.vx, w.vy) || 1,
    ux = w.vx / m,
    uy = w.vy / m,
    k = torp ? TORPEDO_SCATTER : SPLIT_KICK,
    ax = torp ? ux : -uy,
    ay = torp ? uy : ux,
    a = {
      id: q.nextId,
      x: r.x,
      y: r.y,
      vx: r.vx + ax * k,
      vy: r.vy + ay * k,
      size: child,
      spin: r.spin - 0.2,
      health: ROCK_HEALTH[child],
      flash: 0,
    },
    b = {
      ...a,
      id: q.nextId + 1,
      vx: r.vx - ax * k,
      vy: r.vy - ay * k,
      spin: r.spin + 0.2,
    };
  return { ...q, rocks: [...left, a, b], nextId: q.nextId + 2 };
}
function kill(s: ShatterState, fx: Sounds) {
  if (!s.ship.collision || s.ship.invuln > 0) return s;
  fx.death = true;
  const lives = s.lives - 1;
  return lives <= 0
    ? { ...s, lives: 0, screen: "gameover" as const, menuIndex: 0 }
    : {
        ...s,
        lives,
        ship: shipStart(INVULN_TIME),
        torpedoCharge: 1,
        torpedoes: [],
      };
}
function recycle(s: ShatterState, r: RockState): ShatterState {
  const e =
      s.nextRecycleEdge ??
      (["top", "bottom", "left", "right"] as const)[
        Math.floor(Math.random() * 4)
      ]!,
    v =
      s.nextRockSpeed ??
      ROCK_SPEED_MIN[r.size] +
        Math.random() * (ROCK_SPEED_MAX[r.size] - ROCK_SPEED_MIN[r.size]);
  let x = 0,
    y = 0,
    a = 0;
  if (e === "top") {
    x = Math.random() * FIELD_W;
    a = Math.random() * Math.PI;
  } else if (e === "bottom") {
    x = Math.random() * FIELD_W;
    y = FIELD_H;
    a = Math.PI + Math.random() * Math.PI;
  } else if (e === "left") {
    y = Math.random() * FIELD_H;
    a = -Math.PI / 2 + Math.random() * Math.PI;
  } else {
    x = FIELD_W;
    y = Math.random() * FIELD_H;
    a = Math.PI / 2 + Math.random() * Math.PI;
  }
  return {
    ...s,
    nextRecycleEdge: null,
    nextRockSpeed: null,
    rocks: s.rocks.map((z) =>
      z.id === r.id
        ? {
            ...r,
            x: wrap(x, FIELD_W),
            y: wrap(y, FIELD_H),
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
          }
        : z,
    ),
  };
}
const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const d = separation(a, b);
  return Math.atan2(d.y, d.x);
};
function swept(
  a: { x: number; y: number; vx: number; vy: number },
  ar: number,
  b: { x: number; y: number; vx?: number; vy?: number },
  br: number,
): boolean {
  const bvx = b.vx ?? 0,
    bvy = b.vy ?? 0;
  const d = separation(
    { x: a.x - a.vx * TICK_DT, y: a.y - a.vy * TICK_DT },
    { x: b.x - bvx * TICK_DT, y: b.y - bvy * TICK_DT },
  );
  const rx = (bvx - a.vx) * TICK_DT,
    ry = (bvy - a.vy) * TICK_DT,
    denom = rx * rx + ry * ry;
  const t = denom
    ? Math.max(0, Math.min(1, -(d.x * rx + d.y * ry) / denom))
    : 0;
  return Math.hypot(d.x + rx * t, d.y + ry * t) <= ar + br;
}
const ad = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export function tick(
  input: Controls,
  state: ShatterState,
  fx: Sounds,
): ShatterState {
  let s = {
    ...state,
    simTime: state.simTime + TICK_DT,
    extraLifeFlash: Math.max(0, state.extraLifeFlash - TICK_DT),
  };
  if (s.screen !== "playing") return s;
  const a =
    s.ship.angle +
    (input.right ? SHIP_TURN * TICK_DT : 0) -
    (input.left ? SHIP_TURN * TICK_DT : 0);
  let vx = s.ship.vx,
    vy = s.ship.vy;
  if (input.thrust) {
    vx += Math.cos(a) * SHIP_THRUST * TICK_DT;
    vy += Math.sin(a) * SHIP_THRUST * TICK_DT;
  }
  const drag = 0.5 ** (TICK_DT / SHIP_DRAG_HALFLIFE);
  vx *= drag;
  vy *= drag;
  const sp = Math.hypot(vx, vy);
  if (sp > SHIP_MAX) {
    vx *= SHIP_MAX / sp;
    vy *= SHIP_MAX / sp;
  }
  let sh = move({
    ...s.ship,
    angle: a,
    vx,
    vy,
    thrusting: input.thrust,
    invuln: Math.max(0, s.ship.invuln - TICK_DT),
    fireCooldown: Math.max(0, s.ship.fireCooldown - 1),
  });
  if (touching(sh, SHIP_R, { x: STAR_X, y: STAR_Y }, CORE_R)) {
    const dx = sh.x - STAR_X;
    let dy = sh.y - STAR_Y,
      d = Math.hypot(dx, dy);
    if (!d) {
      dy = 1;
      d = 1;
    }
    const nx = dx / d,
      ny = dy / d,
      dot = sh.vx * nx + sh.vy * ny;
    sh = {
      ...sh,
      x: STAR_X + nx * (CORE_R + SHIP_R),
      y: STAR_Y + ny * (CORE_R + SHIP_R),
      vx: dot < 0 ? sh.vx - dot * nx : sh.vx,
      vy: dot < 0 ? sh.vy - dot * ny : sh.vy,
    };
  }
  s = {
    ...s,
    ship: sh,
    torpedoCharge: Math.min(1, s.torpedoCharge + TICK_DT / TORPEDO_RECHARGE),
    waveBanner: Math.max(0, s.waveBanner - TICK_DT),
  };
  if (input.fire && sh.fireCooldown === 0 && s.bullets.length < MAX_BULLETS) {
    const ux = Math.cos(a),
      uy = Math.sin(a);
    s = {
      ...s,
      bullets: [
        ...s.bullets,
        {
          id: s.nextId,
          x: wrap(sh.x + ux * SHIP_R, FIELD_W),
          y: wrap(sh.y + uy * SHIP_R, FIELD_H),
          vx: sh.vx + ux * MUZZLE_SPEED,
          vy: sh.vy + uy * MUZZLE_SPEED,
          life: BULLET_LIFE,
        },
      ],
      nextId: s.nextId + 1,
      ship: { ...sh, fireCooldown: FIRE_INTERVAL_TICKS },
    };
    fx.fire = true;
  }
  if (input.torpedo && s.torpedoCharge === 1 && !s.torpedoes.length) {
    const ux = Math.cos(a),
      uy = Math.sin(a);
    s = {
      ...s,
      torpedoCharge: 0,
      torpedoes: [
        {
          id: s.nextId,
          x: sh.x + ux * SHIP_R,
          y: sh.y + uy * SHIP_R,
          vx: ux * TORPEDO_SPEED,
          vy: uy * TORPEDO_SPEED,
          heading: a,
          life: TORPEDO_LIFE,
          homing: true,
        },
      ],
      nextId: s.nextId + 1,
    };
  }
  const balls = (xs: readonly BulletState[]) =>
    xs
      .map((b) => move(grav({ ...b, life: b.life - TICK_DT })))
      .filter(
        (b) =>
          b.life > 0 && !swept(b, BULLET_R, { x: STAR_X, y: STAR_Y }, CORE_R),
      );
  s = {
    ...s,
    bullets: balls(s.bullets),
    enemyBullets: balls(s.enemyBullets),
    rocks: s.rocks.map((r) => ({
      ...move(grav({ ...r, flash: Math.max(0, r.flash - TICK_DT) })),
      spin: r.spin + (r.id % 2 ? 0.35 : -0.28) * TICK_DT,
    })),
  };
  const targets = [...s.rocks, ...(s.saucer ? [s.saucer] : [])];
  s = {
    ...s,
    torpedoes: s.torpedoes
      .map((t) => {
        let h = t.heading;
        if (t.homing) {
          let best: { d: number; a: number } | null = null;
          for (const z of targets) {
            const ba = bearing(t, z),
              d = distance(t, z);
            if (Math.abs(ad(h, ba)) <= TORPEDO_CONE && (!best || d < best.d))
              best = { d, a: ba };
          }
          if (best)
            h += Math.max(
              -TORPEDO_TURN * TICK_DT,
              Math.min(TORPEDO_TURN * TICK_DT, ad(h, best.a)),
            );
        }
        return move({
          ...t,
          heading: h,
          vx: Math.cos(h) * TORPEDO_SPEED,
          vy: Math.sin(h) * TORPEDO_SPEED,
          life: t.life - TICK_DT,
        });
      })
      .filter(
        (t) =>
          t.life > 0 && !swept(t, TORPEDO_R, { x: STAR_X, y: STAR_Y }, CORE_R),
      ),
  };
  if (s.saucer) {
    let c = {
      ...s.saucer,
      age: s.saucer.age + TICK_DT,
      fireClock: s.saucer.fireClock - TICK_DT,
      weaveClock: s.saucer.weaveClock - TICK_DT,
    };
    if (c.mind && c.weaveClock <= 0) {
      const d: 1 | -1 = c.vy === 0 ? c.weave : c.vy > 0 ? -1 : 1;
      c = {
        ...c,
        weave: d,
        vy: d * SAUCER_WEAVE_SPEED,
        weaveClock: SAUCER_WEAVE_INTERVAL,
      };
    }
    if (
      c.mind &&
      Math.hypot(c.x + c.vx * TICK_DT - STAR_X, c.y + c.vy * TICK_DT - STAR_Y) <
        CORE_R + SAUCER_R + 16
    )
      c = { ...c, vy: (c.y < STAR_Y ? -1 : 1) * SAUCER_WEAVE_SPEED };
    if (c.gun && c.fireClock <= 0) {
      const er = s.nextSaucerAim ?? (Math.random() * 2 - 1) * SAUCER_AIM_ERROR,
        ba = bearing(c, s.ship) + er;
      s = {
        ...s,
        nextSaucerAim: null,
        enemyBullets: [
          ...s.enemyBullets,
          {
            id: s.nextId,
            x: c.x,
            y: c.y,
            vx: c.vx + Math.cos(ba) * SAUCER_BULLET_SPEED,
            vy: c.vy + Math.sin(ba) * SAUCER_BULLET_SPEED,
            life: SAUCER_BULLET_LIFE,
          },
        ],
        nextId: s.nextId + 1,
      };
      c = { ...c, fireClock: SAUCER_FIRE_INTERVAL };
    }
    if (c.travel) c = move(c);
    s =
      c.age >= SAUCER_LIFETIME
        ? {
            ...s,
            saucer: null,
            saucerClock: 0,
            saucerDue:
              SAUCER_GAP_MIN +
              Math.random() * (SAUCER_GAP_MAX - SAUCER_GAP_MIN),
          }
        : { ...s, saucer: c };
  } else {
    const clock = s.saucerClock + TICK_DT;
    s = { ...s, saucerClock: clock };
    if (s.saucerSpawning && clock >= s.saucerDue) {
      const e = s.nextSaucerEdge ?? (Math.random() < 0.5 ? "left" : "right"),
        y =
          s.nextSaucerRow ??
          SAUCER_R + Math.random() * (FIELD_H - 2 * SAUCER_R),
        right = e === "left";
      s = {
        ...s,
        saucer: {
          id: s.nextId,
          x: right ? 0 : FIELD_W,
          y,
          vx: right ? SAUCER_SPEED : -SAUCER_SPEED,
          vy: 0,
          mind: true,
          gun: true,
          travel: true,
          weave: Math.random() < 0.5 ? 1 : -1,
          fireClock: SAUCER_FIRE_INTERVAL,
          weaveClock: SAUCER_WEAVE_INTERVAL,
          age: 0,
        },
        nextId: s.nextId + 1,
        nextSaucerEdge: null,
        nextSaucerRow: null,
        saucerClock: 0,
      };
      fx.saucer = true;
    }
  }
  for (const r of [...s.rocks])
    if (swept(r, ROCK_RADIUS[r.size], { x: STAR_X, y: STAR_Y }, CORE_R))
      s = recycle(s, r);
  for (const b of [...s.bullets]) {
    const r = s.rocks.find((z) => swept(b, BULLET_R, z, ROCK_RADIUS[z.size]));
    if (r) {
      s = { ...s, bullets: s.bullets.filter((z) => z.id !== b.id) };
      s =
        r.health <= 1
          ? breakRock(s, r, b, false, fx)
          : {
              ...s,
              rocks: s.rocks.map((z) =>
                z.id === r.id
                  ? { ...z, health: z.health - 1, flash: HIT_FLASH_TIME }
                  : z,
              ),
            };
    } else if (s.saucer && swept(b, BULLET_R, s.saucer, SAUCER_R))
      s = award(
        {
          ...s,
          bullets: s.bullets.filter((z) => z.id !== b.id),
          saucer: null,
          saucerClock: 0,
        },
        SCORE_SAUCER,
        fx,
      );
  }
  for (const t of [...s.torpedoes]) {
    const r = s.rocks.find((z) => swept(t, TORPEDO_R, z, ROCK_RADIUS[z.size]));
    if (r) {
      s = { ...s, torpedoes: s.torpedoes.filter((z) => z.id !== t.id) };
      s = breakRock(s, r, t, true, fx);
    } else if (s.saucer && swept(t, TORPEDO_R, s.saucer, SAUCER_R))
      s = award(
        {
          ...s,
          torpedoes: s.torpedoes.filter((z) => z.id !== t.id),
          saucer: null,
          saucerClock: 0,
        },
        SCORE_SAUCER,
        fx,
      );
  }
  if (s.ship.collision && s.ship.invuln <= 0) {
    const b = s.enemyBullets.find((z) =>
      touching(s.ship, SHIP_R, z, SAUCER_BULLET_R),
    );
    if (b) {
      s = { ...s, enemyBullets: s.enemyBullets.filter((z) => z.id !== b.id) };
      s = kill(s, fx);
    } else if (
      s.rocks.some((r) => touching(s.ship, SHIP_R, r, ROCK_RADIUS[r.size])) ||
      (s.saucer && touching(s.ship, SHIP_R, s.saucer, SAUCER_R))
    )
      s = kill(s, fx);
  }
  const cleared = state.rocks.length > 0 && !s.rocks.length;
  if (cleared && s.waveSpawning)
    s = { ...s, wave: s.wave + 1, waveBanner: WAVE_BANNER_TIME };
  if (state.waveBanner > 0 && s.waveBanner === 0 && s.waveSpawning)
    s = spawnWave(s);
  return s;
}
