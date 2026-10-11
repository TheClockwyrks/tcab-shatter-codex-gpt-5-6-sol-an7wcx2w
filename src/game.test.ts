import { describe, expect, it } from "vitest";
import {
  CORE_R,
  ROCK_HEALTH,
  SHIP_R,
  TICK_DT,
  TORPEDO_SPEED,
} from "./constants";
import { initialState, makeDebug, snapshot } from "./core";
import { sounds, tick } from "./simulation";

const idle = {
  left: false,
  right: false,
  thrust: false,
  fire: false,
  torpedo: false,
};

describe("Shatter simulation", () => {
  it("provides the opening state and automation snapshot", () => {
    expect(snapshot(initialState())).toMatchObject({
      version: 1,
      screen: "title",
      lives: 3,
      wave: 0,
      torpedoReady: true,
      rocks: [],
    });
  });

  it("pulls bullets but not the powered ship", () => {
    const debug = makeDebug();
    let state = debug.setScreen(initialState(), "playing");
    state = debug.setWaveSpawning(state, false);
    state = debug.addBullet(state, 200, 360, 0, 0);
    const next = tick(idle, state, sounds());
    expect(next.bullets[0]!.vx).toBeGreaterThan(0);
    expect(next.ship.vx).toBe(0);
    expect(next.simTime).toBeCloseTo(TICK_DT);
  });

  it("chips armor, then splits a large rock and scores", () => {
    const debug = makeDebug();
    let state = debug.setScreen(initialState(), "playing");
    state = debug.setWaveSpawning(state, false);
    state = debug.addRock(state, "large", 200, 200);
    const id = state.rocks[0]!.id;
    for (let hp = ROCK_HEALTH.large; hp > 0; hp--) {
      state = debug.addBullet(state, 200, 200, 1, 0);
      state = tick(idle, state, sounds());
      if (hp > 1)
        expect(state.rocks.find((r) => r.id === id)?.health).toBe(hp - 1);
    }
    expect(state.score).toBe(20);
    expect(state.rocks).toHaveLength(2);
    expect(state.rocks.every((r) => r.size === "medium")).toBe(true);
  });

  it("lets a torpedo destroy armor outright", () => {
    const debug = makeDebug();
    let state = debug.setScreen(initialState(), "playing");
    state = debug.setWaveSpawning(state, false);
    state = debug.addRock(state, "large", 300, 250);
    state = debug.addTorpedo(state, 300, 250, 0);
    state = tick(idle, state, sounds());
    expect(state.score).toBe(20);
    expect(state.rocks.every((r) => r.size === "medium")).toBe(true);
    expect(state.torpedoes).toHaveLength(0);
  });

  it("slides the ship off the core without losing a life", () => {
    const debug = makeDebug();
    let state = debug.setScreen(initialState(), "playing");
    state = debug.setShipPosition(state, 640, 360);
    state = tick(idle, state, sounds());
    expect(Math.hypot(state.ship.x - 640, state.ship.y - 360)).toBeCloseTo(
      CORE_R + SHIP_R,
    );
    expect(state.lives).toBe(3);
  });

  it("validates poses and turns torpedo velocity", () => {
    const debug = makeDebug();
    let state = debug.addTorpedo(initialState(), 10, 20, 0);
    const id = state.torpedoes[0]!.id;
    state = debug.setTorpedoHeading(state, id, Math.PI / 2);
    expect(state.torpedoes[0]!.vx).toBeCloseTo(0);
    expect(state.torpedoes[0]!.vy).toBeCloseTo(TORPEDO_SPEED);
    expect(() => debug.removeRock(state, 999)).toThrow(/not live/);
  });
});
