// 별무리 개척기 — 게임 데이터 (수치는 모두 이 게임용으로 새로 설계)
export const VERSION = '0.1.0';
export const MAX_LVL = 100;

// 레벨 L까지 필요한 누적 경험치
export const XP_TABLE = (() => {
  const t = [0, 0];
  for (let L = 2; L <= MAX_LVL; L++) t[L] = Math.floor(25 * Math.pow(L - 1, 2.6));
  return t;
})();
export function levelOf(xp) {
  let lo = 1, hi = MAX_LVL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xp >= XP_TABLE[mid]) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export const SKILLS = [
  { id: 'atk', name: '공격', icon: '🗡️', type: 'combat', desc: '근접 명중' },
  { id: 'str', name: '힘', icon: '💪', type: 'combat', desc: '근접 최대 피해' },
  { id: 'def', name: '방어', icon: '🛡️', type: 'combat', desc: '받는 공격 회피 · 판금 장비' },
  { id: 'hp', name: '체력', icon: '❤️', type: 'combat', desc: '최대 체력 (레벨 x10)' },
  { id: 'rng', name: '원거리', icon: '🏹', type: 'combat', desc: '원거리 명중 · 피해 · 가죽 장비' },
  { id: 'mag', name: '마법', icon: '🔮', type: 'combat', desc: '마법 명중 · 피해 · 마법 방어 · 로브' },
  { id: 'div', name: '신성', icon: '✨', type: 'support', desc: '뼈를 묻어 수련 · 기도 해금' },
  { id: 'wood', name: '벌목', icon: '🪓', type: 'gather', desc: '나무 → 목재' },
  { id: 'mine', name: '채광', icon: '⛏️', type: 'gather', desc: '광석 채굴' },
  { id: 'fish', name: '낚시', icon: '🎣', type: 'gather', desc: '날생선' },
  { id: 'smith', name: '대장', icon: '🔨', type: 'make', desc: '주괴 · 판금 장비 · 검 · 방패' },
  { id: 'craft', name: '공예', icon: '🧵', type: 'make', desc: '활 · 지팡이 · 가죽 · 로브' },
  { id: 'cook', name: '요리', icon: '🍳', type: 'make', desc: '날생선 → 음식 (회복)' },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// 장비 단계 (요구 레벨 · 기본값 v)
export const TIERS = [
  { n: '청동', lvl: 1, v: 3, c: '#c8814a' },
  { n: '철', lvl: 10, v: 6, c: '#a9b0b8' },
  { n: '강철', lvl: 20, v: 10, c: '#d6dde4' },
  { n: '흑철', lvl: 30, v: 15, c: '#6b7280' },
  { n: '성은', lvl: 40, v: 21, c: '#e5e7eb' },
  { n: '창공', lvl: 55, v: 29, c: '#60a5fa' },
  { n: '용린', lvl: 70, v: 38, c: '#ef4444' },
  { n: '별철', lvl: 85, v: 48, c: '#facc15' },
];

// ---------- 특수 옵션 ----------
export const SPECIAL_NAMES = {
  crit: '치명타 확률', dr: '받는 피해 감소', acc: '명중', hpPct: '최대 체력', evade: '회피',
  speed: '공격 속도', drop: '드롭률', xp: '전투 경험치', ls: '흡혈', reflect: '피해 반사',
  dmg: '피해', regen: '초당 체력 회복', heal: '음식 회복량', gspd: '채집 속도', gxp: '채집 경험치',
  mspd: '제작 속도', mxp: '제작 경험치', burn: '음식 안 태울 확률', pm: '근접 보호', pr: '원거리 보호', pg: '마법 보호', defPct: '방어',
};
// 부위마다 고정 특수 옵션 (단계가 오를수록 커짐)
export const SLOT_SPECIAL = {
  weapon: ['crit', 0.012], shield: ['dr', 0.01], head: ['acc', 0.02], body: ['hpPct', 0.03], legs: ['evade', 0.015],
  gloves: ['speed', 0.015], boots: ['drop', 0.04], amulet: ['xp', 0.025], ring: ['ls', 0.006], cape: ['reflect', 0.04],
};
export const SLOTS = {
  weapon: { name: '무기', icon: '⚔️' }, shield: { name: '방패', icon: '🛡️' }, head: { name: '머리', icon: '⛑️' },
  body: { name: '상의', icon: '👕' }, legs: { name: '하의', icon: '👖' }, gloves: { name: '장갑', icon: '🧤' },
  boots: { name: '신발', icon: '👢' }, amulet: { name: '목걸이', icon: '📿' }, ring: { name: '반지', icon: '💍' }, cape: { name: '망토', icon: '🧣' },
};
export const SLOT_IDS = Object.keys(SLOTS);
export const STYLES = { melee: { name: '근접', icon: '⚔️' }, ranged: { name: '원거리', icon: '🏹' }, magic: { name: '마법', icon: '🔮' } };
export const STYLE_IDS = ['melee', 'ranged', 'magic'];

// ---------- 재료 ----------
const LOGS = ['잡목', '참나무', '단풍나무', '주목', '마력나무', '고목', '용혈목', '별나무'];
const ORES = ['구리', '철', '석탄', '흑철', '성은', '창공석', '용린석', '별철'];
const FISH = ['피라미', '송어', '연어', '참치', '바닷가재', '황새치', '심해 장어', '별빛 상어'];
const BONES = ['작은 뼈', '뼈', '큰 뼈', '짐승 뼈', '거인 뼈', '비룡 뼈', '용 뼈', '별의 뼈'];
export const FOOD_HEAL = [8, 20, 36, 55, 77, 100, 130, 165];
export const ITEMS = {}; // id → { name, icon, kind, t, ... }
TIERS.forEach((T, t) => {
  ITEMS['log' + t] = { name: LOGS[t] + ' 목재', icon: '🪵', kind: 'mat', t, value: 3 * (t + 1) ** 2 };
  ITEMS['ore' + t] = { name: ORES[t] + ' 광석', icon: '🪨', kind: 'mat', t, value: 3 * (t + 1) ** 2 };
  ITEMS['bar' + t] = { name: T.n + ' 주괴', icon: '🧱', kind: 'mat', t, value: 8 * (t + 1) ** 2 };
  ITEMS['raw' + t] = { name: '날 ' + FISH[t], icon: '🐟', kind: 'mat', t, value: 3 * (t + 1) ** 2 };
  ITEMS['food' + t] = { name: '구운 ' + FISH[t], icon: '🍖', kind: 'food', t, heal: FOOD_HEAL[t], value: 6 * (t + 1) ** 2 };
  ITEMS['hide' + t] = { name: T.n + ' 가죽', icon: '🟫', kind: 'mat', t, value: 6 * (t + 1) ** 2 };
  ITEMS['cloth' + t] = { name: T.n + ' 마력 천', icon: '🟪', kind: 'mat', t, value: 6 * (t + 1) ** 2 };
  ITEMS['bone' + t] = { name: BONES[t], icon: '🦴', kind: 'bone', t, xp: [5, 10, 18, 28, 40, 55, 72, 92][t], value: 2 * (t + 1) ** 2 };
});
ITEMS.burnt = { name: '탄 음식', icon: '⚫', kind: 'junk', value: 1 };
ITEMS.bread = { name: '빵', icon: '🍞', kind: 'food', heal: 5, value: 4 };

// ---------- 장비 ----------
// set: plate(근접 방어) · hide(원거리) · robe(마법) / mat: 만드는 재료 (없으면 드롭 전용)
export const GEAR = {
  sword: { slot: 'weapon', style: 'melee', name: '검', icon: '🗡️', req: 'atk', speed: 2.4, mat: ['bar', 2], skill: 'smith' },
  bow: { slot: 'weapon', style: 'ranged', name: '활', icon: '🏹', req: 'rng', speed: 2.0, twoHand: true, mat: ['log', 3], skill: 'craft' },
  staff: { slot: 'weapon', style: 'magic', name: '지팡이', icon: '🪄', req: 'mag', speed: 2.6, mat: ['log', 3], skill: 'craft' },
  shield: { slot: 'shield', name: '방패', icon: '🛡️', req: 'def', mat: ['bar', 3], skill: 'smith' },
  helm: { slot: 'head', set: 'plate', name: '투구', icon: '⛑️', req: 'def', mat: ['bar', 2], skill: 'smith' },
  plate: { slot: 'body', set: 'plate', name: '판금 갑옷', icon: '🥋', req: 'def', mat: ['bar', 5], skill: 'smith' },
  plegs: { slot: 'legs', set: 'plate', name: '판금 각반', icon: '👖', req: 'def', mat: ['bar', 3], skill: 'smith' },
  coif: { slot: 'head', set: 'hide', name: '가죽 두건', icon: '🎩', req: 'rng', mat: ['hide', 1], skill: 'craft' },
  hbody: { slot: 'body', set: 'hide', name: '가죽 갑옷', icon: '🦺', req: 'rng', mat: ['hide', 3], skill: 'craft' },
  chaps: { slot: 'legs', set: 'hide', name: '가죽 바지', icon: '👖', req: 'rng', mat: ['hide', 2], skill: 'craft' },
  hat: { slot: 'head', set: 'robe', name: '마법 모자', icon: '🧙', req: 'mag', mat: ['cloth', 1], skill: 'craft' },
  robe: { slot: 'body', set: 'robe', name: '로브 상의', icon: '👘', req: 'mag', mat: ['cloth', 3], skill: 'craft' },
  skirt: { slot: 'legs', set: 'robe', name: '로브 하의', icon: '👗', req: 'mag', mat: ['cloth', 2], skill: 'craft' },
  gloves: { slot: 'gloves', name: '장갑', icon: '🧤', req: 'def', mat: ['hide', 1], skill: 'craft' },
  boots: { slot: 'boots', name: '장화', icon: '👢', req: 'def', mat: ['bar', 1], skill: 'smith' },
  amulet: { slot: 'amulet', name: '목걸이', icon: '📿', req: 'hp' },
  ring: { slot: 'ring', name: '반지', icon: '💍', req: 'hp' },
  cape: { slot: 'cape', name: '망토', icon: '🧣', req: 'hp' },
};
const z3 = () => ({ melee: 0, ranged: 0, magic: 0 });
// 장비 수치 (단계 t로 고정)
function gearStats(type, t) {
  const g = GEAR[type];
  const v = TIERS[t].v;
  const s = { acc: z3(), pow: z3(), def: z3(), sp: {} };
  const part = { head: 0.5, body: 1, legs: 0.75 }[g.slot] || 1;
  switch (type) {
    case 'sword': s.acc.melee = 2.2 * v; s.pow.melee = 2 * v; break;
    case 'bow': s.acc.ranged = 2.4 * v; s.pow.ranged = 2.1 * v; break;
    case 'staff': s.acc.magic = 2.3 * v; s.pow.magic = 1.9 * v; s.def.magic = 0.5 * v; break;
    case 'shield': s.def.melee = 1.3 * v; s.def.ranged = 1.3 * v; s.def.magic = 0.4 * v; break;
    case 'gloves': s.acc.melee = s.acc.ranged = s.acc.magic = 0.3 * v; s.def.melee = s.def.ranged = s.def.magic = 0.2 * v; break;
    case 'boots': s.def.melee = s.def.ranged = 0.35 * v; s.def.magic = 0.15 * v; s.pow.melee = 0.15 * v; break;
    case 'amulet': s.acc.melee = s.acc.ranged = s.acc.magic = 0.35 * v; s.pow.melee = s.pow.ranged = s.pow.magic = 0.2 * v; break;
    case 'ring': s.pow.melee = s.pow.ranged = s.pow.magic = 0.25 * v; break;
    case 'cape': s.def.melee = s.def.ranged = s.def.magic = 0.3 * v; break;
    default:
      if (g.set === 'plate') { s.def.melee = 1.6 * v * part; s.def.ranged = 1.4 * v * part; s.def.magic = 0.3 * v * part; s.acc.magic = -0.6 * v * part; s.acc.ranged = -0.2 * v * part; }
      if (g.set === 'hide') { s.def.melee = 0.8 * v * part; s.def.ranged = 1.1 * v * part; s.def.magic = 1.0 * v * part; s.acc.ranged = 0.4 * v * part; }
      if (g.set === 'robe') { s.def.melee = 0.35 * v * part; s.def.ranged = 0.35 * v * part; s.def.magic = 1.3 * v * part; s.acc.magic = 0.5 * v * part; s.pow.magic = 0.15 * v * part; s.acc.melee = -0.3 * v * part; }
  }
  for (const k of ['acc', 'pow', 'def']) for (const st of STYLE_IDS) s[k][st] = Math.round(s[k][st]);
  const [key, per] = SLOT_SPECIAL[g.slot];
  s.sp[key] = Math.round(per * (t + 1) * 1000) / 1000;
  return s;
}
for (const type of Object.keys(GEAR)) {
  TIERS.forEach((T, t) => {
    const g = GEAR[type];
    ITEMS[`${type}${t}`] = {
      name: `${T.n} ${g.name}`, icon: g.icon, kind: 'gear', type, slot: g.slot, t, style: g.style, req: [g.req, T.lvl],
      speed: g.speed, twoHand: !!g.twoHand, stats: gearStats(type, t),
      value: 15 * (t + 1) ** 2 * (g.mat ? g.mat[1] : 3),
    };
  });
}

// ---------- 몬스터 · 지역 ----------
const ZONE_DEFS = [
  { n: '바람 초원', base: 1, mons: [['들쥐', '🐀'], ['풀숲 슬라임', '🟢'], ['떠돌이 도적', '🥷']], boss: ['초원의 군주 멧돼지', '🐗'] },
  { n: '이끼 숲', base: 10, mons: [['독버섯 정령', '🍄'], ['숲 늑대', '🐺'], ['이끼 궁수', '🏹']], boss: ['고목 수호자', '🌳'] },
  { n: '잿빛 광산', base: 20, mons: [['동굴 박쥐', '🦇'], ['광부 해골', '💀'], ['불씨 정령', '🔥']], boss: ['광산 골렘', '🗿'] },
  { n: '안개 늪', base: 30, mons: [['늪 두꺼비', '🐸'], ['안개 마녀', '🧙'], ['늪 악어', '🐊']], boss: ['늪의 여왕 히드라', '🐉'] },
  { n: '서리 봉우리', base: 42, mons: [['서리 늑대', '🐺'], ['눈 정령', '❄️'], ['얼음 거인', '🧊']], boss: ['빙하 거인왕', '🏔️'] },
  { n: '하늘 섬', base: 55, mons: [['폭풍 독수리', '🦅'], ['구름 기사', '⚔️'], ['번개 정령', '⚡']], boss: ['폭풍 그리폰', '🦁'] },
  { n: '용암 심연', base: 70, mons: [['용암 도마뱀', '🦎'], ['화염 마법사', '🧙'], ['흑요석 기사', '🛡️']], boss: ['심연의 붉은 용', '🐲'] },
  { n: '별의 폐허', base: 85, mons: [['별빛 망령', '👻'], ['성운 궁수', '🏹'], ['공허 기사', '🌑']], boss: ['별을 삼킨 자', '🌌'] },
];
const ROT = ['melee', 'ranged', 'magic'];
const WEAK = { melee: 'magic', ranged: 'melee', magic: 'ranged' }; // 공격 방식별 약점
function makeMonster(name, icon, L, style, boss, z, i) {
  const defB = { melee: L * 1.0, ranged: L * 1.0, magic: L * 1.0 };
  defB[WEAK[style]] *= 0.45;   // 약점 방식으로 때리면 잘 맞음
  defB[style] *= 1.35;         // 같은 방식에는 강함
  return {
    id: `m${z}_${i}`, name, icon, lvl: L, style, boss, z,
    hp: Math.round((5 + L * 1.5 + L * L * 0.012) * (boss ? 3.5 : 1)),
    atkLvl: Math.round(L * (boss ? 1.15 : 1)), strLvl: Math.round(L * (boss ? 1.25 : 1)), defLvl: Math.round(L * (boss ? 1.1 : 1)),
    accB: L * 0.8, powB: L * 0.6, defB,
    interval: [2.6, 2.4, 3.0][i % 3] + (boss ? 0.2 : 0),
    weak: WEAK[style],
  };
}
export const ZONES = ZONE_DEFS.map((d, z) => ({
  n: d.n, t: z, lvl: d.base,
  mons: [
    ...d.mons.map(([n, ic], i) => makeMonster(n, ic, d.base + i * 4, ROT[(z + i) % 3], false, z, i)),
    makeMonster(d.boss[0], d.boss[1], d.base + 12, ROT[z % 3], true, z, 3),
  ],
}));
export const MONSTER = Object.fromEntries(ZONES.flatMap((zn) => zn.mons.map((m) => [m.id, m])));

// ---------- 생활 스킬 행동 ----------
const GATHER_XP = [10, 18, 30, 45, 65, 90, 120, 155];
export const ACTIONS = {};
const addAct = (skill, a) => { (ACTIONS[skill] ||= []).push(a); };
TIERS.forEach((T, t) => {
  addAct('wood', { id: 'wood' + t, name: LOGS[t] + ' 베기', icon: '🌲', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['log' + t]: 1 } });
  addAct('mine', { id: 'mine' + t, name: ORES[t] + ' 캐기', icon: '🪨', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['ore' + t]: 1 } });
  addAct('fish', { id: 'fish' + t, name: FISH[t] + ' 낚기', icon: '🎣', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['raw' + t]: 1 } });
  addAct('cook', { id: 'cook' + t, name: FISH[t] + ' 굽기', icon: '🍖', lvl: T.lvl, time: 2.4, xp: Math.round(GATHER_XP[t] * 0.9), in: { ['raw' + t]: 1 }, out: { ['food' + t]: 1 }, burn: true });
  addAct('smith', { id: 'bar' + t, group: '주괴 제련', name: T.n + ' 주괴', icon: '🧱', lvl: T.lvl, time: 2.5, xp: Math.round(GATHER_XP[t] * 0.7), in: { ['ore' + t]: 1 }, out: { ['bar' + t]: 1 } });
});
for (const [type, g] of Object.entries(GEAR)) {
  if (!g.mat) continue;
  TIERS.forEach((T, t) => {
    const [m, n] = g.mat;
    const per = m === 'bar' ? GATHER_XP[t] * 0.9 : GATHER_XP[t] * 0.8;
    addAct(g.skill, { id: `${type}${t}`, group: '장비 제작', name: `${T.n} ${g.name}`, icon: g.icon, lvl: T.lvl, time: 3, xp: Math.round(per * n), in: { [m + t]: n }, out: { [`${type}${t}`]: 1 } });
  });
}

// ---------- 신성: 기도 (1개만 켬) ----------
export const PRAYERS = [
  { id: 'skin', name: '단단한 피부', icon: '🪨', lvl: 1, fx: { defPct: 0.05 } },
  { id: 'might', name: '강인한 힘', icon: '💪', lvl: 4, fx: { dmg: 0.05 } },
  { id: 'eye', name: '날카로운 눈', icon: '👁️', lvl: 8, fx: { acc: 0.06 } },
  { id: 'renew', name: '회복의 기도', icon: '💚', lvl: 15, fx: { regen: 0.01 } },
  { id: 'focus', name: '전투 집중', icon: '🎯', lvl: 22, fx: { acc: 0.08, dmg: 0.06 } },
  { id: 'pmelee', name: '근접 보호', icon: '🛡️', lvl: 30, fx: { pm: 0.4 } },
  { id: 'prange', name: '원거리 보호', icon: '🏹', lvl: 33, fx: { pr: 0.4 } },
  { id: 'pmagic', name: '마법 보호', icon: '🔮', lvl: 36, fx: { pg: 0.4 } },
  { id: 'warrior', name: '전사의 기도', icon: '⚔️', lvl: 45, fx: { acc: 0.12, dmg: 0.1, defPct: 0.08 } },
  { id: 'bounty', name: '풍요의 기도', icon: '🍀', lvl: 55, fx: { drop: 0.2 } },
  { id: 'wisdom', name: '지혜의 기도', icon: '📘', lvl: 65, fx: { xp: 0.15 } },
  { id: 'fury', name: '신성한 격노', icon: '🔥', lvl: 75, fx: { dmg: 0.16, crit: 0.05 } },
  { id: 'aegis', name: '빛의 방벽', icon: '🌟', lvl: 85, fx: { dr: 0.12, regen: 0.015 } },
];

// ---------- 펫 (1마리만 데리고 다님) ----------
// src: 스킬 id(행동마다 확률) 또는 'boss:z'(지역 보스 처치마다 확률)
export const PETS = [
  { id: 'squirrel', name: '도토리 다람쥐', icon: '🐿️', src: 'wood', p: 1 / 4000, fx: { gspd: 0.06 } },
  { id: 'mole', name: '꼬마 두더지', icon: '🦔', src: 'mine', p: 1 / 4000, fx: { gxp: 0.08 } },
  { id: 'otter', name: '장난꾸러기 수달', icon: '🦦', src: 'fish', p: 1 / 4000, fx: { heal: 0.15 } },
  { id: 'salamander', name: '불씨 도롱뇽', icon: '🦎', src: 'smith', p: 1 / 3000, fx: { mspd: 0.06 } },
  { id: 'moth', name: '비단 나방', icon: '🦋', src: 'craft', p: 1 / 3000, fx: { mxp: 0.08 } },
  { id: 'chick', name: '노릇 병아리', icon: '🐥', src: 'cook', p: 1 / 3000, fx: { burn: 0.5 } },
  { id: 'boar', name: '아기 멧돼지', icon: '🐗', src: 'boss:0', p: 1 / 150, fx: { dmg: 0.03 } },
  { id: 'sprout', name: '새싹 수호자', icon: '🌱', src: 'boss:1', p: 1 / 180, fx: { regen: 0.005 } },
  { id: 'pebble', name: '조약돌 골렘', icon: '🪨', src: 'boss:2', p: 1 / 200, fx: { dr: 0.03 } },
  { id: 'hydra', name: '꼬마 히드라', icon: '🐍', src: 'boss:3', p: 1 / 220, fx: { ls: 0.01 } },
  { id: 'yeti', name: '아기 설인', icon: '⛄', src: 'boss:4', p: 1 / 250, fx: { hpPct: 0.06 } },
  { id: 'griffin', name: '꼬마 그리폰', icon: '🪶', src: 'boss:5', p: 1 / 280, fx: { speed: 0.04 } },
  { id: 'drake', name: '새끼 용', icon: '🐉', src: 'boss:6', p: 1 / 300, fx: { crit: 0.04 } },
  { id: 'star', name: '별똥 정령', icon: '🌠', src: 'boss:7', p: 1 / 350, fx: { drop: 0.15, xp: 0.05 } },
];
export const PET = Object.fromEntries(PETS.map((p) => [p.id, p]));

// ---------- 전투 공식 ----------
export const roll = (lvl, bonus) => (lvl + 10) * Math.max(10, bonus + 50);
export const hitChance = (a, d) => Math.min(0.95, Math.max(0.05, a / (a + d)));
export const maxHitOf = (lvl, bonus) => Math.floor(1 + ((lvl + 8) * Math.max(0, bonus + 40)) / 200);
export const monMaxHit = (m) => Math.floor(1 + ((m.strLvl + 8) * (m.powB + 40)) / 200 * 1.3);
export const CRIT_MULT = 1.5;
export const RESPAWN = 1.5;
export const DEATH_TIME = 5;
export const OFFLINE_CAP = 12 * 3600;
export const SHOP = [
  { id: 'bread', price: 10 },
  ...['sword', 'bow', 'staff', 'shield', 'helm', 'plate', 'plegs', 'coif', 'hbody', 'chaps', 'hat', 'robe', 'skirt'].flatMap((ty) => [0, 1].map((t) => ({ id: ty + t, price: ITEMS[ty + t].value * 4 }))),
];
