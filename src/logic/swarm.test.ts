import { describe, expect, it } from 'vitest';
import { SWARM } from '../config/balance';
import { createRng } from './rng';
import { speedFactor, Swarm, type SwarmAgent, type SwarmParams } from './swarm';

function agent(x: number, y: number, over: Partial<SwarmAgent> = {}): SwarmAgent {
  return {
    x,
    y,
    radius: 12,
    moveSpeed: 100,
    phase: 0,
    aimX: 0,
    aimY: 0,
    nextAimAt: 0,
    steerX: 0,
    steerY: 0,
    ...over,
  };
}

/** The old behaviour: straight at the player, only bodies that overlap get pushed apart. */
const PLAIN: SwarmParams = {
  ...SWARM,
  separation: 0,
  separationNear: 0,
  wobble: 0,
  aimLagMin: 0,
  aimLagMax: 0,
  speedJitter: 0.12,
};

describe('steering', () => {
  it('heads for the player when nothing is in the way', () => {
    const swarm = new Swarm<SwarmAgent>();
    const a = agent(-500, 0, { phase: 0 });
    swarm.steer([a], { x: 0, y: 0 }, 0, createRng(1));
    expect(a.steerX).toBeGreaterThan(80);
    expect(Math.abs(a.steerY)).toBeLessThan(40);
  });

  it('never moves faster than its own speed', () => {
    const swarm = new Swarm<SwarmAgent>();
    const crowd = Array.from({ length: 30 }, (_, i) =>
      agent((i % 6) * 5, Math.floor(i / 6) * 5, { phase: i }),
    );
    swarm.steer(crowd, { x: 400, y: 0 }, 1234, createRng(2));
    for (const a of crowd) expect(Math.hypot(a.steerX, a.steerY)).toBeLessThanOrEqual(a.moveSpeed + 1e-6);
  });

  it('pushes close neighbours apart', () => {
    const swarm = new Swarm<SwarmAgent>();
    // Both far from the player, one directly above the other.
    const a = agent(0, 0, { aimX: 2000, aimY: 0, nextAimAt: 1e9 });
    const b = agent(0, 14, { aimX: 2000, aimY: 0, nextAimAt: 1e9 });
    swarm.steer([a, b], { x: 2000, y: 0 }, 0, createRng(3));
    expect(a.steerY).toBeLessThan(0);
    expect(b.steerY).toBeGreaterThan(0);
  });

  it('ignores neighbours that are far enough away', () => {
    const swarm = new Swarm<SwarmAgent>({ ...SWARM, wobble: 0 });
    const a = agent(0, 0, { aimX: 2000, aimY: 0, nextAimAt: 1e9 });
    const b = agent(0, 200);
    swarm.steer([a, b], { x: 2000, y: 0 }, 0, createRng(3));
    expect(a.steerY).toBeCloseTo(0, 5);
  });

  it('keeps its aim until it looks at the player again, when far away', () => {
    const swarm = new Swarm<SwarmAgent>();
    const a = agent(-1000, 0);
    swarm.steer([a], { x: 0, y: 0 }, 0, createRng(4));
    expect(a.aimX).toBe(0);
    expect(a.nextAimAt).toBeGreaterThanOrEqual(SWARM.aimLagMin);
    expect(a.nextAimAt).toBeLessThanOrEqual(SWARM.aimLagMax);
    swarm.steer([a], { x: 0, y: 600 }, SWARM.aimLagMin - 1, createRng(4));
    expect(a.aimY).toBe(0); // still the old spot
    swarm.steer([a], { x: 0, y: 600 }, SWARM.aimLagMax + 1, createRng(4));
    expect(a.aimY).toBe(600);
  });

  it('always aims at the player in biting range', () => {
    const swarm = new Swarm<SwarmAgent>();
    const a = agent(-100, 0, { aimX: 5, aimY: 5, nextAimAt: 1e9 });
    swarm.steer([a], { x: 0, y: 0 }, 0, createRng(5));
    expect(a.aimX).toBe(0);
    expect(a.aimY).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const swarm = new Swarm<SwarmAgent>();
      const rng = createRng(9);
      const crowd = Array.from({ length: 20 }, (_, i) => agent(rng() * 300, rng() * 300, { phase: i }));
      swarm.steer(crowd, { x: 150, y: 150 }, 500, rng);
      return crowd.map((a) => [a.steerX, a.steerY]);
    };
    expect(run()).toEqual(run());
  });
});

describe('separating bodies', () => {
  it('pushes overlapping bodies apart, also when exactly on top of each other', () => {
    const swarm = new Swarm<SwarmAgent>();
    const a = agent(0, 0, { phase: 0.3 });
    const b = agent(0, 0, { phase: 1.1 });
    swarm.steer([a, b], { x: 1000, y: 1000 }, 0, createRng(6));
    swarm.separate();
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0);
  });
});

describe('speed variation', () => {
  it('stays within the jitter', () => {
    const rng = createRng(11);
    for (let i = 0; i < 200; i++) {
      const f = speedFactor(SWARM, rng);
      expect(f).toBeGreaterThanOrEqual(1 - SWARM.speedJitter);
      expect(f).toBeLessThanOrEqual(1 + SWARM.speedJitter);
    }
  });
});

// ------------------------------------------------------------------ the point of it all

/** Most enemies within `r` of any single enemy (itself included): the size of the biggest clump. */
function biggestClump(agents: readonly SwarmAgent[], r: number): number {
  let best = 0;
  for (const a of agents) {
    let n = 0;
    for (const b of agents) if (Math.hypot(a.x - b.x, a.y - b.y) <= r) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** 150 enemies chase a player who walks in a circle for 40 seconds; returns the final crowd. */
function chase(params: SwarmParams, seed: number): SwarmAgent[] {
  const rng = createRng(seed);
  const swarm = new Swarm<SwarmAgent>(params);
  const agents = Array.from({ length: 150 }, () => {
    const angle = rng() * Math.PI * 2;
    const dist = 450 + rng() * 150;
    return agent(Math.cos(angle) * dist, Math.sin(angle) * dist, {
      phase: rng() * Math.PI * 2,
      moveSpeed: 85 * speedFactor(params, rng),
    });
  });
  const target = { x: 0, y: 0 };
  const dt = 1 / 60;
  for (let step = 0; step < 40 * 60; step++) {
    const t = step * dt;
    // A circle of radius 300 at 0.3 rad/s: walking speed 90 px/s.
    target.x = Math.cos(t * 0.3) * 300;
    target.y = Math.sin(t * 0.3) * 300;
    swarm.steer(agents, target, t * 1000, rng);
    for (const a of agents) {
      a.x += a.steerX * dt;
      a.y += a.steerY * dt;
    }
    swarm.separate();
  }
  return agents;
}

describe('the horde as a whole', () => {
  it('stays a looser crowd than plain chasing', () => {
    for (const seed of [1, 2, 3]) {
      const loose = biggestClump(chase(SWARM, seed), 60);
      const plain = biggestClump(chase(PLAIN, seed), 60);
      // Measured at the time of writing: about a third (the plain horde is one single blob).
      expect(loose).toBeLessThan(plain * 0.5);
    }
  });

  it('still reaches the player', () => {
    const agents = chase(SWARM, 4);
    const t = 40;
    const player = { x: Math.cos(t * 0.3) * 300, y: Math.sin(t * 0.3) * 300 };
    const near = agents.filter((a) => Math.hypot(a.x - player.x, a.y - player.y) < 80).length;
    expect(near).toBeGreaterThanOrEqual(10);
  });
});
