/* My game — a coach-grade, between-games self-scout log, exported per session to Obsidian.
   Pure helpers only (no DOM) so tests/mylog.test.js can cover them. Local-only (D4 intact).

   Design (research-backed, see README "My game"):
   - Points are lost more than won: ~65% of rally turning points are bad shots, and bad lifts
     cost most (Hammes & Link 2025). So errors are logged by SOURCE shot + CAUSE, not just volume.
   - Doubles is decided in the first ~3 shots (avg rally ~7 shots): serve + return get their own rows.
   - Recall is decent for rare, salient events but undercounts errors (IJRSS tennis study):
     exact counts only for serve faults / flicks; everything else is a category tap.
   - Self-monitoring vs a plan is the SRL habit that separates skill levels: focus-in gets a hit check.
   - Session intensity is a qualitative rating (session-RPE idea, Foster / Haddad 2017) — no timing,
     because the phone isn't reliably at hand to start/stop rounds. */

export const MAX_FOCUS = 3;

export const ERROR_SOURCES = [
  { key: 'serve', label: 'Serve', focus: 'serve-short' },
  { key: 'return', label: 'Return', focus: 'return' },
  { key: 'lift', label: 'Lift / clear', focus: 'lift' },
  { key: 'attack', label: 'Smash / attack', focus: 'attack' },
  { key: 'net', label: 'Net', focus: 'net' },
  { key: 'drive', label: 'Drives', focus: 'drive' },
  { key: 'defence', label: 'Defence', focus: 'defence' }
];
export const CAUSES = [
  { key: 'late', label: 'Late / off-balance', focus: 'footwork' },
  { key: 'technique', label: 'Technique', focus: null },
  { key: 'choice', label: 'Wrong shot choice', focus: 'selection' },
  { key: 'lapse', label: 'Lapse / rushed', focus: 'routine' }
];

export const FOCUS = [
  { key: 'errors', label: 'Cut unforced errors — play the percentage shot with margin over the tape' },
  { key: 'serve-short', label: 'Short serve — same prep every time, skim the tape' },
  { key: 'flick-serve', label: 'Flick serve — disguise it like the short serve, get it over the reach' },
  { key: 'flick-return', label: 'Reading the flick — racket up, weight ready to push back off the front foot' },
  { key: 'return', label: 'Return of serve — take it early at the tape, pick a target before the serve' },
  { key: 'lift', label: 'Lifts — full length to the back tramline, never mid-court' },
  { key: 'attack', label: 'Attack — steep but over the tape; mix smash, half-smash and drop' },
  { key: 'net', label: 'Net — soft hands, racket up, tight to the tape' },
  { key: 'drive', label: 'Flat exchanges — short backswing, keep it flat and fast' },
  { key: 'defence', label: 'Defence — low wide stance, block or drive instead of lifting' },
  { key: 'initiative', label: 'Taking the attack — hit down or flat, lift only when forced' },
  { key: 'rotation', label: 'Rotation — front-back attacking, side-by-side defending, call it' },
  { key: 'footwork', label: 'Footwork — split step on the opponent’s hit' },
  { key: 'selection', label: 'Shot selection — the high-percentage shot when under pressure' },
  { key: 'routine', label: 'Between-rally reset — breathe, pick the next serve/return plan' },
  { key: 'conditioning', label: 'Late-game legs — add a conditioning block this week' }
];

export function blankGame(extra = {}) {
  return { id: null, roundId: null, role: null, at: Date.now(), result: null, margin: null, errors: null,
    errorSources: [], errorCause: null, serveFaults: 0, flickTried: 0, flickLanded: 0, flickUnreached: 0,
    returnQ: null, control: null, rotation: null, legs: null, note: '', ...extra };
}
const norm = g => ({ ...blankGame(), ...g, errorSources: g.errorSources || [] });

/* Local calendar date, never toISOString (UTC shift rolls late sessions to the wrong day). */
export function localDate(ts) {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function localTime(ts) {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

const label = (list, key) => (list.find(x => x.key === key) || {}).label || key;
export const sourceLabel = k => label(ERROR_SOURCES, k);
export const causeLabel = k => label(CAUSES, k);
export function focusLabel(item) { const f = FOCUS.find(x => x.key === item); return f ? f.label : String(item); }

const tally = (games, fn) => { const t = {}; games.forEach(g => [].concat(fn(g) ?? []).forEach(k => { if (k) t[k] = (t[k] || 0) + 1 })); return t; };
const ranked = t => Object.entries(t).sort((a, b) => b[1] - a[1]);

export function summarize(gamesIn) {
  const games = (gamesIn || []).map(norm);
  const sum = k => games.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const tried = sum('flickTried'), landed = sum('flickLanded');
  const byRole = {};
  games.forEach(g => { if (!g.role) return; const r = byRole[g.role] || (byRole[g.role] = { n: 0, heavy: 0, won: 0 }); r.n++; if (g.errors === 'high') r.heavy++; if (g.result === 'won') r.won++; });
  return {
    n: games.length,
    won: games.filter(g => g.result === 'won').length,
    lost: games.filter(g => g.result === 'lost').length,
    errorHeavy: games.filter(g => g.errors === 'high').length,
    sources: ranked(tally(games, g => g.errorSources)),
    causes: ranked(tally(games, g => g.errorCause)),
    serveFaults: sum('serveFaults'),
    tried, landed, rate: tried ? Math.round((landed / tried) * 100) : null,
    unreached: sum('flickUnreached'),
    unreachedGames: games.filter(g => g.flickUnreached > 0).length,
    returns: tally(games, g => g.returnQ),
    control: tally(games, g => g.control),
    rotation: tally(games, g => g.rotation),
    legs: tally(games, g => g.legs),
    byRole
  };
}

/* Evidence-ranked focus suggestions. Each carries the reason a coach would give. */
export function suggestFocus(gamesIn) {
  const games = (gamesIn || []).map(norm), n = games.length;
  if (!n) return [];
  const bar = Math.max(2, Math.ceil(n * 0.3));
  const out = new Map();
  const add = (key, score, reason) => { const cur = out.get(key); if (!cur || cur.score < score) out.set(key, { key, score, reason }); };
  const ofN = c => `${c} of ${n} game${n === 1 ? '' : 's'}`;
  ERROR_SOURCES.forEach(s => {
    const hit = games.filter(g => g.errorSources.includes(s.key));
    const score = hit.reduce((t, g) => t + (g.errors === 'high' ? 1.5 : 1), 0);
    if (hit.length >= bar) add(s.focus, score + 1, `Errors came from ${s.label.toLowerCase()} in ${ofN(hit.length)}`);
  });
  CAUSES.forEach(c => {
    if (!c.focus) return;
    const k = games.filter(g => g.errorCause === c.key).length;
    if (k >= bar) add(c.focus, k, `Main error cause was “${c.label.toLowerCase()}” in ${ofN(k)}`);
  });
  const s = summarize(games);
  if (s.serveFaults >= 2) add('serve-short', s.serveFaults, `${s.serveFaults} serve faults`);
  if (s.tried >= 3 && s.landed / s.tried < 0.5) add('flick-serve', 2, `Flick serve landed ${s.landed}/${s.tried}`);
  if (s.unreached >= 2) add('flick-return', s.unreached, `${s.unreached} flick serves out of reach`);
  const gave = s.returns.gave || 0;
  if (gave >= bar) add('return', gave + 1, `Returns gave the attack away in ${ofN(gave)}`);
  const them = s.control.them || 0;
  if (them >= bar && them / n >= 0.5) add('initiative', them, `Opponents had the attack in ${ofN(them)}`);
  const mix = (s.rotation.many || 0) * 2 + (s.rotation.some || 0);
  if (mix >= 3) add('rotation', mix / 2, `Positional mix-ups in ${ofN((s.rotation.many || 0) + (s.rotation.some || 0))}`);
  if ((s.legs.heavy || 0) >= bar) add('conditioning', s.legs.heavy, `Heavy legs in ${ofN(s.legs.heavy)}`);
  if (!out.size && s.errorHeavy >= bar) add('errors', s.errorHeavy, `Many unforced errors in ${ofN(s.errorHeavy)}`);
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, MAX_FOCUS);
}

/* Partner/opponents for `meId` in a logged round, as display names. */
export function sides(round, meId, nameOf) {
  if (!round || !meId) return null;
  const inA = round.teamA.some(p => p.id === meId), inB = round.teamB.some(p => p.id === meId);
  if (!inA && !inB) return null;
  const mine = inA ? round.teamA : round.teamB, theirs = inA ? round.teamB : round.teamA;
  return { partner: mine.filter(p => p.id !== meId).map(p => nameOf(p.id)), opponents: theirs.map(p => nameOf(p.id)) };
}

export const INTENSITY = [
  { key: 'easy', label: 'Easy' }, { key: 'moderate', label: 'Moderate' }, { key: 'hard', label: 'Hard' },
  { key: 'very-hard', label: 'Very hard' }, { key: 'max', label: 'Max' }
];
export const intensityLabel = k => label(INTENSITY, k);

const cell = t => String(t ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const yq = t => JSON.stringify(String(t));
const W = { won: 'W', lost: 'L' }, RET = { attack: 'attacked', neutral: 'neutral', gave: 'gave away' },
  CTRL = { us: 'us', even: 'even', them: 'them' }, ROT = { clean: 'clean', some: 'some', many: 'many' },
  ROLE = { carry: 'Carry', intensity: 'Intensity', light: 'Light' };
const ENERGY = { low: 'Low', ok: 'OK', high: 'High' }, HIT = { yes: 'Yes', partly: 'Partly', no: 'No' };

export function noteName(startedAt) { return `${localDate(startedAt)} Netflick`; }

export function toMarkdown({ startedAt, me, rounds, meId, nameOf }) {
  const games = (me.games || []).map(norm), s = summarize(games);
  const intensity = me.intensity ? intensityLabel(me.intensity) : '';
  const focusIn = me.focusIn || [], focusNext = me.focusNext || [], hits = me.focusHit || {};
  const reasons = Object.fromEntries(suggestFocus(games).map(x => [x.key, x.reason]));
  const title = new Date(startedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const ylist = (key, items) => items.length ? `${key}:\n${items.map(i => `  - ${yq(i)}`).join('\n')}` : `${key}: []`;
  const hitCount = focusIn.filter(f => hits[f] === 'yes').length;
  const L = [];
  L.push('---', `date: ${localDate(startedAt)}`, 'type: badminton-session',
    `games: ${s.n}`, `wins: ${s.won}`, `losses: ${s.lost}`, `error_heavy_games: ${s.errorHeavy}`,
    ylist('top_error_sources', s.sources.slice(0, 3).map(([k]) => sourceLabel(k))),
    `top_error_cause: ${s.causes[0] ? yq(causeLabel(s.causes[0][0])) : '""'}`,
    `serve_faults: ${s.serveFaults}`, `flick_serves_tried: ${s.tried}`, `flick_serves_landed: ${s.landed}`,
    `flick_serve_rate: ${s.rate ?? ''}`, `flicks_unreached: ${s.unreached}`,
    `returns_gave_away: ${s.returns.gave || 0}`, `positional_mixups: ${(s.rotation.some || 0) + (s.rotation.many || 0)}`,
    `energy_in: ${me.energy ? ENERGY[me.energy] : ''}`, `session_intensity: ${intensity}`,
    ylist('focus_this_session', focusIn.map(focusLabel)), `focus_hit: ${focusIn.length ? `${hitCount}/${focusIn.length}` : '""'}`,
    ylist('focus_next', focusNext.map(focusLabel)), 'tags:', '  - badminton', '  - netflick', '---', '',
    `# Badminton · ${title}`, '');

  L.push('## Coming in', `- Energy: ${me.energy ? ENERGY[me.energy] : '—'}`);
  if (focusIn.length) focusIn.forEach(f => L.push(`- Focus: ${focusLabel(f)} — worked on it? **${hits[f] ? HIT[hits[f]] : '—'}**`));
  else L.push('- Focus: none carried in');
  L.push('');

  L.push('## Scoreboard', '| | |', '|---|---|',
    `| Games | ${s.n} (W ${s.won} · L ${s.lost}) |`,
    `| Unforced errors | Many in ${s.errorHeavy} of ${s.n} |`,
    `| Serve | ${s.serveFaults} fault${s.serveFaults === 1 ? '' : 's'} · flick ${s.tried ? `${s.landed}/${s.tried} (${s.rate}%)` : 'none tried'} |`,
    `| Receive | returns attacked ${s.returns.attack || 0} · neutral ${s.returns.neutral || 0} · gave away ${s.returns.gave || 0} · flicks out of reach ${s.unreached} |`,
    `| Who had the attack | us ${s.control.us || 0} · even ${s.control.even || 0} · them ${s.control.them || 0} |`,
    `| Positional mix-ups | some ${s.rotation.some || 0} · many ${s.rotation.many || 0} |`,
    `| Session intensity | ${intensity || '—'} |`, '');

  L.push('## Where points leaked');
  if (s.sources.length) L.push(`- By shot: ${s.sources.map(([k, c]) => `${sourceLabel(k)} ×${c}`).join(' · ')}`);
  if (s.causes.length) L.push(`- By cause: ${s.causes.map(([k, c]) => `${causeLabel(k)} ×${c}`).join(' · ')}`);
  const roles = Object.entries(s.byRole);
  if (roles.length) L.push(`- By game type: ${roles.map(([r, v]) => `${ROLE[r] || r} — many errors ${v.heavy}/${v.n}, won ${v.won}/${v.n}`).join(' · ')}`);
  if (!s.sources.length && !s.causes.length && !roles.length) L.push('- Not enough logged yet');
  L.push('');

  if (s.n) {
    L.push('## Games', '| # | Time | Partner | Opponents | Type | Result | Errors | Serve | Return | Attack | Mix-ups | Legs | Note |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    games.forEach((g, i) => {
      const sd = sides((rounds || []).find(r => r.id === g.roundId), meId, nameOf || (x => x));
      const err = g.errors === 'high' ? 'Many' : g.errors === 'low' ? 'Few' : '—';
      const errDetail = [g.errorSources.map(sourceLabel).join(', '), g.errorCause ? `cause: ${causeLabel(g.errorCause).toLowerCase()}` : ''].filter(Boolean).join('; ');
      const serve = [g.serveFaults ? `${g.serveFaults} fault${g.serveFaults === 1 ? '' : 's'}` : '', g.flickTried ? `flick ${g.flickLanded}/${g.flickTried}` : ''].filter(Boolean).join(', ') || '—';
      const ret = [g.returnQ ? RET[g.returnQ] : '', g.flickUnreached ? `${g.flickUnreached} flick${g.flickUnreached === 1 ? '' : 's'} missed` : ''].filter(Boolean).join(', ') || '—';
      L.push(`| ${i + 1} | ${localTime(g.at)} | ${cell(sd ? sd.partner.join(', ') : '')} | ${cell(sd ? sd.opponents.join(' & ') : '')} | ${g.role ? ROLE[g.role] : ''} | ${g.result ? W[g.result] + (g.margin ? ` (${g.margin})` : '') : '—'} | ${err}${errDetail ? ` — ${cell(errDetail)}` : ''} | ${serve} | ${ret} | ${g.control ? CTRL[g.control] : '—'} | ${g.rotation ? ROT[g.rotation] : '—'} | ${g.legs || '—'} | ${cell(g.note)} |`);
    });
    L.push('');
  }

  L.push('## What worked', me.worked ? me.worked : '—', '');
  L.push('## Focus next session', ...(focusNext.length ? focusNext.map(i => `- [ ] ${focusLabel(i)}${reasons[i] ? ` — *${reasons[i]}*` : ''}`) : ['- (not chosen)']), '');
  return L.join('\n');
}

export function obsidianUrl({ vault, folder, name, content }) {
  const path = [String(folder || '').replace(/^\/+|\/+$/g, ''), name].filter(Boolean).join('/');
  const q = [vault ? `vault=${encodeURIComponent(vault)}` : null, `file=${encodeURIComponent(path)}`,
    `content=${encodeURIComponent(content)}`, 'overwrite=true'].filter(Boolean).join('&');
  return `obsidian://new?${q}`;
}
