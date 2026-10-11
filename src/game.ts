import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import {
  ACTIONS,
  BINDINGS,
  BULLET_R,
  CORE_R,
  CUES,
  FIELD_H,
  FIELD_W,
  GAMEOVER_ITEMS,
  HALO_R,
  PAUSE_ITEMS,
  ROCK_HEALTH,
  ROCK_RADIUS,
  SAUCER_BULLET_R,
  TAGLINE_TEXT,
  TICK_DT,
  TITLE_ITEMS,
  TITLE_TEXT,
  TRAIL_TICKS,
} from "./constants";
import {
  BACKGROUND as BG,
  clone,
  initialState,
  makeDebug,
  MENU_RECTS,
  menuCount,
  shipStart,
  wrap,
} from "./core";
import { sounds, spawnWave, tick, type Controls } from "./simulation";
import type {
  ReadState,
  ShatterDebugApi,
  ShatterState,
  ShipState,
} from "./types";
export type {
  Screen,
  SaucerEdge,
  FieldEdge,
  ShipState,
  BulletState,
  RockState,
  SaucerState,
  TorpedoState,
  ShatterState,
  ShatterDebugApi,
} from "./types";
export const BACKGROUND = BG;
const start = (s: ReadState): ShatterState =>
  spawnWave({ ...initialState(s.muted), screen: "playing", wave: 1 });
function activate(s: ShatterState) {
  if (s.screen === "title")
    return s.menuIndex === 0 ? start(s) : { ...s, screen: "howto" as const };
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: "playing" as const, menuIndex: 0 }
      : s.menuIndex === 1
        ? start(s)
        : { ...s, screen: "title" as const, menuIndex: 0 };
  if (s.screen === "gameover")
    return s.menuIndex === 0
      ? start(s)
      : { ...s, screen: "title" as const, menuIndex: 0 };
  return s;
}
const hit = (s: ReadState, x: number, y: number) => {
  for (let i = 0; i < menuCount(s.screen); i++) {
    const r = MENU_RECTS[i]!;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
};
function menus(s: ShatterState, api: UpdateApi) {
  if (s.screen === "howto") {
    if (api.input.pressed("confirm") || api.input.pressed("back"))
      return { ...s, screen: "title" as const };
    return s;
  }
  const count = menuCount(s.screen);
  if (!count) return s;
  if (api.input.pressed("up"))
    s = { ...s, menuIndex: wrap(s.menuIndex - 1, count) };
  if (api.input.pressed("down"))
    s = { ...s, menuIndex: wrap(s.menuIndex + 1, count) };
  if (api.input.pressed("confirm")) return activate(s);
  const p = api.input.pointer(),
    h = hit(s, p.x, p.y);
  if (h >= 0) s = { ...s, menuIndex: h };
  for (const q of api.input.pointerSamples()) {
    const i = hit(s, q.x, q.y);
    if (i >= 0) s = { ...s, menuIndex: i };
    if (q.type === "down") s = { ...s, pointerPress: i >= 0 ? i : null };
    else if (q.type === "up") {
      if (i >= 0 && i === s.pointerPress)
        s = activate({ ...s, menuIndex: i, pointerPress: null });
      else s = { ...s, pointerPress: null };
    }
  }
  return s;
}
function txt(
  c: CanvasRenderingContext2D,
  v: string,
  x: number,
  y: number,
  n: number,
  color = "#dffaff",
  align: CanvasTextAlign = "center",
) {
  c.font = `700 ${n}px system-ui,sans-serif`;
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(v, x, y);
}
function star(c: CanvasRenderingContext2D) {
  const g = c.createRadialGradient(640, 360, 10, 640, 360, HALO_R * 1.5);
  g.addColorStop(0, "rgba(255,250,204,1)");
  g.addColorStop(0.2, "rgba(255,146,60,.52)");
  g.addColorStop(0.58, "rgba(128,55,255,.14)");
  g.addColorStop(1, "rgba(20,10,70,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(640, 360, HALO_R * 1.5, 0, 7);
  c.fill();
  c.shadowColor = "#ffa852";
  c.shadowBlur = 26;
  c.fillStyle = "#fff3bd";
  c.beginPath();
  c.arc(640, 360, CORE_R, 0, 7);
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,170,70,.38)";
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.ellipse(640, 360, 58 + i * 25, 21 + i * 9, -0.28, 0, 7);
    c.stroke();
  }
}
function wrapped(
  x: number,
  y: number,
  r: number,
  fn: (x: number, y: number) => void,
) {
  for (const ox of x - r < 0
    ? [0, FIELD_W]
    : x + r > FIELD_W
      ? [0, -FIELD_W]
      : [0])
    for (const oy of y - r < 0
      ? [0, FIELD_H]
      : y + r > FIELD_H
        ? [0, -FIELD_H]
        : [0])
      fn(x + ox, y + oy);
}
function rock(c: CanvasRenderingContext2D, r: ReadState["rocks"][number]) {
  wrapped(r.x, r.y, ROCK_RADIUS[r.size], (x, y) => {
    const rad = ROCK_RADIUS[r.size];
    c.save();
    c.translate(x, y);
    c.rotate(r.spin);
    c.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2,
        rr = rad * (0.79 + ((r.id * 17 + i * 29) % 17) / 100);
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle =
      r.flash > 0
        ? "#ffffff"
        : r.health < ROCK_HEALTH[r.size]
          ? "#645664"
          : "#35445b";
    c.fill();
    c.strokeStyle = r.health < ROCK_HEALTH[r.size] ? "#ff9a72" : "#9db5cb";
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = "#1a1928";
    for (let i = 0; i < ROCK_HEALTH[r.size] - r.health; i++) {
      c.beginPath();
      c.moveTo(-rad * 0.7 + i * 8, -rad * 0.3);
      c.lineTo(-rad * 0.1 + i * 5, rad * 0.15);
      c.lineTo(rad * 0.3, rad * 0.6);
      c.stroke();
    }
    c.restore();
  });
}
function ship(
  c: CanvasRenderingContext2D,
  s: ReadState["ship"] | ShipState,
  small = false,
) {
  c.save();
  c.translate(s.x, s.y);
  c.rotate(s.angle);
  c.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0 ? 0.3 : 1;
  if (s.thrusting && !small) {
    c.fillStyle = "#ff9a46";
    c.beginPath();
    c.moveTo(-14, -7);
    c.lineTo(-28, 0);
    c.lineTo(-14, 7);
    c.fill();
  }
  c.beginPath();
  c.moveTo(18, 0);
  c.lineTo(-15, -13);
  c.lineTo(-9, 0);
  c.lineTo(-15, 13);
  c.closePath();
  c.fillStyle = "#10182d";
  c.fill();
  c.strokeStyle = "#6ff4ff";
  c.lineWidth = 2.5;
  c.stroke();
  c.restore();
}
function field(s: ReadState, c: CanvasRenderingContext2D) {
  c.fillStyle = BG;
  c.fillRect(0, 0, FIELD_W, FIELD_H);
  c.fillStyle = "rgba(170,220,255,.22)";
  for (let i = 0; i < 90; i++) {
    const x = (i * 193) % FIELD_W,
      y = (i * i * 47) % FIELD_H;
    c.fillRect(x, y, i % 7 ? 1 : 2, i % 7 ? 1 : 2);
  }
  star(c);
  for (const b of s.bullets) {
    const m = Math.hypot(b.vx, b.vy) || 1,
      len = m * TICK_DT * TRAIL_TICKS;
    c.strokeStyle = "rgba(100,240,255,.45)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x - (b.vx / m) * len, b.y - (b.vy / m) * len);
    c.stroke();
    c.fillStyle = "#eaffff";
    c.beginPath();
    c.arc(b.x, b.y, BULLET_R, 0, 7);
    c.fill();
  }
  for (const b of s.enemyBullets) {
    c.fillStyle = "#ff557f";
    c.shadowColor = "#ff2255";
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(b.x, b.y, SAUCER_BULLET_R + 1, 0, 7);
    c.fill();
    c.shadowBlur = 0;
  }
  for (const r of s.rocks) rock(c, r);
  for (const t of s.torpedoes) {
    c.save();
    c.translate(t.x, t.y);
    c.rotate(t.heading);
    c.fillStyle = "#ffd452";
    c.beginPath();
    c.moveTo(11, 0);
    c.lineTo(-7, -5);
    c.lineTo(-4, 0);
    c.lineTo(-7, 5);
    c.fill();
    c.restore();
  }
  if (s.saucer) {
    c.save();
    c.translate(s.saucer.x, s.saucer.y);
    c.strokeStyle = "#ff7bbb";
    c.fillStyle = "#35142e";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 3, 23, 9, 0, 0, 7);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(0, -2, 9, Math.PI, 0);
    c.stroke();
    c.restore();
  }
  if (s.lives > 0) ship(c, s.ship);
}
function hud(s: ReadState, c: CanvasRenderingContext2D) {
  txt(c, String(s.score).padStart(6, "0"), 34, 48, 30, "#efffff", "left");
  txt(c, `WAVE ${s.wave}`, 1246, 42, 18, "#8199b3", "right");
  for (let i = 0; i < Math.max(0, s.lives - 1); i++)
    ship(
      c,
      { ...shipStart(), x: 48 + i * 30, y: 82, angle: -Math.PI / 2 },
      true,
    );
  txt(c, "TORPEDO", 34, 122, 12, "#8199b3", "left");
  c.strokeStyle = "#506278";
  c.strokeRect(34, 132, 120, 8);
  c.fillStyle = s.torpedoCharge === 1 ? "#ffd452" : "#956b30";
  c.fillRect(36, 134, 116 * s.torpedoCharge, 4);
  if (s.waveBanner > 0) txt(c, `WAVE ${s.wave}`, 640, 380, 52, "#fff");
  if (s.extraLifeFlash > 0) txt(c, "EXTRA SHIP", 640, 245, 24, "#ffd452");
}
function menu(
  c: CanvasRenderingContext2D,
  s: ReadState,
  items: readonly string[],
) {
  items.forEach((v, i) => {
    const r = MENU_RECTS[i]!,
      on = s.menuIndex === i;
    c.fillStyle = on ? "rgba(75,225,255,.16)" : "rgba(9,16,32,.7)";
    c.strokeStyle = on ? "#6ff4ff" : "#34455f";
    c.lineWidth = 2;
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeRect(r.x, r.y, r.w, r.h);
    txt(c, v, 640, r.y + 39, 21, on ? "#fff" : "#8fa5bc");
  });
}
export const game: Game<ShatterState, ShatterDebugApi> = {
  initialize(api: InitApi<ShatterState>) {
    for (const a of ACTIONS) api.input.register(a, BINDINGS[a]);
    api.audio.define(CUES.fire, {
      wave: "square",
      freq: 740,
      freqTo: 250,
      gain: 0.1,
      durationMs: 70,
    });
    api.audio.define(CUES.shatter, {
      wave: "sawtooth",
      freq: 120,
      freqTo: 45,
      gain: 0.16,
      durationMs: 260,
    });
    api.audio.define(CUES.thrust, {
      wave: "sawtooth",
      freq: 65,
      gain: 0.055,
      durationMs: 100,
    });
    api.audio.define(CUES.saucer, {
      wave: "triangle",
      freq: 280,
      freqTo: 520,
      gain: 0.12,
      durationMs: 300,
    });
    api.audio.define(CUES.death, {
      wave: "sawtooth",
      freq: 220,
      freqTo: 30,
      gain: 0.2,
      durationMs: 500,
    });
    api.audio.define(CUES.extraLife, {
      wave: "square",
      freq: 520,
      freqTo: 1040,
      gain: 0.12,
      durationMs: 420,
    });
    const ds: [string, (s: ReadState) => string | number | boolean][] = [
      ["screen", (s) => s.screen],
      ["score", (s) => s.score],
      ["lives", (s) => s.lives],
      ["wave", (s) => s.wave],
      ["ship pos", (s) => `${s.ship.x.toFixed(1)}, ${s.ship.y.toFixed(1)}`],
      ["ship vel", (s) => `${s.ship.vx.toFixed(1)}, ${s.ship.vy.toFixed(1)}`],
      ["ship speed", (s) => Math.hypot(s.ship.vx, s.ship.vy)],
      ["ship angle", (s) => s.ship.angle],
      ["invuln", (s) => s.ship.invuln],
      ["bullets", (s) => s.bullets.length],
      ["rocks", (s) => s.rocks.length],
      [
        "saucer",
        (s) =>
          s.saucer
            ? `${s.saucer.x.toFixed(1)}, ${s.saucer.y.toFixed(1)}`
            : "none",
      ],
      ["torpedo charge", (s) => s.torpedoCharge],
      ["torpedoes", (s) => s.torpedoes.length],
      ["sim time", (s) => s.simTime],
    ];
    for (const [n, f] of ds) api.diagnostics.register(n, f);
    return [initialState(), makeDebug()];
  },
  update(read, api, dt) {
    let s = clone(read);
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
    if (s.screen === "playing" && api.input.pressed("pause")) {
      api.audio.stop(CUES.thrust);
      return {
        ...s,
        screen: "paused",
        menuIndex: 0,
        tickClock: s.tickClock + dt,
      };
    }
    if (
      s.screen === "paused" &&
      (api.input.pressed("pause") || api.input.pressed("back"))
    )
      return {
        ...s,
        screen: "playing",
        menuIndex: 0,
        tickClock: s.tickClock + dt,
      };
    if (s.screen !== "playing") {
      api.audio.stop(CUES.thrust);
      s = menus(s, api);
    }
    const controls: Controls = {
      left: api.input.value("left") > 0,
      right: api.input.value("right") > 0,
      thrust: api.input.value("up") > 0,
      fire: api.input.value("a") > 0,
      torpedo: api.input.pressed("b"),
    };
    let clock = s.tickClock + dt,
      first = true;
    const fx = sounds();
    while (clock + 1e-12 >= TICK_DT) {
      s = tick({ ...controls, torpedo: controls.torpedo && first }, s, fx);
      clock -= TICK_DT;
      first = false;
    }
    s = { ...s, tickClock: clock, muted: api.audio.muted() };
    if (s.screen === "playing" && s.ship.thrusting) {
      if (!api.audio.looping(CUES.thrust)) api.audio.loop(CUES.thrust);
    } else api.audio.stop(CUES.thrust);
    if (fx.fire) api.audio.play(CUES.fire);
    if (fx.shatter) api.audio.play(CUES.shatter);
    if (fx.saucer) api.audio.play(CUES.saucer);
    if (fx.death) api.audio.play(CUES.death);
    if (fx.extra) api.audio.play(CUES.extraLife);
    return s;
  },
  render(s, api: RenderApi) {
    const c = api.ctx;
    if (s.screen === "title") {
      field(
        {
          ...s,
          rocks: [],
          bullets: [],
          enemyBullets: [],
          torpedoes: [],
          saucer: null,
        },
        c,
      );
      c.fillStyle = "rgba(5,8,18,.5)";
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      txt(c, TITLE_TEXT, 640, 225, 92);
      txt(c, TAGLINE_TEXT, 640, 280, 18, "#8bddea");
      menu(c, s, TITLE_ITEMS);
      return;
    }
    field(s, c);
    if (s.screen !== "howto") hud(s, c);
    if (s.screen === "paused") {
      c.fillStyle = "rgba(3,6,14,.68)";
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      txt(c, "PAUSED", 640, 300, 54);
      menu(c, s, PAUSE_ITEMS);
    } else if (s.screen === "gameover") {
      c.fillStyle = "rgba(3,6,14,.75)";
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      txt(c, "SIGNAL LOST", 640, 210, 56, "#ff7192");
      txt(c, `SCORE ${s.score} · WAVE ${s.wave}`, 640, 275, 22);
      menu(c, s, GAMEOVER_ITEMS);
    } else if (s.screen === "howto") {
      c.fillStyle = "rgba(3,6,14,.92)";
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      txt(c, "HOW TO PLAY", 640, 92, 44);
      const lines = [
        "SHOOT EVERY ROCK THROUGH ITS FRAGMENTS TO CLEAR THE WAVE.",
        "THE STAR BENDS BULLETS AND ROCKS — NEVER YOUR SHIP.",
        "ROCKS SWALLOWED BY THE STAR RETURN FROM THE FIELD EDGE.",
        "LARGE ROCKS ARE ARMORED. CRACK THEM OR USE A TORPEDO.",
        "THE GUIDED TORPEDO HOMES IN A NARROW FORWARD CONE,",
        "FLIES TRUE THROUGH GRAVITY, AND RECHARGES IN TEN SECONDS.",
        "WATCH FOR THE HUNTING SAUCER — SHOOT IT DOWN.",
        "ARROWS / WASD  TURN + THRUST     SPACE  FIRE     F  TORPEDO",
        "ENTER  SELECT     ESC / P  BACK + PAUSE     M  MUTE",
      ];
      lines.forEach((l, i) =>
        txt(
          c,
          l,
          640,
          172 + i * 48,
          i > 6 ? 18 : 20,
          i > 6 ? "#78e5ef" : "#c9d7e5",
        ),
      );
      txt(c, "PRESS ENTER OR ESC TO RETURN", 640, 665, 16, "#8198af");
    }
  },
};
