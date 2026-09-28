import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, summarize, suggestFocus, sides, toMarkdown, obsidianUrl, noteName, blankGame, FOCUS, ERROR_SOURCES, CAUSES } from '../mylog.js';

const at = new Date(2026, 8, 28, 20, 5).getTime();
const G = (o = {}) => blankGame({ id: Math.random().toString(36), at, ...o });

test('localDate uses local calendar day, not UTC', () => {
  assert.equal(localDate(new Date(2026, 8, 28, 23, 50).getTime()), '2026-09-28');
  assert.equal(noteName(new Date(2026, 8, 28, 23, 50).getTime()), '2026-09-28 Netflick');
});

test('every error source / cause focus key exists in the focus catalogue', () => {
  const keys = new Set(FOCUS.map(f => f.key));
  [...ERROR_SOURCES, ...CAUSES].forEach(x => { if (x.focus) assert.ok(keys.has(x.focus), x.focus) });
});

test('summarize: totals, tallies, role split; tolerates legacy games', () => {
  const s = summarize([
    G({ result: 'won', errors: 'high', errorSources: ['lift', 'net'], errorCause: 'late', flickTried: 3, flickLanded: 1, flickUnreached: 2, returnQ: 'gave', role: 'intensity' }),
    G({ result: 'lost', errors: 'low', errorSources: ['lift'], flickTried: 4, flickLanded: 3, role: 'light' }),
    { id: 'legacy', at, errors: 'high', flickTried: 0, flickLanded: 0, flickUnreached: 1 }
  ]);
  assert.equal(s.n, 3); assert.equal(s.won, 1); assert.equal(s.lost, 1); assert.equal(s.errorHeavy, 2);
  assert.deepEqual(s.sources[0], ['lift', 2]); assert.equal(s.rate, 57); assert.equal(s.unreached, 3);
  assert.deepEqual(s.byRole.intensity, { n: 1, heavy: 1, won: 1 });
});

test('suggestFocus ranks by evidence and explains why', () => {
  const games = [
    G({ errors: 'high', errorSources: ['lift'], errorCause: 'late', returnQ: 'gave' }),
    G({ errors: 'high', errorSources: ['lift', 'attack'], errorCause: 'late', returnQ: 'gave' }),
    G({ errors: 'low', errorSources: ['lift'], returnQ: 'neutral', flickUnreached: 2 })
  ];
  const f = suggestFocus(games);
  assert.equal(f.length, 3);
  assert.equal(f[0].key, 'lift'); assert.match(f[0].reason, /lift \/ clear in 3 of 3/);
  assert.deepEqual(f.map(x => x.key).sort(), ['flick-return', 'footwork', 'lift', 'return'].filter(k => f.some(x => x.key === k)).sort());
  assert.deepEqual(suggestFocus([]), []);
  // a single stray tag is not a pattern
  assert.deepEqual(suggestFocus([G({ errors: 'low', errorSources: ['net'] }), G({ errors: 'low' })]), []);
});

test('sides resolves partner and opponents for me', () => {
  const r = { id: 'r1', teamA: [{ id: 'x' }, { id: 'y' }], teamB: [{ id: 'me' }, { id: 'p' }] };
  assert.deepEqual(sides(r, 'me', id => id.toUpperCase()), { partner: ['P'], opponents: ['X', 'Y'] });
  assert.equal(sides(r, 'zz', x => x), null);
});

test('markdown: frontmatter, load, leak analysis, games row, focus with reasons', () => {
  const rounds = [{ id: 'r1', court: 1, startedAt: at - 18 * 60000, endedAt: at, teamA: [{ id: 'me' }, { id: 'p' }], teamB: [{ id: 'x' }, { id: 'y' }] }];
  const lift = { errors: 'high', errorSources: ['lift'], errorCause: 'late' };
  const me = { games: [G({ ...lift, roundId: 'r1', role: 'intensity', result: 'lost', margin: 'close', serveFaults: 1, flickTried: 3, flickLanded: 2, flickUnreached: 1, returnQ: 'gave', control: 'them', rotation: 'some', legs: 'heavy', note: 'late | on lifts' }), G(lift)],
    focusIn: ['return'], focusHit: { return: 'partly' }, focusNext: ['lift', 'Split step drill'], energy: 'ok', intensity: 'very-hard', worked: 'Short serve felt steady' };
  const md = toMarkdown({ startedAt: new Date(2026, 8, 28, 19).getTime(), me, rounds, meId: 'me', nameOf: id => ({ p: 'Tesa', x: 'Leo', y: 'Verry' })[id] });
  assert.match(md, /^---\ndate: 2026-09-28\n/);
  assert.match(md, /session_intensity: Very hard\n/);
  assert.match(md, /\| Session intensity \| Very hard \|/);
  assert.doesNotMatch(md, /minutes|load/i);
  assert.match(md, /focus_hit: 0\/1/);
  assert.match(md, /top_error_cause: "Late \/ off-balance"/);
  assert.match(md, /Focus: Return of serve .* worked on it\? \*\*Partly\*\*/);
  assert.match(md, /By shot: Lift \/ clear ×2/);
  assert.match(md, /Intensity — many errors 1\/1, won 0\/1/);
  assert.match(md, /\| 1 \| 20:05 \| Tesa \| Leo & Verry \| Intensity \| L \(close\) \| Many — Lift \/ clear; cause: late \/ off-balance \| 1 fault, flick 2\/3 \| gave away, 1 flick missed \| them \| some \| heavy \| late \/ on lifts \|/);
  assert.match(md, /- \[ \] Lifts — .* — \*Errors came from lift \/ clear in 2 of 2 games\*/);
  assert.match(md, /- \[ \] Split step drill\n/);
});

test('obsidian url encodes path and omits empty vault', () => {
  assert.equal(obsidianUrl({ vault: '', folder: '/Badminton/Netflick/', name: '2026-09-28 Netflick', content: '# a&b' }),
    'obsidian://new?file=Badminton%2FNetflick%2F2026-09-28%20Netflick&content=%23%20a%26b&overwrite=true');
});
