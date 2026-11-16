// 별무리 개척기 — 게임 데이터 (수치는 모두 이 게임용으로 설계)
export const VERSION = '0.3.0';
export const MAX_LVL = 100;
export const SPEEDS = [1, 2, 4, 8, 16, 32];

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
  { id: 'atk', name: '공격', icon: '🗡️', type: 'combat', desc: '힘과 함께 근접 피해를 올림' },
  { id: 'str', name: '힘', icon: '💪', type: 'combat', desc: '근접 피해를 올림' },
  { id: 'def', name: '방어', icon: '🛡️', type: 'combat', desc: '적이 덜 명중 · 피해도 약해짐 · 레벨마다 최대 체력' },
  { id: 'rng', name: '원거리', icon: '🏹', type: 'combat', desc: '활 · 석궁 피해' },
  { id: 'mag', name: '마법', icon: '🔮', type: 'combat', desc: '주문 피해 (주문 배율만큼 오름)' },
  { id: 'div', name: '신성', icon: '✨', type: 'support', desc: '뼈를 묻어 수련 · 기도 해금' },
  { id: 'wood', name: '벌목', icon: '🪓', type: 'gather', desc: '나무 → 목재' },
  { id: 'mine', name: '채광', icon: '⛏️', type: 'gather', desc: '광석 · 보석 채굴' },
  { id: 'fish', name: '낚시', icon: '🎣', type: 'gather', desc: '날생선' },
  { id: 'smith', name: '대장', icon: '🔨', type: 'make', desc: '주괴 · 판금 · 검 · 도끼 · 방패' },
  { id: 'craft', name: '공예', icon: '🧵', type: 'make', desc: '활 · 석궁 · 지팡이 · 가죽 · 로브 · 장신구' },
  { id: 'cook', name: '요리', icon: '🍳', type: 'make', desc: '날생선 → 음식 (회복)' },
  { id: 'alch', name: '연금술', icon: '⚗️', type: 'make', desc: '약초 → 물약 (스탯 · 속도 · 드롭 버프)' },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const TIERS = [
  { n: '청동', lvl: 1, v: 8, c: '#c8814a' },
  { n: '철', lvl: 10, v: 18, c: '#a9b0b8' },
  { n: '강철', lvl: 20, v: 32, c: '#d6dde4' },
  { n: '흑철', lvl: 30, v: 52, c: '#8b93a7' },
  { n: '성은', lvl: 40, v: 78, c: '#e5e7eb' },
  { n: '창공', lvl: 55, v: 112, c: '#60a5fa' },
  { n: '용린', lvl: 70, v: 155, c: '#ef4444' },
  { n: '별철', lvl: 85, v: 210, c: '#facc15' },
];

// ---------- 장비 스탯 ----------
// 레벨 + 장비 스탯 = 최종 스탯. 근접 최대 피해 = (공격 + 힘) x 0.85 / 원거리 = 원거리 x 0.85 / 마법 = 마법 x 0.70 x 주문 배율
// 방어: 적 명중률 = 적 공격 / (적 공격 + 방어 x 0.43), 받는 피해 x (1 - 방어 효율)
// 흡수: 입힌 피해의 %만큼 회복 / 피해 감소: 받는 피해를 고정 %만큼 줄임
export const STATS = {
  atk: { name: '공격', icon: '🗡️' }, str: { name: '힘', icon: '💪' }, def: { name: '방어', icon: '🛡️' },
  rng: { name: '원거리', icon: '🏹' }, mag: { name: '마법', icon: '🔮' },
  ls: { name: '생명력 흡수', icon: '🩸', pct: true }, dr: { name: '피해 감소', icon: '🧱', pct: true },
};
export const STAT_IDS = Object.keys(STATS);
export const CAPS = { ls: 0.3, dr: 0.6 };

// ---------- 기도 · 펫 보너스 (스탯 7종만: 공격 · 힘 · 방어 · 원거리 · 마법 %, 흡수 · 피해 감소) ----------
export const SPECIAL_NAMES = {
  atkPct: '공격', strPct: '힘', defPct: '방어', rngPct: '원거리', magPct: '마법', ls: '생명력 흡수', dr: '피해 감소',
  gspd: '채집 속도', gxp: '채집 경험치', cspd: '제작 속도', pspd: '생산 속도', mxp: '제작 · 생산 경험치', heal: '음식 회복량', burn: '음식 안 태울 확률',
  drop: '드롭률', hpTick: '틱당 체력 회복', thief: '도둑질 성공률', bossDmg: '보스 피해', sxp: '생활 경험치', dxp: '신성 경험치',
};
// 값이 % 가 아닌 보너스 (틱당 회복은 고정 수치)
export const FLAT_SP = new Set(['hpTick']);
export const COMBAT_TICK = 0.6;
// 사냥꾼 숙련: 같은 몬스터를 잡은 수에 따라 그 몬스터 상대로 보너스 (단계마다 드롭률 +2% · 피해 +2% · 방어 +1.6%)
export const HUNT_TIERS = [25, 100, 300, 1000, 3000];
export const HUNT_NAMES = ['없음', '견습 사냥꾼', '사냥꾼', '숙련 사냥꾼', '명사냥꾼', '전설의 사냥꾼'];
export const HUNT_PER = { drop: 0.02, dmg: 0.02, def: 0.016 };
export const huntTier = (kills) => HUNT_TIERS.filter((n) => (kills || 0) >= n).length; // 틱당 체력 회복 주기 (초)

// ---------- 장비 등급 (드롭 · 제작 시 무작위, 스탯 배율) ----------
export const RARITY = [
  { r: 1, n: '일반', p: 0.55, mult: 1.0, c: '#b5b9c4' },
  { r: 2, n: '고급', p: 0.215, mult: 1.1, c: '#4ade80' },
  { r: 3, n: '희귀', p: 0.109, mult: 1.22, c: '#60a5fa' },
  { r: 4, n: '영웅', p: 0.065, mult: 1.35, c: '#c084fc' },
  { r: 5, n: '전설', p: 0.03, mult: 1.5, c: '#fb923c' },
  { r: 6, n: '신화', p: 0.015, mult: 1.67, c: '#facc15' },
  { r: 7, n: '고대', p: 0.007, mult: 1.86, c: '#22d3ee' },
  { r: 8, n: '유물', p: 0.003, mult: 2.07, c: '#f43f5e' },
];
export function rollRarity(min = 1) {
  const pool = RARITY.filter((x) => x.r >= min);
  const tot = pool.reduce((a, x) => a + x.p, 0);
  let v = Math.random() * tot;
  for (const x of pool) { v -= x.p; if (v <= 0) return x.r; }
  return pool[0].r;
}
export const gearId = (base, r) => (r > 1 ? `${base}_r${r}` : base);
export const SLOTS = {
  weapon: { name: '무기', icon: '⚔️' }, shield: { name: '방패', icon: '🛡️' }, head: { name: '머리', icon: '⛑️' },
  body: { name: '상의', icon: '👕' }, legs: { name: '하의', icon: '👖' }, gloves: { name: '장갑', icon: '🧤' },
  boots: { name: '신발', icon: '👢' }, amulet: { name: '목걸이', icon: '📿' }, ring: { name: '반지', icon: '💍' }, cape: { name: '망토', icon: '🧣' },
};
export const SLOT_IDS = Object.keys(SLOTS);
export const STYLES = { melee: { name: '근접', icon: '⚔️' }, ranged: { name: '원거리', icon: '🏹' }, magic: { name: '마법', icon: '🔮' } };
export const STYLE_IDS = ['melee', 'ranged', 'magic'];

// ---------- 주문 (마법: 주문 배율만큼 피해) ----------
export const SPELLS = [
  { id: 'ember', name: '불씨 화살', icon: '🔥', lvl: 1, mult: 1.02 },
  { id: 'frost', name: '얼음 창', icon: '❄️', lvl: 12, mult: 1.05 },
  { id: 'bolt', name: '번개 사슬', icon: '⚡', lvl: 25, mult: 1.08 },
  { id: 'fireball', name: '화염구', icon: '☄️', lvl: 40, mult: 1.11 },
  { id: 'quake', name: '대지 분쇄', icon: '🌋', lvl: 55, mult: 1.15 },
  { id: 'radiance', name: '성광', icon: '🌟', lvl: 70, mult: 1.19 },
  { id: 'meteor', name: '유성 낙하', icon: '🌠', lvl: 85, mult: 1.24 },
];

// ---------- 재료 ----------
const LOGS = ['잡목', '참나무', '단풍나무', '주목', '마력나무', '고목', '용혈목', '별나무'];
const ORES = ['구리', '철', '석탄', '흑철', '성은', '창공석', '용린석', '별철'];
const FISH = ['피라미', '송어', '연어', '참치', '바닷가재', '황새치', '심해 장어', '별빛 상어'];
const BONES = ['작은 뼈', '뼈', '큰 뼈', '짐승 뼈', '거인 뼈', '비룡 뼈', '용 뼈', '별의 뼈'];
const GEMS = ['석영', '사파이어', '에메랄드', '루비', '자수정', '다이아몬드', '용안석', '별의 결정'];
export const FOOD_HEAL = [8, 20, 36, 55, 77, 100, 130, 165];
export const ITEMS = {};
TIERS.forEach((T, t) => {
  const v = (k) => k * (t + 1) ** 2;
  ITEMS['log' + t] = { name: LOGS[t] + ' 목재', icon: '🌲', kind: 'mat', t, value: v(3) };
  ITEMS['ore' + t] = { name: ORES[t] + ' 광석', icon: '⛰️', kind: 'mat', t, value: v(3) };
  ITEMS['bar' + t] = { name: T.n + ' 주괴', icon: '🧱', kind: 'mat', t, value: v(8) };
  ITEMS['gem' + t] = { name: GEMS[t], icon: '💎', kind: 'mat', t, value: v(25) };
  ITEMS['raw' + t] = { name: '날 ' + FISH[t], icon: '🐟', kind: 'mat', t, value: v(3) };
  ITEMS['food' + t] = { name: '구운 ' + FISH[t], icon: '🍖', kind: 'food', t, heal: FOOD_HEAL[t], value: v(6) };
  ITEMS['hide' + t] = { name: T.n + ' 가죽', icon: '🟫', kind: 'mat', t, value: v(6) };
  ITEMS['cloth' + t] = { name: T.n + ' 마력 천', icon: '🟪', kind: 'mat', t, value: v(6) };
  ITEMS['bone' + t] = { name: BONES[t], icon: '🦴', kind: 'bone', t, xp: [5, 10, 18, 28, 40, 55, 72, 92][t], value: v(2) };
});
ITEMS.burnt = { name: '탄 음식', icon: '⚫', kind: 'junk', value: 1 };

// ---------- 약초 · 물약 (연금술) ----------
const HERBS = ['쑥', '박하', '로즈마리', '세이지', '월계수', '만드라고라', '용혈초', '별꽃'];
TIERS.forEach((T, t) => { ITEMS['herb' + t] = { name: HERBS[t], icon: '🌿', kind: 'mat', t, value: 4 * (t + 1) ** 2 }; });
// 전투 물약: 스탯 % (최소 보장치) · 250번 공격 동안 / 기타 물약: 효과 · 횟수
export const POTION_TYPES = [
  { k: 'atk', n: '공격', icon: '🗡️', fx: (t) => ({ atkPct: 0.005 + 0.0028 * t, atkMin: 10 + 13 * t }), use: 'atk', uses: 250 },
  { k: 'str', n: '힘', icon: '💪', fx: (t) => ({ strPct: 0.005 + 0.0028 * t, strMin: 10 + 13 * t }), use: 'atk', uses: 250 },
  { k: 'def', n: '방어', icon: '🛡️', fx: (t) => ({ defPct: 0.005 + 0.0028 * t, defMin: 15 + 19 * t }), use: 'atk', uses: 250 },
  { k: 'rng', n: '원거리', icon: '🏹', fx: (t) => ({ rngPct: 0.005 + 0.0028 * t, rngMin: 10 + 13 * t }), use: 'atk', uses: 250 },
  { k: 'mag', n: '마법', icon: '🔮', fx: (t) => ({ magPct: 0.005 + 0.0028 * t, magMin: 10 + 13 * t }), use: 'atk', uses: 250 },
  { k: 'regen', n: '재생', icon: '💚', fx: (t) => ({ hpTick: 3 + 3 * t }), use: 'atk', uses: 250 },
  { k: 'boss', n: '보스 사냥', icon: '⚡', fx: (t) => ({ bossDmg: 0.05 + 0.02 * t }), use: 'atk', uses: 250 },
  { k: 'luck', n: '행운', icon: '🍀', fx: (t) => ({ drop: 0.03 + 0.01 * t }), use: 'kill', uses: 300 },
  { k: 'gather', n: '채집', icon: '🪓', fx: (t) => ({ gspd: 0.05 + 0.015 * t }), use: 'act', uses: 500 },
  { k: 'prod', n: '생산', icon: '🍳', fx: (t) => ({ pspd: 0.05 + 0.015 * t }), use: 'act', uses: 500 },
  { k: 'craft', n: '제작', icon: '🔨', fx: (t) => ({ cspd: 0.05 + 0.015 * t }), use: 'act', uses: 500 },
  { k: 'thief', n: '도둑', icon: '🎭', fx: (t) => ({ thief: 0.02 + 0.01 * t }), use: 'act', uses: 300 },
];
export const USE_NAMES = { atk: '공격', kill: '처치', act: '행동' };
const r4 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10000) / 10000]));
TIERS.forEach((T, t) => {
  for (const P of POTION_TYPES) {
    ITEMS[`pot_${P.k}${t}`] = { name: `${T.n} ${P.n} 물약`, icon: '🧪', sub: P.icon, kind: 'potion', t, pk: P.k, fx: r4(P.fx(t)), use: P.use, uses: P.uses, value: 20 * (t + 1) ** 2 };
  }
});

// ---------- 채집 도구 (채집 속도) ----------
export const TOOL_SPEED = [0.05, 0.1, 0.16, 0.23, 0.31, 0.4, 0.5, 0.62];
export const TOOLS = { wood: { n: '벌목 도끼', icon: '🪓' }, mine: { n: '곡괭이', icon: '⛏️' }, fish: { n: '낚싯대', icon: '🎣' } };
TIERS.forEach((T, t) => {
  for (const [sk, tl] of Object.entries(TOOLS)) ITEMS[`tool_${sk}${t}`] = { name: `${T.n} ${tl.n}`, icon: tl.icon, kind: 'tool', skill: sk, t, gspd: TOOL_SPEED[t], req: [sk, T.lvl], value: 40 * (t + 1) ** 2 };
});

// ---------- 생활 장신구 (전투 장비와 따로 1칸) ----------
export const LIFE_GEAR = [
  { k: 'topaz', n: '황옥 목걸이', icon: '📿', fx: (t) => ({ pspd: 0.03 + 0.01 * t, cspd: 0.03 + 0.01 * t }) },
  { k: 'amethyst', n: '자수정 목걸이', icon: '🔮', fx: (t) => ({ gspd: 0.03 + 0.01 * t }) },
  { k: 'pearl', n: '진주 반지', icon: '💍', fx: (t) => ({ sxp: 0.03 + 0.01 * t }) },
];
TIERS.forEach((T, t) => {
  for (const L of LIFE_GEAR) ITEMS[`life_${L.k}${t}`] = { name: `${T.n} ${L.n}`, icon: L.icon, kind: 'life', t, fx: r4(L.fx(t)), req: ['craft', T.lvl], value: 60 * (t + 1) ** 2 };
});

// ---------- 채집 중 희귀 발견 (열면 보상) ----------
export const BOXES = {
  nest: { n: '새 둥지', icon: '🪺', from: 'wood' },
  gembag: { n: '보석 주머니', icon: '👝', from: 'mine' },
  chest: { n: '물속 상자', icon: '🧰', from: 'fish' },
};
export const RARE_FIND = 1 / 250;
TIERS.forEach((T, t) => {
  for (const [k, b] of Object.entries(BOXES)) ITEMS[`${k}${t}`] = { name: `${T.n} ${b.n}`, icon: b.icon, kind: 'box', box: k, t, value: 30 * (t + 1) ** 2 };
});
ITEMS.bread = { name: '빵', icon: '🍞', kind: 'food', heal: 5, value: 4 };

// ---------- 장비 ----------
// s: 단계 기본값 v에 곱하는 스탯 계수 (흡수 · 피해 감소는 단계당 %)
export const GEAR = {
  sword: { slot: 'weapon', style: 'melee', name: '검', icon: '🗡️', req: 'atk', speed: 2.4, s: { atk: 1.4, str: 0.5 }, mat: { bar: 2 }, skill: 'smith' },
  axe: { slot: 'weapon', style: 'melee', name: '대도끼', icon: '🪓', req: 'str', speed: 3.0, twoHand: true, s: { atk: 0.8, str: 2.1 }, mat: { bar: 3 }, skill: 'smith' },
  bow: { slot: 'weapon', style: 'ranged', name: '활', icon: '🏹', req: 'rng', speed: 2.2, twoHand: true, s: { rng: 2.4 }, mat: { log: 3 }, skill: 'craft' },
  xbow: { slot: 'weapon', style: 'ranged', name: '석궁', icon: '🎯', req: 'rng', speed: 2.8, twoHand: true, s: { rng: 3.2 }, mat: { log: 2, bar: 1 }, skill: 'craft' },
  staff: { slot: 'weapon', style: 'magic', name: '지팡이', icon: '🔱', req: 'mag', speed: 2.6, twoHand: true, s: { mag: 3.1, def: 0.3 }, mat: { log: 3 }, skill: 'craft' },
  wand: { slot: 'weapon', style: 'magic', name: '완드', icon: '🥢', req: 'mag', speed: 2.4, s: { mag: 2.0 }, mat: { log: 1, cloth: 1 }, skill: 'craft' },
  shield: { slot: 'shield', name: '방패', icon: '🛡️', req: 'def', s: { def: 1.1 }, p: { dr: 0.004 }, mat: { bar: 3 }, skill: 'smith' },
  helm: { slot: 'head', name: '투구', icon: '⛑️', req: 'def', s: { def: 0.8, str: 0.1 }, mat: { bar: 2 }, skill: 'smith' },
  plate: { slot: 'body', name: '판금 갑옷', icon: '🥋', req: 'def', s: { def: 1.6 }, p: { dr: 0.005 }, mat: { bar: 5 }, skill: 'smith' },
  plegs: { slot: 'legs', name: '판금 각반', icon: '👖', req: 'def', s: { def: 1.2 }, mat: { bar: 3 }, skill: 'smith' },
  coif: { slot: 'head', name: '가죽 두건', icon: '🎩', req: 'rng', s: { def: 0.5, rng: 0.35 }, mat: { hide: 1 }, skill: 'craft' },
  hbody: { slot: 'body', name: '가죽 갑옷', icon: '🦺', req: 'rng', s: { def: 1.0, rng: 0.55 }, p: { dr: 0.002 }, mat: { hide: 3 }, skill: 'craft' },
  chaps: { slot: 'legs', name: '가죽 바지', icon: '👖', req: 'rng', s: { def: 0.8, rng: 0.45 }, mat: { hide: 2 }, skill: 'craft' },
  hat: { slot: 'head', name: '마법 모자', icon: '🧙', req: 'mag', s: { def: 0.3, mag: 0.45 }, mat: { cloth: 1 }, skill: 'craft' },
  robe: { slot: 'body', name: '로브 상의', icon: '👘', req: 'mag', s: { def: 0.6, mag: 0.75 }, p: { ls: 0.002 }, mat: { cloth: 3 }, skill: 'craft' },
  skirt: { slot: 'legs', name: '로브 하의', icon: '👗', req: 'mag', s: { def: 0.45, mag: 0.55 }, mat: { cloth: 2 }, skill: 'craft' },
  gloves: { slot: 'gloves', name: '장갑', icon: '🧤', req: 'def', s: { atk: 0.25, rng: 0.3, mag: 0.35, def: 0.3 }, mat: { hide: 1 }, skill: 'craft' },
  boots: { slot: 'boots', name: '장화', icon: '👢', req: 'def', s: { def: 0.5, str: 0.15 }, mat: { bar: 1 }, skill: 'smith' },
  amulet: { slot: 'amulet', name: '목걸이', icon: '📿', req: 'def', s: { atk: 0.35, str: 0.3, rng: 0.45, mag: 0.5 }, p: { ls: 0.004 }, mat: { bar: 1, gem: 1 }, skill: 'craft' },
  ring: { slot: 'ring', name: '반지', icon: '💍', req: 'def', s: { str: 0.3, rng: 0.4, mag: 0.45 }, p: { ls: 0.003, dr: 0.002 }, mat: { bar: 1, gem: 1 }, skill: 'craft' },
  cape: { slot: 'cape', name: '망토', icon: '🧣', req: 'def', s: { def: 0.5, str: 0.15, rng: 0.2, mag: 0.2 }, mat: { cloth: 2, hide: 2 }, skill: 'craft' },
};
function gearStats(type, t) {
  const g = GEAR[type];
  const v = TIERS[t].v;
  const st = {};
  for (const [k, c] of Object.entries(g.s)) st[k] = Math.round(c * v);
  for (const [k, c] of Object.entries(g.p || {})) st[k] = Math.round(c * (t + 1) * 1000) / 1000;
  return { st, sp: {} };
}
for (const type of Object.keys(GEAR)) {
  TIERS.forEach((T, t) => {
    const g = GEAR[type];
    const { st, sp } = gearStats(type, t);
    const matN = Object.values(g.mat).reduce((a, b) => a + b, 0);
    const base = `${type}${t}`;
    for (const R of RARITY) {
      const st2 = {};
      for (const [k, v] of Object.entries(st)) st2[k] = STATS[k].pct ? Math.round(v * R.mult * 10000) / 10000 : Math.round(v * R.mult);
      ITEMS[gearId(base, R.r)] = {
        name: (R.r > 1 ? `[${R.n}] ` : '') + `${T.n} ${g.name}`, icon: g.icon, kind: 'gear', type, slot: g.slot, t, r: R.r, base, rc: R.c,
        style: g.style, req: [g.req, T.lvl], speed: g.speed, twoHand: !!g.twoHand, st: st2, sp, value: Math.round(15 * (t + 1) ** 2 * matN * R.mult ** 2),
      };
    }
  });
}

// ---------- 몬스터 · 지역 ----------
const ZONE_DEFS = [
  { n: '바람 초원', base: 1, mons: [['들쥐', '🐀'], ['풀숲 슬라임', '🟢'], ['떠돌이 도적', '🦹']], boss: ['초원의 군주 멧돼지', '🐗'] },
  { n: '이끼 숲', base: 10, mons: [['독버섯 정령', '🍄'], ['숲 늑대', '🐺'], ['이끼 궁수', '🏹']], boss: ['고목 수호자', '🌳'] },
  { n: '잿빛 광산', base: 20, mons: [['동굴 박쥐', '🦇'], ['광부 해골', '💀'], ['불씨 정령', '🔥']], boss: ['광산 골렘', '🗿'] },
  { n: '안개 늪', base: 30, mons: [['늪 두꺼비', '🐸'], ['안개 마녀', '🧙'], ['늪 악어', '🐊']], boss: ['늪의 여왕 히드라', '🐉'] },
  { n: '서리 봉우리', base: 42, mons: [['서리 늑대', '🐺'], ['눈 정령', '❄️'], ['얼음 거인', '🧊']], boss: ['빙하 거인왕', '🏔️'] },
  { n: '하늘 섬', base: 55, mons: [['폭풍 독수리', '🦅'], ['구름 기사', '⚔️'], ['번개 정령', '⚡']], boss: ['폭풍 그리폰', '🦁'] },
  { n: '용암 심연', base: 70, mons: [['용암 도마뱀', '🦎'], ['화염 마법사', '🧙'], ['흑요석 기사', '🛡️']], boss: ['심연의 붉은 용', '🐲'] },
  { n: '별의 폐허', base: 85, mons: [['별빛 망령', '👻'], ['성운 궁수', '🏹'], ['공허 기사', '🌑']], boss: ['별을 삼킨 자', '🌌'] },
];
const ROT = ['melee', 'ranged', 'magic'];
const WEAK = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
const STYLE_GEAR = {
  melee: ['sword', 'axe', 'shield', 'helm', 'plate', 'plegs', 'boots'],
  ranged: ['bow', 'xbow', 'coif', 'hbody', 'chaps', 'gloves', 'boots'],
  magic: ['staff', 'wand', 'hat', 'robe', 'skirt', 'gloves', 'cape'],
};
// 전리품 표: [아이템, 확률, 최소, 최대] (확률은 드롭률 보너스를 받음, 뼈 제외)
function lootTable(style, t, i, boss) {
  const L = [[`bone${t}`, 1, boss ? 3 : 1, boss ? 3 : 1, true]];
  const lo = Math.max(0, t - 1);
  const mats = {
    melee: [[`ore${t}`, 0.3, 1, 2], [`ore${lo}`, 0.15, 1, 3], [`bar${t}`, 0.06, 1, 1]],
    ranged: [[`log${t}`, 0.3, 1, 2], [`hide${t}`, 0.25, 1, 2], [`log${lo}`, 0.12, 1, 3]],
    magic: [[`cloth${t}`, 0.3, 1, 2], [`log${t}`, 0.12, 1, 2], [`hide${lo}`, 0.1, 1, 2]],
  }[style];
  L.push(...mats, [`raw${t}`, 0.12, 1, 2], [`food${lo}`, 0.08, 1, 2], [`gem${t}`, boss ? 0.25 : 0.015, 1, 1], [`herb${t}`, boss ? 0.5 : 0.15, 1, boss ? 4 : 2]);
  if (boss) {
    L.push([`bar${t}`, 0.35, 2, 4], [`ore${t}`, 0.5, 3, 6]);
    for (const ty of STYLE_GEAR[style]) L.push([ty + t, 0.06, 1, 1]);
    for (const ty of ['amulet', 'ring', 'cape']) L.push([ty + t, 0.05, 1, 1]);
  } else {
    // 일반 몬스터: 자기 방식 장비 중 일부 (몬스터마다 다른 조합)
    const list = STYLE_GEAR[style];
    for (let k = 0; k < 4; k++) L.push([list[(i * 2 + k) % list.length] + t, 0.012, 1, 1]);
    if (i === 2) L.push([`ring${t}`, 0.004, 1, 1], [`amulet${t}`, 0.004, 1, 1]);
  }
  // 같은 아이템이 두 번 나오면 (첫 지역의 하위 재료 등) 하나로 합침
  const seen = new Map();
  for (const [id, p, a, b, fixed] of L) {
    const o = seen.get(id);
    if (o) { o.p = Math.min(1, o.p + p); o.b = Math.max(o.b, b); } else seen.set(id, { id, p, a, b, fixed: !!fixed });
  }
  return [...seen.values()];
}
// 몬스터 능력치: 레벨에 따라 체력 · 공격(명중) · 힘(피해) · 방어가 오름. 상성: 약점 방식엔 방어 x0.5, 같은 방식엔 x1.4
function makeMonster(name, icon, L, style, boss, z, i) {
  const b = boss ? 1.25 : 1;
  const defMul = { melee: 1, ranged: 1, magic: 1 };
  defMul[WEAK[style]] = 0.5;
  defMul[style] = 1.4;
  return {
    id: `m${z}_${i}`, name, icon, lvl: L, style, boss, z,
    hp: Math.round((15 + 0.0516 * L ** 2.45) * (boss ? 3 : 1)),
    atk: Math.round((2 + 0.058 * L ** 1.92) * b),
    str: Math.round((2 + 0.137 * L ** 1.71) * b),
    def: Math.round((1 + 0.176 * L ** 1.45) * b),
    defMul,
    interval: [2.6, 2.4, 3.0][i % 3] + (boss ? 0.2 : 0),
    weak: WEAK[style],
    coins: [L * 1 + 2, L * 3 + 5].map((x) => Math.round(x * (boss ? 6 : 1))),
    loot: lootTable(style, z, i, boss),
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
  addAct('wood', { id: 'wood' + t, name: LOGS[t] + ' 베기', icon: '🌲', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['log' + t]: 1 }, rare: { ['nest' + t]: RARE_FIND, ['herb' + t]: 0.04 } });
  addAct('mine', { id: 'mine' + t, name: ORES[t] + ' 캐기', icon: '⛰️', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['ore' + t]: 1 }, gem: 'gem' + t, rare: { ['gembag' + t]: RARE_FIND } });
  addAct('fish', { id: 'fish' + t, name: FISH[t] + ' 낚기', icon: '🎣', lvl: T.lvl, time: 3 + t * 0.4, xp: GATHER_XP[t], out: { ['raw' + t]: 1 }, rare: { ['chest' + t]: RARE_FIND } });
  // 연금술: 전투 물약 = 약초 2 + 뼈 1, 기타 물약 = 약초 3 + 주괴 1
  for (const P of POTION_TYPES) {
    const combat = ['atk', 'str', 'def', 'rng', 'mag'].includes(P.k);
    addAct('alch', { id: `pot_${P.k}${t}`, group: T.n + ' 물약', name: `${T.n} ${P.n} 물약`, icon: P.icon, lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * (combat ? 1.1 : 1.4)), in: combat ? { ['herb' + t]: 2, ['bone' + t]: 1 } : { ['herb' + t]: 3, ['bar' + t]: 1 }, out: { [`pot_${P.k}${t}`]: 1 } });
  }
  // 도구 (대장) · 생활 장신구 (공예)
  addAct('smith', { id: `tool_wood${t}`, group: '도구 제작', craft: true, name: `${T.n} 벌목 도끼`, icon: '🪓', lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * 2), in: { ['bar' + t]: 2, ['log' + t]: 1 }, out: { [`tool_wood${t}`]: 1 } });
  addAct('smith', { id: `tool_mine${t}`, group: '도구 제작', craft: true, name: `${T.n} 곡괭이`, icon: '⛏️', lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * 2), in: { ['bar' + t]: 2, ['log' + t]: 1 }, out: { [`tool_mine${t}`]: 1 } });
  addAct('craft', { id: `tool_fish${t}`, group: '도구 제작', craft: true, name: `${T.n} 낚싯대`, icon: '🎣', lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * 2), in: { ['log' + t]: 2, ['hide' + t]: 1 }, out: { [`tool_fish${t}`]: 1 } });
  for (const L of LIFE_GEAR) addAct('craft', { id: `life_${L.k}${t}`, group: '생활 장신구', craft: true, name: `${T.n} ${L.n}`, icon: L.icon, lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * 3), in: { ['gem' + t]: 1, ['bar' + t]: 1 }, out: { [`life_${L.k}${t}`]: 1 } });
  addAct('cook', { id: 'cook' + t, name: FISH[t] + ' 굽기', icon: '🍖', lvl: T.lvl, time: 2.4, xp: Math.round(GATHER_XP[t] * 0.9), in: { ['raw' + t]: 1 }, out: { ['food' + t]: 1 }, burn: true });
  addAct('smith', { id: 'bar' + t, group: '주괴 제련', name: T.n + ' 주괴', icon: '🧱', lvl: T.lvl, time: 2.5, xp: Math.round(GATHER_XP[t] * 0.7), in: { ['ore' + t]: 1 }, out: { ['bar' + t]: 1 } });
});
for (const [type, g] of Object.entries(GEAR)) {
  TIERS.forEach((T, t) => {
    const inp = Object.fromEntries(Object.entries(g.mat).map(([m, n]) => [m + t, n]));
    const n = Object.values(g.mat).reduce((a, b) => a + b, 0);
    addAct(g.skill, { id: `${type}${t}`, group: '장비 제작', craft: true, name: `${T.n} ${g.name}`, icon: g.icon, lvl: T.lvl, time: 3, xp: Math.round(GATHER_XP[t] * 0.85 * n), in: inp, out: { [`${type}${t}`]: 1 } });
  });
}

// ---------- 신성: 기도 ----------
export const PRAYERS = [
  { id: 'skin', name: '단단한 피부', icon: '🗿', lvl: 1, fx: { defPct: 0.05 } },
  { id: 'swift', name: '날랜 손놀림', icon: '🗡️', lvl: 6, fx: { atkPct: 0.05 } },
  { id: 'might', name: '강인한 힘', icon: '💪', lvl: 11, fx: { strPct: 0.05 } },
  { id: 'eye', name: '날카로운 눈', icon: '👁️', lvl: 16, fx: { rngPct: 0.08 } },
  { id: 'mind', name: '맑은 정신', icon: '🔮', lvl: 18, fx: { magPct: 0.08 } },
  { id: 'finger', name: '가벼운 손가락', icon: '🤏', lvl: 20, fx: { thief: 0.05 } },
  { id: 'shell', name: '굳은 껍질', icon: '🐢', lvl: 22, fx: { defPct: 0.1 } },
  { id: 'endure', name: '지구력', icon: '🪓', lvl: 27, fx: { gspd: 0.1 } },
  { id: 'falcon', name: '매의 시야', icon: '🦅', lvl: 31, fx: { atkPct: 0.1, rngPct: 0.1 } },
  { id: 'arcane', name: '비전의 눈', icon: '✴️', lvl: 32, fx: { atkPct: 0.1, magPct: 0.1 } },
  { id: 'wind', name: '순풍', icon: '🍀', lvl: 35, fx: { drop: 0.08 } },
  { id: 'shadow', name: '그림자 걸음', icon: '👤', lvl: 38, fx: { thief: 0.1 } },
  { id: 'steel', name: '강철 의지', icon: '⚔️', lvl: 40, fx: { strPct: 0.12, defPct: 0.15 } },
  { id: 'regen', name: '생명의 기도', icon: '💚', lvl: 42, fx: { hpTick: 6 } },
  { id: 'soul', name: '영혼 흡수', icon: '🩸', lvl: 45, fx: { ls: 0.01 } },
  { id: 'hands', name: '안정된 손', icon: '🔨', lvl: 46, fx: { pspd: 0.05, cspd: 0.05 } },
  { id: 'attune', name: '조율', icon: '📘', lvl: 50, fx: { sxp: 0.1 } },
  { id: 'aegis', name: '신성한 방패', icon: '🌟', lvl: 54, fx: { dr: 0.15 } },
  { id: 'titan', name: '거인의 힘', icon: '🗿', lvl: 58, fx: { strPct: 0.2 } },
  { id: 'master', name: '대도의 기도', icon: '🎭', lvl: 59, fx: { thief: 0.15 } },
  { id: 'artisan', name: '장인의 집중', icon: '⚒️', lvl: 60, fx: { pspd: 0.08, cspd: 0.08 } },
  { id: 'hunter', name: '포식자의 눈', icon: '🏹', lvl: 61, fx: { rngPct: 0.22 } },
  { id: 'surge', name: '마력 쇄도', icon: '🌀', lvl: 62, fx: { magPct: 0.22 } },
  { id: 'venge', name: '신성한 복수', icon: '⚡', lvl: 64, fx: { bossDmg: 0.25 } },
  { id: 'sanct', name: '성역', icon: '⛪', lvl: 66, fx: { atkPct: 0.25, strPct: 0.18, defPct: 0.25 } },
  { id: 'tenac', name: '끈기', icon: '🎯', lvl: 68, fx: { rngPct: 0.25, defPct: 0.12 } },
  { id: 'cosmic', name: '우주의 힘', icon: '🌌', lvl: 70, fx: { magPct: 0.25, defPct: 0.12 } },
  { id: 'forge', name: '대장간의 율동', icon: '🔥', lvl: 72, fx: { pspd: 0.12, cspd: 0.12 } },
];

// ---------- 펫 ----------
export const PETS = [
  { id: 'squirrel', name: '도토리 다람쥐', icon: '🐿️', src: 'wood', p: 1 / 4000, fx: { gspd: 0.1 } },
  { id: 'mole', name: '꼬마 두더지', icon: '🦔', src: 'mine', p: 1 / 4000, fx: { gspd: 0.05, sxp: 0.05 } },
  { id: 'otter', name: '장난꾸러기 수달', icon: '🦦', src: 'fish', p: 1 / 4000, fx: { heal: 0.15, gspd: 0.05 } },
  { id: 'salamander', name: '불씨 도롱뇽', icon: '🦎', src: 'smith', p: 1 / 3000, fx: { cspd: 0.1 } },
  { id: 'moth', name: '비단 나방', icon: '🦋', src: 'craft', p: 1 / 3000, fx: { cspd: 0.05, pspd: 0.05 } },
  { id: 'chick', name: '노릇 병아리', icon: '🐥', src: 'cook', p: 1 / 3000, fx: { pspd: 0.1, burn: 0.5 } },
  { id: 'boar', name: '아기 멧돼지', icon: '🐗', src: 'boss:0', p: 1 / 150, fx: { strPct: 0.05, rngPct: 0.05, magPct: 0.05 } },
  { id: 'sprout', name: '새싹 수호자', icon: '🌱', src: 'boss:1', p: 1 / 180, fx: { drop: 0.1 } },
  { id: 'pebble', name: '조약돌 골렘', icon: '🗿', src: 'boss:2', p: 1 / 200, fx: { defPct: 0.1 } },
  { id: 'hydra', name: '꼬마 히드라', icon: '🐍', src: 'boss:3', p: 1 / 220, fx: { hpTick: 25 } },
  { id: 'yeti', name: '아기 설인', icon: '⛄', src: 'boss:4', p: 1 / 250, fx: { defPct: 0.1, hpTick: 10, ls: 0.01 } },
  { id: 'griffin', name: '꼬마 그리폰', icon: '🦅', src: 'boss:5', p: 1 / 280, fx: { gspd: 0.1, pspd: 0.1 } },
  { id: 'drake', name: '새끼 용', icon: '🐉', src: 'boss:6', p: 1 / 300, fx: { strPct: 0.06, rngPct: 0.06, magPct: 0.06, hpTick: 15 } },
  { id: 'star', name: '별똥 정령', icon: '🌠', src: 'boss:7', p: 1 / 350, fx: { drop: 0.1, bossDmg: 0.1 } },
];
export const PET = Object.fromEntries(PETS.map((p) => [p.id, p]));

// ---------- 전투 공식 ----------
// 방어 레벨마다 최대 체력: 50까지 +5, 그 뒤로 조금씩 더
export const hpPerDefLvl = (l) => (l <= 50 ? 5 : 5 + Math.ceil((l - 50) / 8));
export const baseHp = (defLvl) => { let hp = 100; for (let l = 1; l <= defLvl; l++) hp += hpPerDefLvl(l); return hp; };
// 적 명중률: 적 공격 / (적 공격 + 내 방어 x 0.43)
export const penChance = (mAtk, def) => mAtk / (mAtk + Math.max(0, def) * 0.43);
// 방어 효율: 받는 피해를 이만큼 줄임
export const defEff = (def, mStr) => (Math.max(0, def) * 0.25) / (Math.max(0, def) * 0.25 + 100 + mStr * 0.2);
// 몬스터 피해 굴림: 힘 x 0.42 ~ 0.58, 최저 피해 = 힘 x 0.04
export const MON_ROLL = [0.42, 0.58];
export const monFloor = (m) => Math.max(1, Math.floor(m.str * 0.04));
export const monDef = (m, style) => Math.round(m.def * (m.defMul?.[style] ?? 1));
export const RESPAWN = 1.5;
export const DEATH_TIME = 5;
export const OFFLINE_CAP = 12 * 3600;
export const SHOP = [
  { id: 'bread', price: 10 },
  ...['sword', 'bow', 'wand', 'shield', 'helm', 'plate', 'plegs', 'coif', 'hbody', 'chaps', 'hat', 'robe', 'skirt'].flatMap((ty) => [0, 1].map((t) => ({ id: ty + t, price: ITEMS[ty + t].value * 4 }))),
];
