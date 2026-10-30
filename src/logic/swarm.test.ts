import { describe, expect, it } from 'vitest';
import { SWARM } from '../config/balance';
import { createRng } from './rng';
import { speedFactor, Swarm, VelocityEstimator, type SwarmAgent, type SwarmParams } from './swarm';

function agent(x: number, y: number, over: Partial<SwarmAgent> = {}): SwarmAgent {
  return {
    x,
    y,
    radius: 12,
    moveSpeed: 100,
    phase: 0,
    arc: 0,
    lead: 0,
    wobble: SWARM.wobble,
    wobbleHz: SWARM.wobbleHz,
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

describe('flyers', () => {
  it('are neither avoided by the crowd nor pushed by it', () => {
    const swarm = new Swarm<SwarmAgent>({ ...SWARM, wobble: 0 });
    const walker = agent(0, 0, { aimX: 2000, aimY: 0, nextAimAt: 1e9 });
    const flyer = agent(0, 4, { aimX: 2000, aimY: 0, nextAimAt: 1e9, flies: true });
    swarm.steer([walker, flyer], { x: 2000, y: 0 }, 0, createRng(3));
    expect(walker.steerY).toBeCloseTo(0, 5);
    expect(Math.abs(flyer.steerY)).toBeLessThan(0.5); // only the aim, no push
    const before = [walker.x, walker.y, flyer.x, flyer.y];
    swarm.separate();
    expect([walker.x, walker.y, flyer.x, flyer.y]).toEqual(before);
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
      wobble: params.wobble,
      wobbleHz: params.wobbleHz,
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

// ------------------------------------------------------------------ behaviours

/** Angle of an agent's velocity (radians, 0 = east). */
const heading = (a: SwarmAgent) => Math.atan2(a.steerY, a.steerX);

/** Params without the usual drift, so only the behaviour under test bends the course. */
const steady = { wobble: 0 };

/** Steers one agent on its own, so that neighbours do not bend its course. */
function steerAlone(
  a: SwarmAgent,
  target: { x: number; y: number },
  targetVelocity = { x: 0, y: 0 },
): number {
  new Swarm<SwarmAgent>().steer([a], target, 0, createRng(1), targetVelocity);
  return heading(a);
}

describe('arc', () => {
  it('bends the course while far away, to the side given by its sign', () => {
    expect(steerAlone(agent(-800, 0, { ...steady, arc: 0.6 }), { x: 0, y: 0 })).toBeCloseTo(0.6, 1);
    expect(steerAlone(agent(-800, 0, { ...steady, arc: -0.6 }), { x: 0, y: 0 })).toBeCloseTo(-0.6, 1);
  });

  it('straightens out right next to the player', () => {
    expect(Math.abs(steerAlone(agent(-30, 0, { ...steady, arc: 0.6 }), { x: 0, y: 0 }))).toBeLessThan(0.05);
  });

  it('does nothing for a straight chaser', () => {
    expect(Math.abs(steerAlone(agent(-800, 0, steady), { x: 0, y: 0 }))).toBeLessThan(0.01);
  });
});

describe('lead', () => {
  it('aims ahead of a player who is moving', () => {
    const player = { x: 0, y: 0 };
    const running = { x: 0, y: 100 }; // south
    const ahead = steerAlone(agent(-600, 0, { ...steady, lead: 1 }), player, running);
    const behind = steerAlone(agent(-600, 0, steady), player, running);
    expect(ahead).toBeGreaterThan(0.1); // toward where the player is going
    expect(Math.abs(behind)).toBeLessThan(0.01);
  });

  it('never aims further ahead than it needs to get there', () => {
    // Right next to a fast player: looking a full second ahead would send it far past them.
    const uncapped = Math.atan2(400, 20);
    const h = steerAlone(agent(-20, 0, { ...steady, lead: 1 }), { x: 0, y: 0 }, { x: 0, y: 400 });
    expect(h).toBeLessThan(uncapped - 0.1);
  });

  it('does nothing when the player stands still', () => {
    expect(Math.abs(steerAlone(agent(-600, 0, { ...steady, lead: 1 }), { x: 0, y: 0 }))).toBeLessThan(0.01);
  });
});

describe('flutter (a bigger sway)', () => {
  /** The strongest sideways push over two seconds of an enemy that is far from the player. */
  function widestSwing(wobble: number, wobbleHz: number): number {
    const a = agent(-3000, 0, { wobble, wobbleHz, aimX: 0, aimY: 0, nextAimAt: 1e12 });
    const swarm = new Swarm<SwarmAgent>();
    let widest = 0;
    for (let t = 0; t < 2000; t += 20) {
      swarm.steer([a], { x: 0, y: 0 }, t, createRng(1));
      widest = Math.max(widest, Math.abs(a.steerY));
    }
    return widest;
  }

  it('swings much wider than the usual drift', () => {
    expect(widestSwing(0.9, 1.1)).toBeGreaterThan(widestSwing(SWARM.wobble, SWARM.wobbleHz) * 1.5);
  });
});

describe('estimating the speed of the player', () => {
  it('finds the speed of a steady walk', () => {
    const v = new VelocityEstimator();
    for (let i = 0; i < 120; i++) v.update(i * (100 / 60), -i * (40 / 60), i * (1000 / 60));
    expect(v.x).toBeCloseTo(100, 0);
    expect(v.y).toBeCloseTo(-40, 0);
  });

  it('starts at zero and starts over after a long gap (pause, jump)', () => {
    const v = new VelocityEstimator();
    v.update(0, 0, 0);
    expect(v.x).toBe(0);
    for (let i = 1; i < 30; i++) v.update(i * 2, 0, i * 16);
    expect(v.x).toBeGreaterThan(50);
    v.update(5000, 0, 5000); // one second later and far away
    expect(v.x).toBe(0);
  });
});

describe('flankers in a chase', () => {
  /** 30 enemies hunt a player who walks north at 90 px/s; returns how many are within 100 px after 30 s. */
  function arrived(over: Partial<SwarmAgent>): number {
    const rng = createRng(21);
    const swarm = new Swarm<SwarmAgent>();
    const agents = Array.from({ length: 30 }, (_, i) =>
      agent(-500 - rng() * 100, (rng() - 0.5) * 400, {
        phase: i,
        moveSpeed: 118,
        ...over,
        arc: (over.arc ?? 0) * (i % 2 === 0 ? 1 : -1),
      }),
    );
    const player = { x: 0, y: 0 };
    const velocity = new VelocityEstimator();
    const dt = 1 / 60;
    for (let step = 0; step < 30 * 60; step++) {
      const t = step * dt;
      player.y = -90 * t;
      velocity.update(player.x, player.y, t * 1000);
      swarm.steer(agents, player, t * 1000, rng, velocity);
      for (const a of agents) {
        a.x += a.steerX * dt;
        a.y += a.steerY * dt;
      }
      swarm.separate();
    }
    return agents.filter((a) => Math.hypot(a.x - player.x, a.y - player.y) < 100).length;
  }

  it('still catch up with the player, they do not circle for ever', () => {
    expect(arrived({ arc: 0.66, lead: 1.1 })).toBeGreaterThanOrEqual(25);
  });
});
