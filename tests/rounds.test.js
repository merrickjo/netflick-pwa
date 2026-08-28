import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTITIONS, strength, lineupType, roundRole, roundTier } from '../engine.js';

const L = { A: 3, B: 2, C: 1 };
const P = (id, level, gender = 'Male') => ({ id, level, gender });
const R = (a, b) => ({ teamA: a, teamB: b });
const ALL = ['A', 'B', 'C'];

test('carry = strictly stronger than own partner, regardless of opposition', () => {
  // A + C  vs  A + A  -> carry wins over intensity by precedence
  assert.equal(roundRole(R([P('me','A'),P('p','C')], [P('x','A'),P('y','A')]), 'me'), 'carry');
  // A + C  vs  C + C  -> carry, easy opposition
  assert.equal(roundRole(R([P('me','A'),P('p','C')], [P('x','C'),P('y','C')]), 'me'), 'carry');
});

test('intensity = equal-or-stronger opposition, when not carrying', () => {
  // even A court: 6 vs 6 -> equal counts as intensity
  assert.equal(roundRole(R([P('me','A'),P('p','A')], [P('x','A'),P('y','A')]), 'me'), 'intensity');
  // being carried by a stronger partner, facing a stronger team
  assert.equal(roundRole(R([P('me','C'),P('p','A')], [P('x','A'),P('y','A')]), 'me'), 'intensity');
});

test('light = decent partner, strictly weaker opposition', () => {
  assert.equal(roundRole(R([P('me','A'),P('p','A')], [P('x','C'),P('y','C')]), 'me'), 'light');
  assert.equal(roundRole(R([P('me','C'),P('p','A')], [P('x','C'),P('y','C')]), 'me'), 'light');
});

test('MECE: every player of every level combination gets exactly one role', () => {
  const seen = new Set();
  let n = 0;
  for (const a of ALL) for (const b of ALL) for (const c of ALL) for (const d of ALL) {
    const round = R([P('p0', a), P('p1', b)], [P('p2', c), P('p3', d)]);
    for (const id of ['p0', 'p1', 'p2', 'p3']) {
      const role = roundRole(round, id);
      assert.ok(['carry', 'intensity', 'light'].includes(role), `bad role ${role}`);
      seen.add(role);
      n++;
    }
  }
  assert.equal(n, 81 * 4);
  assert.equal(seen.size, 3, 'all three roles are reachable');
});

test('MECE: role definitions do not overlap once carry has precedence', () => {
  for (const a of ALL) for (const b of ALL) for (const c of ALL) for (const d of ALL) {
    const round = R([P('p0', a), P('p1', b)], [P('p2', c), P('p3', d)]);
    const role = roundRole(round, 'p0');
    const carrying = L[a] > L[b];
    const facingEqualOrStronger = L[c] + L[d] >= L[a] + L[b];
    if (role === 'carry') assert.ok(carrying);
    if (role === 'intensity') assert.ok(!carrying && facingEqualOrStronger);
    if (role === 'light') assert.ok(!carrying && !facingEqualOrStronger);
  }
});

test('symmetry: both sides of an even court read the same', () => {
  const round = R([P('p0','B'),P('p1','B')], [P('p2','B'),P('p3','B')]);
  assert.deepEqual(['p0','p1','p2','p3'].map(id => roundRole(round, id)),
                   ['intensity','intensity','intensity','intensity']);
});

test('court tier follows the average level on court', () => {
  assert.equal(roundTier(R([P('a','A'),P('b','A')],[P('c','A'),P('d','A')])), 'A');
  assert.equal(roundTier(R([P('a','A'),P('b','A')],[P('c','B'),P('d','B')])), 'A'); // 2.5
  assert.equal(roundTier(R([P('a','A'),P('b','B')],[P('c','B'),P('d','B')])), 'B'); // 2.25
  assert.equal(roundTier(R([P('a','C'),P('b','C')],[P('c','C'),P('d','C')])), 'C');
  assert.equal(roundTier(R([P('a','B'),P('b','C')],[P('c','C'),P('d','C')])), 'C'); // 1.25
});

test('lineup type classifies MD / WD / XD and flags an illegal mix', () => {
  const M = l => P('m'+l, l, 'Male'), F = l => P('f'+l, l, 'Female');
  assert.equal(lineupType([M('A'),M('B'),M('C'),M('A')]), 'MD');
  assert.equal(lineupType([F('A'),F('B'),F('C'),F('A')]), 'WD');
  assert.equal(lineupType([M('A'),M('B'),F('C'),F('A')]), 'XD');
  assert.equal(lineupType([M('A'),M('B'),M('C'),F('A')]), 'MIX');
});

test('partitions cover all three distinct pairings of four players, no duplicates', () => {
  const keys = PARTITIONS.map(([a]) => a.slice().sort().join(''));
  assert.equal(new Set(keys).size, 3);
  for (const [a, b] of PARTITIONS) assert.equal(new Set([...a, ...b]).size, 4);
});

test('strength sums level points', () => {
  assert.equal(strength([P('a','A'),P('b','C')]), 4);
});
