import type { DeepReadonly } from "ts-essentials";
import type { RockSize } from "./constants";

export type Screen = "title" | "howto" | "playing" | "paused" | "gameover";
export type SaucerEdge = "left" | "right";
export type FieldEdge = "top" | "bottom" | "left" | "right";
export interface ShipState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly angle: number;
  readonly thrusting: boolean;
  readonly invuln: number;
  readonly collision: boolean;
  readonly fireCooldown: number;
}
export interface BulletState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly life: number;
}
export interface RockState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly size: RockSize;
  readonly spin: number;
  readonly health: number;
  readonly flash: number;
}
export interface SaucerState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly mind: boolean;
  readonly gun: boolean;
  readonly travel: boolean;
  readonly weave: 1 | -1;
  readonly fireClock: number;
  readonly weaveClock: number;
  readonly age: number;
}
export interface TorpedoState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly heading: number;
  readonly life: number;
  readonly homing: boolean;
}
export interface ShatterState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly score: number;
  readonly lives: number;
  readonly wave: number;
  readonly waveBanner: number;
  readonly ship: ShipState;
  readonly bullets: readonly BulletState[];
  readonly rocks: readonly RockState[];
  readonly saucer: SaucerState | null;
  readonly enemyBullets: readonly BulletState[];
  readonly torpedoes: readonly TorpedoState[];
  readonly torpedoCharge: number;
  readonly waveSpawning: boolean;
  readonly saucerSpawning: boolean;
  readonly saucerClock: number;
  readonly saucerDue: number;
  readonly nextSaucerEdge: SaucerEdge | null;
  readonly nextSaucerRow: number | null;
  readonly nextSaucerAim: number | null;
  readonly nextRockSpeed: number | null;
  readonly nextRecycleEdge: FieldEdge | null;
  readonly tickClock: number;
  readonly nextId: number;
  readonly simTime: number;
  readonly muted: boolean;
  readonly extraLifeFlash: number;
  readonly pointerPress: number | null;
}
export type ReadState = DeepReadonly<ShatterState>;
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface Snapshot {
  readonly version: number;
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly score: number;
  readonly lives: number;
  readonly wave: number;
  readonly waveBanner: number;
  readonly muted: boolean;
  readonly waveSpawning: boolean;
  readonly saucerSpawning: boolean;
  readonly saucerClock: number;
  readonly saucerDue: number;
  readonly nextSaucerEdge: SaucerEdge | null;
  readonly nextSaucerRow: number | null;
  readonly nextSaucerAim: number | null;
  readonly nextRockSpeed: number | null;
  readonly nextRecycleEdge: FieldEdge | null;
  readonly ship: ShipState & { readonly speed: number };
  readonly bullets: readonly BulletState[];
  readonly rocks: readonly (Omit<RockState, "spin" | "flash"> & {
    readonly radius: number;
  })[];
  readonly saucer: SaucerState | null;
  readonly enemyBullets: readonly BulletState[];
  readonly torpedoes: readonly TorpedoState[];
  readonly torpedoCharge: number;
  readonly torpedoReady: boolean;
  readonly simTime: number;
}
export interface ShatterDebugApi {
  readonly version: number;
  reset(s: ReadState): ShatterState;
  snapshot(s: ReadState): Snapshot;
  reconcile(s: ReadState): ShatterState;
  menuItemRect(s: ReadState, i: number): Rect | null;
  setScreen(s: ReadState, v: Screen): ShatterState;
  setMenuIndex(s: ReadState, n: number): ShatterState;
  setScore(s: ReadState, n: number): ShatterState;
  setLives(s: ReadState, n: number): ShatterState;
  setWave(s: ReadState, n: number): ShatterState;
  setWaveBanner(s: ReadState, n: number): ShatterState;
  setWaveSpawning(s: ReadState, v: boolean): ShatterState;
  setSaucerSpawning(s: ReadState, v: boolean): ShatterState;
  setSaucerDue(s: ReadState, n: number): ShatterState;
  setShipPosition(s: ReadState, x: number, y: number): ShatterState;
  setShipVelocity(s: ReadState, vx: number, vy: number): ShatterState;
  setShipAngle(s: ReadState, n: number): ShatterState;
  setShipInvuln(s: ReadState, n: number): ShatterState;
  setFireCooldown(s: ReadState, n: number): ShatterState;
  setShipCollision(s: ReadState, v: boolean): ShatterState;
  addBullet(
    s: ReadState,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): ShatterState;
  removeBullet(s: ReadState, id: number): ShatterState;
  clearBullets(s: ReadState): ShatterState;
  addEnemyBullet(
    s: ReadState,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): ShatterState;
  removeEnemyBullet(s: ReadState, id: number): ShatterState;
  clearEnemyBullets(s: ReadState): ShatterState;
  addRock(s: ReadState, z: RockSize, x: number, y: number): ShatterState;
  setRockVelocity(
    s: ReadState,
    id: number,
    vx: number,
    vy: number,
  ): ShatterState;
  setRockHealth(s: ReadState, id: number, hp: number): ShatterState;
  removeRock(s: ReadState, id: number): ShatterState;
  clearRocks(s: ReadState): ShatterState;
  addSaucer(s: ReadState, x: number, y: number): ShatterState;
  setSaucerVelocity(s: ReadState, vx: number, vy: number): ShatterState;
  setSaucerWeave(s: ReadState, d: 1 | -1): ShatterState;
  removeSaucer(s: ReadState): ShatterState;
  setSaucerMind(s: ReadState, v: boolean): ShatterState;
  setSaucerGun(s: ReadState, v: boolean): ShatterState;
  setSaucerTravel(s: ReadState, v: boolean): ShatterState;
  setNextSaucerEdge(s: ReadState, e: SaucerEdge): ShatterState;
  setNextSaucerRow(s: ReadState, n: number): ShatterState;
  setNextSaucerAim(s: ReadState, n: number): ShatterState;
  setNextRockSpeed(s: ReadState, n: number): ShatterState;
  setNextRecycleEdge(s: ReadState, e: FieldEdge): ShatterState;
  setTorpedoCharge(s: ReadState, n: number): ShatterState;
  addTorpedo(s: ReadState, x: number, y: number, h: number): ShatterState;
  setTorpedoHeading(s: ReadState, id: number, h: number): ShatterState;
  setTorpedoHoming(s: ReadState, id: number, v: boolean): ShatterState;
  removeTorpedo(s: ReadState, id: number): ShatterState;
  clearTorpedoes(s: ReadState): ShatterState;
}
