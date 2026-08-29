const LEVEL = { A: 3, B: 2, C: 1 };

const byCountId = (a, b) => a.count - b.count || (a.lastUpdated ?? 0) - (b.lastUpdated ?? 0) || a.playerId.localeCompare(b.playerId);
const byLevelId = (a, b) => LEVEL[b.level] - LEVEL[a.level] || a.count - b.count || a.playerId.localeCompare(b.playerId);
const lex = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d; } return 0; };
const combinations = (arr, k, start = 0, picked = [], out = []) => {
  if (picked.length === k) { out.push([...picked]); return out; }
  for (let i = start; i <= arr.length - (k - picked.length); i++) { picked.push(arr[i]); combinations(arr, k, i + 1, picked, out); picked.pop(); }
  return out;
};
const removeIds = (arr, used) => arr.filter(p => !used.has(p.playerId));
const teamStrength = team => team.reduce((n, p) => n + LEVEL[p.level], 0);
const keyPlayers = ps => ps.map(p => p.playerId).sort().join('|');

// Ranks a candidate match by fairness (lower total count wins first, same priority
// order as the rest of the app), then level gap, then a deterministic key.
const matchCmp = (x, y) => x.fairness - y.fairness || x.gap - y.gap || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0);

// avoid = a Set of four-player signatures (keyPlayers(four)) to steer away from when
// possible -- used by "Refresh" to surface a genuinely different grouping instead of
// reproducing the exact same four people every time it's pressed. It's a soft steer,
// not a hard filter: if every option is avoided, the fairest one still gets returned.
function bestSameGenderMatch(players, avoid) {
  let best = null, bestAllowed = null;
  for (const four of combinations(players, 4)) {
    const [a,b,c,d] = four;
    const partitions = [[[a,b],[c,d]], [[a,c],[b,d]], [[a,d],[b,c]]];
    const fourKey = keyPlayers(four);
    for (const [teamA, teamB] of partitions) {
      const gap = Math.abs(teamStrength(teamA) - teamStrength(teamB));
      const fairness = four.reduce((n,p)=>n+p.count,0);
      const cand = { players: four, teamA, teamB, gap, fairness, key: fourKey };
      if (!best || matchCmp(cand,best) < 0) best = cand;
      if (!avoid.has(fourKey) && (!bestAllowed || matchCmp(cand,bestAllowed) < 0)) bestAllowed = cand;
    }
  }
  return bestAllowed || best;
}

function bestMixedMatch(men, women, avoid) {
  let best = null, bestAllowed = null;
  for (const ms of combinations(men, 2)) for (const ws of combinations(women, 2)) {
    const players = [...ms, ...ws]; const playersKey = keyPlayers(players);
    const partitions = [[[ms[0],ws[0]],[ms[1],ws[1]]], [[ms[0],ws[1]],[ms[1],ws[0]]]];
    for (const [teamA, teamB] of partitions) {
      const gap = Math.abs(teamStrength(teamA) - teamStrength(teamB));
      const fairness = players.reduce((n,p)=>n+p.count,0);
      const key = playersKey + ':' + keyPlayers(teamA);
      const cand = { players, teamA, teamB, gap, fairness, key };
      if (!best || matchCmp(cand,best) < 0) best = cand;
      if (!avoid.has(playersKey) && (!bestAllowed || matchCmp(cand,bestAllowed) < 0)) bestAllowed = cand;
    }
  }
  return bestAllowed || best;
}

function compositionCandidates(m, f, courts) {
  const out = [];
  for (let md=0; md<=courts; md++) for (let wd=0; wd<=courts-md; wd++) for (let xd=0; xd<=courts-md-wd; xd++) {
    if (4*md + 2*xd <= m && 4*wd + 2*xd <= f) out.push({md,wd,xd,total:md+wd+xd, needM:4*md+2*xd, needF:4*wd+2*xd});
  }
  return out;
}

function compositionScore(c, men, women, typeCounts) {
  const selected = [...men.slice(0,c.needM), ...women.slice(0,c.needF)];
  const counts = selected.map(p=>p.count);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  // Balance which court types get proposed over the session: prefer whichever type
  // (MD/WD/XD) has been used LESS so far when fairness is tied, instead of a fixed
  // XD>MD>WD bias. The fixed bias meant WD almost never got proposed even when it
  // was an equally fair pick, because XD wins every tie by default.
  const typeUsage = c.md*(typeCounts.MD||0) + c.wd*(typeCounts.WD||0) + c.xd*(typeCounts.XD||0);
  return [-c.total, counts.reduce((a,b)=>a+b,0), Math.max(0,...counts), spread, typeUsage];
}

export function recommend(roster, courtLimit, typeCounts = { MD: 0, WD: 0, XD: 0 }, avoid = new Set()) {
  const eligible = roster.filter(p => p.status !== 'benched' && ['Male','Female'].includes(p.gender) && LEVEL[p.level]);
  let men = eligible.filter(p=>p.gender==='Male').sort(byCountId);
  let women = eligible.filter(p=>p.gender==='Female').sort(byCountId);
  const compositions = compositionCandidates(men.length, women.length, Math.max(1, Math.min(10, Number(courtLimit)||1)));
  compositions.sort((a,b)=>lex(compositionScore(a,men,women,typeCounts), compositionScore(b,men,women,typeCounts)));
  const choice = compositions[0] || {md:0,wd:0,xd:0,total:0,needM:0,needF:0};
  // Keep a few extra "next in line" players beyond the strict minimum needed, sorted
  // by count first so they stay fairness-ordered -- this is what gives bestSameGenderMatch
  // / bestMixedMatch genuine alternatives to offer when `avoid` steers them away from
  // the previous pick, instead of only ever being able to re-pair the same four people.
  const PAD = 3;
  men = men.slice(0, Math.min(men.length, choice.needM + PAD)).sort(byLevelId);
  women = women.slice(0, Math.min(women.length, choice.needF + PAD)).sort(byLevelId);
  const matches = [];
  const take = (type) => {
    let best;
    if (type === 'XD') best = bestMixedMatch(men.slice(0, Math.min(men.length, 2+PAD)), women.slice(0, Math.min(women.length, 2+PAD)), avoid);
    else { const pool = type==='MD'?men:women; best = bestSameGenderMatch(pool.slice(0, Math.min(pool.length, 4+PAD)), avoid); }
    if (!best) return;
    const used = new Set(best.players.map(p=>p.playerId));
    men = removeIds(men,used); women = removeIds(women,used);
    matches.push({ court: matches.length+1, type, teamA:best.teamA, teamB:best.teamB, players:best.players, levelGap:best.gap });
  };
  // Mixed first uses scarce cross-gender capacity; composition already fixes counts.
  for(let i=0;i<choice.xd;i++) take('XD');
  for(let i=0;i<choice.md;i++) take('MD');
  for(let i=0;i<choice.wd;i++) take('WD');
  const used = new Set(matches.flatMap(m=>m.players.map(p=>p.playerId)));
  const waiting = eligible.filter(p=>!used.has(p.playerId)).sort(byCountId);
  const incomplete = roster.filter(p=>p.status!=='benched' && (!['Male','Female'].includes(p.gender) || !LEVEL[p.level]));
  return { matches, waiting, incomplete, eligibleCount:eligible.length, requestedCourts:courtLimit };
}

export function isLegal(match) {
  const genders = match.players.map(p=>p.gender);
  if (match.type==='MD') return genders.every(g=>g==='Male');
  if (match.type==='WD') return genders.every(g=>g==='Female');
  if (match.type==='XD') return genders.filter(g=>g==='Male').length===2 && match.teamA.some(p=>p.gender==='Male') && match.teamA.some(p=>p.gender==='Female') && match.teamB.some(p=>p.gender==='Male') && match.teamB.some(p=>p.gender==='Female');
  return false;
}

// --- Round analysis (pure; used by the session round log, not by recommend()) ---
export const PARTITIONS = [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]];
export const strength = team => team.reduce((n,p)=>n+(LEVEL[p.level]||0),0);
export function lineupType(four){const m=four.filter(p=>p.gender==='Male').length;return m===4?'MD':m===0?'WD':m===2?'XD':'MIX'}
// Merrick's rule set, evaluated in order (MECE): carry > intensity > light.
export function roundRole(round, id){
  const inA = round.teamA.some(p=>p.id===id);
  const mine = inA?round.teamA:round.teamB, opp = inA?round.teamB:round.teamA;
  const me = mine.find(p=>p.id===id), mate = mine.find(p=>p.id!==id);
  if(!me||!mate) return null;
  if((LEVEL[me.level]||0) > (LEVEL[mate.level]||0)) return 'carry';
  return strength(opp) >= strength(mine) ? 'intensity' : 'light';
}
export function roundTier(round){
  const all=[...round.teamA,...round.teamB];
  const a=strength(all)/all.length;
  return a>=2.5?'A':a>=1.5?'B':'C';
}
