const LEVEL = { A: 3, B: 2, C: 1 };

const byCountId = (a, b) => a.count - b.count || a.playerId.localeCompare(b.playerId);
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

function bestSameGenderMatch(players) {
  let best = null;
  for (const four of combinations(players, 4)) {
    const [a,b,c,d] = four;
    const partitions = [[[a,b],[c,d]], [[a,c],[b,d]], [[a,d],[b,c]]];
    for (const [teamA, teamB] of partitions) {
      const gap = Math.abs(teamStrength(teamA) - teamStrength(teamB));
      const score = [gap, keyPlayers(four)];
      if (!best || gap < best.gap || (gap === best.gap && String(score[1]) < best.key)) best = { players: four, teamA, teamB, gap, key: String(score[1]) };
    }
  }
  return best;
}

function bestMixedMatch(men, women) {
  let best = null;
  for (const ms of combinations(men, 2)) for (const ws of combinations(women, 2)) {
    const partitions = [[[ms[0],ws[0]],[ms[1],ws[1]]], [[ms[0],ws[1]],[ms[1],ws[0]]]];
    for (const [teamA, teamB] of partitions) {
      const gap = Math.abs(teamStrength(teamA) - teamStrength(teamB));
      const players = [...ms, ...ws]; const key = keyPlayers(players) + ':' + keyPlayers(teamA);
      if (!best || gap < best.gap || (gap === best.gap && key < best.key)) best = { players, teamA, teamB, gap, key };
    }
  }
  return best;
}

function compositionCandidates(m, f, courts) {
  const out = [];
  for (let md=0; md<=courts; md++) for (let wd=0; wd<=courts-md; wd++) for (let xd=0; xd<=courts-md-wd; xd++) {
    if (4*md + 2*xd <= m && 4*wd + 2*xd <= f) out.push({md,wd,xd,total:md+wd+xd, needM:4*md+2*xd, needF:4*wd+2*xd});
  }
  return out;
}

function compositionScore(c, men, women) {
  const selected = [...men.slice(0,c.needM), ...women.slice(0,c.needF)];
  const counts = selected.map(p=>p.count);
  return [-c.total, counts.reduce((a,b)=>a+b,0), Math.max(0,...counts), Math.max(0,...counts)-Math.min(0,...counts), -c.xd, -c.md, -c.wd];
}

export function recommend(roster, courtLimit) {
  const eligible = roster.filter(p => p.status !== 'benched' && ['Male','Female'].includes(p.gender) && LEVEL[p.level]);
  let men = eligible.filter(p=>p.gender==='Male').sort(byCountId);
  let women = eligible.filter(p=>p.gender==='Female').sort(byCountId);
  const compositions = compositionCandidates(men.length, women.length, Math.max(1, Math.min(10, Number(courtLimit)||1)));
  compositions.sort((a,b)=>lex(compositionScore(a,men,women), compositionScore(b,men,women)));
  const choice = compositions[0] || {md:0,wd:0,xd:0,total:0,needM:0,needF:0};
  men = men.slice(0,choice.needM).sort(byLevelId); women = women.slice(0,choice.needF).sort(byLevelId);
  const matches = [];
  const take = (type) => {
    let best;
    if (type === 'XD') best = bestMixedMatch(men.slice(0,2),women.slice(0,2));
    else best = bestSameGenderMatch((type==='MD'?men:women).slice(0,4));
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
