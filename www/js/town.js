// 별무리 개척기 — 🏰 마을: 의뢰(퀘스트) · 재능 · 박물관 · 떠돌이 상인(한정 재고) · 별빛 축제(매일)
import { ZONES, ITEMS, TIERS, SKILLS, SKILL, GEAR, RARITY, PETS, PET, STYLES, gearId, rollRarity, SPECIAL_NAMES, FLAT_SP } from './data.js';
import { Game } from './game.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const spText = (sp) => Object.entries(sp || {}).filter(([k]) => SPECIAL_NAMES[k] && sp[k]).map(([k, v]) => `${SPECIAL_NAMES[k]} +${FLAT_SP.has(k) ? fmt(v) : pct(v)}`).join(', ');

// ---------- 의뢰 ----------
const RANKS = TIERS.map((T, t) => ['E', 'D', 'C', 'B', 'A', 'S', 'S', 'SS', 'SS'][t] || (t < 15 ? 'SS' : 'SSS'));
const RANK_CP = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 4, SS: 6, SSS: 8 };
const MAX_Q = 199;
const BASE_ZONE = Object.fromEntries(ZONES.filter((z) => z.base).map((z) => [z.t, z]));
export const QUESTS = [];
Object.values(BASE_ZONE).forEach((z) => {
  const t = z.t;
  const rank = RANKS[t];
  const coin = (k) => Math.round(k * (t + 1) ** 2 * 400);
  const reward = (k, gear) => ({ coins: coin(k), gear, cp: RANK_CP[rank] });
  z.mons.slice(0, 3).forEach((m, i) => QUESTS.push({ id: `q${t}_k${i}`, z: t, rank, name: `${m.name} 토벌`, desc: `${m.icon} ${m.name} ${50 + t * 25}마리 처치`, type: 'kill', target: m.id, qty: 50 + t * 25, reward: reward(1, ['sword', 'bow', 'wand'][i] + t) }));
  QUESTS.push({ id: `q${t}_boss`, z: t, rank, name: `${z.mons[3].name}의 최후`, desc: `👑 ${z.mons[3].name} 3마리 처치`, type: 'kill', target: z.mons[3].id, qty: 3, reward: reward(3, ['amulet', 'ring', 'cape'][t % 3] + t) });
  QUESTS.push({ id: `q${t}_wood`, z: t, rank, name: '목재 납품', desc: `${ITEMS['log' + t].icon} ${ITEMS['log' + t].name} ${80 + t * 20}개 모으기`, type: 'got', target: 'log' + t, qty: 80 + t * 20, reward: reward(1.5, null) });
  QUESTS.push({ id: `q${t}_ore`, z: t, rank, name: '광석 납품', desc: `${ITEMS['ore' + t].icon} ${ITEMS['ore' + t].name} ${80 + t * 20}개 모으기`, type: 'got', target: 'ore' + t, qty: 80 + t * 20, reward: reward(1.5, 'helm' + t) });
  QUESTS.push({ id: `q${t}_cook`, z: t, rank, name: '보급 식량', desc: `${ITEMS['food' + t].icon} ${ITEMS['food' + t].name} ${60 + t * 15}개 모으기`, type: 'got', target: 'food' + t, qty: 60 + t * 15, reward: reward(1.5, null) });
  QUESTS.push({ id: `q${t}_lvl`, z: t, rank, name: '실력 증명', desc: `전투 레벨 ${Math.min(MAX_Q, z.lvl + 10)} 달성`, type: 'clvl', qty: Math.min(MAX_Q, z.lvl + 10), reward: reward(2, 'plate' + t) });
});
const QUEST = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const MAX_ACTIVE = 3;

// ---------- 재능 (공훈 점수로 찍음) ----------
export const TALENTS = [
  { id: 'gather', n: '채집 속도', icon: '🪓', fx: { gspd: 0.005 }, max: 30 },
  { id: 'proc', n: '생산 속도', icon: '🍳', fx: { pspd: 0.005 }, max: 20 },
  { id: 'craft', n: '제작 속도', icon: '🔨', fx: { cspd: 0.005 }, max: 20 },
  { id: 'sxp', n: '생활 경험치', icon: '📘', fx: { sxp: 0.005 }, max: 20 },
  { id: 'div', n: '신성 경험치', icon: '✨', fx: { dxp: 0.005 }, max: 30 },
  { id: 'dmg', n: '공격 · 힘 · 원거리 · 마법', icon: '⚔️', fx: { atkFlat: 6, strFlat: 6, rngFlat: 6, magFlat: 6 }, max: 30 },
  { id: 'def', n: '방어', icon: '🛡️', fx: { defFlat: 9 }, max: 30 },
  { id: 'dr', n: '피해 감소', icon: '🧱', fx: { dr: 0.0025 }, max: 20 },
  { id: 'drop', n: '드롭률', icon: '🍀', fx: { drop: 0.0025 }, max: 20 },
  { id: 'thief', n: '도둑질 성공률', icon: '🎭', fx: { thief: 0.005 }, max: 20 },
  { id: 'boss', n: '보스 피해', icon: '⚡', fx: { bossDmg: 0.005 }, max: 20 },
  { id: 'regen', n: '체력 재생 (3초마다)', icon: '💚', fx: { hpTick: 2 }, max: 20 },
];
const talentCost = (L) => 1 + Math.floor(L / 5);

// ---------- 박물관 ----------
const MUSEUM_TIER = [1, 2, 3, 4.5, 6, 8, 10.5, 13, 16];
for (let t = MUSEUM_TIER.length; t < TIERS.length; t++) MUSEUM_TIER.push(Math.round(16 * 1.2 ** (t - 8) * 10) / 10);
const MUSEUM_BASE = {
  melee: { atkPct: 0.0011, strPct: 0.0011, defPct: 0.0013, dr: 0.0006 },
  ranged: { rngPct: 0.0023, defPct: 0.0008, ls: 0.0001 },
  magic: { magPct: 0.0021, defPct: 0.0011, dr: 0.0005 },
};
const MUSEUM_CAP = { atkPct: 0.45, strPct: 0.45, rngPct: 0.45, magPct: 0.45, ls: 0.0075 };
const MUSEUM_DEF_CAP = { melee: 0.4, ranged: 0.26, magic: 0.32 };
const MUSEUM_DR_CAP = { melee: 0.2, ranged: 0, magic: 0.12 };
const rarityFactor = (r) => 0.2 + (RARITY[r - 1].mult - 1) * 1.5;
function families(type) {
  const g = GEAR[type];
  if (g.style) return [g.style];
  if (g.req === 'atk' || g.req === 'str' || ['shield', 'helm', 'plate', 'plegs'].includes(type)) return ['melee'];
  if (g.req === 'rng') return ['ranged'];
  if (g.req === 'mag') return ['magic'];
  return ['melee', 'ranged', 'magic'];
}

// ---------- 떠돌이 상인 (1시간마다 재고 교체) ----------
const SHOP_PERIOD = 3600 * 1000;

// ---------- 별빛 축제 (매일) ----------
export const isFestival = () => true;
// 상점: 축제 펫 전부 + 내 단계(전투 레벨로 갈 수 있는 가장 높은 단계) 물건
const POTS = ['atk', 'str', 'def', 'rng', 'mag', 'regen', 'boss', 'luck', 'gather', 'prod', 'craft', 'thief'];
function festShop(t) {
  return [
    ...PETS.filter((x) => x.src === 'event').map((x) => ({ pet: x.id, price: x.price, g: '🐾 축제 펫' })),
    ...POTS.map((k) => ({ id: `pot_${k}${t}`, n: 3, price: 4 + t * 2, g: '🧪 물약 (3개 묶음)' })),
    { id: 'nest' + t, n: 2, price: 8 + t * 3, g: '🎁 상자 · 재료' }, { id: 'gembag' + t, n: 2, price: 8 + t * 3, g: '🎁 상자 · 재료' }, { id: 'chest' + t, n: 2, price: 8 + t * 3, g: '🎁 상자 · 재료' },
    { id: 'herb' + t, n: 10, price: 3 + t, g: '🎁 상자 · 재료' }, { id: 'gem' + t, n: 1, price: 10 + t * 3, g: '🎁 상자 · 재료' }, { id: 'food' + t, n: 20, price: 4 + t, g: '🎁 상자 · 재료' },
    { id: 'sstone' + t, n: 1, price: 15 + t * 4, g: '🎁 상자 · 재료' }, 
    { id: 'whistle', n: 1, price: 150, g: '✨ 특별' }, { id: 'tome_bless', n: 1, price: 3000, g: '✨ 특별' }, { id: 'tome_undying', n: 1, price: 4500, g: '✨ 특별' }, { id: 'tome_heaven', n: 1, price: 6000, g: '✨ 특별' },
  ];
}

// ---------- 게임에 기능 붙이기 ----------
const P = Game.prototype;
P.townInit = function () {
  const s = this.s;
  s.quests ||= { active: {}, done: [] };
  s.talents ||= {};
  s.museum ||= {};
  for (const bid of Object.keys(s.museum)) if (!ITEMS[bid]) delete s.museum[bid]; // 없어진 장비(방패) 기록 정리
  s.cpQuest ||= 0;
  s.talentResets ||= 0;
  s.trader ||= { at: 0, items: [] };
  s.candy ||= 0;
};
P.cpTotal = function () {
  const lv = SKILLS.reduce((a, k) => a + this.lvl(k.id), 0);
  const bossFirst = ZONES.filter((z) => this.s.kills?.[z.mons[3].id]).length * 2;
  return (this.s.cpQuest || 0) + Math.floor(lv / 5) + bossFirst;
};
P.cpSpent = function () { return TALENTS.reduce((a, t) => { let c = 0; for (let L = 0; L < (this.s.talents[t.id] || 0); L++) c += talentCost(L); return a + c; }, 0); };
P.cpFree = function () { return this.cpTotal() - this.cpSpent(); };
P.learn = function (id) {
  const t = TALENTS.find((x) => x.id === id);
  const L = this.s.talents[id] || 0;
  if (!t || L >= t.max || this.cpFree() < talentCost(L)) return false;
  this.s.talents = { ...this.s.talents, [id]: L + 1 };
  this.dirty();
  return true;
};
P.resetTalents = function () {
  const cost = 1000 * (this.s.talentResets + 1) ** 2;
  if (this.s.coins < cost) return false;
  this.s.coins -= cost;
  this.s.talentResets++;
  this.s.talents = {};
  this.dirty();
  return true;
};
P.museumStyle = function () { return this.style(); };
P.museumBonus = function (style = this.museumStyle()) {
  const tot = {};
  const base = MUSEUM_BASE[style];
  for (const [bid, r] of Object.entries(this.s.museum || {})) {
    const it = ITEMS[bid];
    if (!it || !families(it.type).includes(style)) continue;
    const m = MUSEUM_TIER[it.t] * rarityFactor(r);
    for (const [k, v] of Object.entries(base)) tot[k] = (tot[k] || 0) + v * m;
  }
  for (const k of Object.keys(tot)) {
    const cap = k === 'defPct' ? MUSEUM_DEF_CAP[style] : k === 'dr' ? MUSEUM_DR_CAP[style] : MUSEUM_CAP[k];
    if (cap != null) tot[k] = Math.min(cap, tot[k]);
  }
  return tot;
};
P.donate = function (id) {
  const it = ITEMS[id];
  if (it?.kind !== 'gear' || this.have(id) < 1) return false;
  const cur = this.s.museum[it.base] || 0;
  if (it.r <= cur) return false;
  this.give(id, -1);
  this.s.museum = { ...this.s.museum, [it.base]: it.r };
  this.dirty();
  this.toast(`🏛️ ${it.name} 기증!`, 'loot');
  return true;
};
P.talentBonus = function () {
  const tot = {};
  for (const t of TALENTS) { const L = this.s.talents?.[t.id] || 0; for (const [k, v] of Object.entries(t.fx)) tot[k] = (tot[k] || 0) + v * L; }
  return tot;
};
const _extra = P.extraSources;
P.extraSources = function () { return [..._extra.call(this), this.museumBonus(), this.talentBonus(), ...(this.extraSources2 ? this.extraSources2() : [])]; };

// 의뢰 진행
P.questProgress = function (q, base) {
  if (q.type === 'kill') return Math.max(0, (this.s.kills?.[q.target] || 0) - (base || 0));
  if (q.type === 'got') return Math.max(0, (this.s.log.got?.[q.target] || 0) - (base || 0));
  if (q.type === 'clvl') return this.combatLevel();
  return 0;
};
P.questOpen = function (q) { return this.combatLevel() + 5 >= BASE_ZONE[q.z].lvl || q.z === 0; };
P.acceptQuest = function (id) {
  const q = QUEST[id], A = this.s.quests.active;
  if (!q || A[id] != null || this.s.quests.done.includes(id) || Object.keys(A).length >= MAX_ACTIVE || !this.questOpen(q)) return false;
  this.s.quests.active = { ...A, [id]: q.type === 'kill' ? this.s.kills?.[q.target] || 0 : q.type === 'got' ? this.s.log.got?.[q.target] || 0 : 0 };
  return true;
};
P.dropQuest = function (id) { const A = { ...this.s.quests.active }; delete A[id]; this.s.quests.active = A; };
P.claimQuest = function (id) {
  const q = QUEST[id], base = this.s.quests.active[id];
  if (!q || base == null || this.questProgress(q, base) < q.qty) return false;
  this.dropQuest(id);
  this.s.quests.done = [...this.s.quests.done, id];
  this.s.coins += q.reward.coins;
  this.s.cpQuest += q.reward.cp;
  let gtxt = '';
  if (q.reward.gear) { const gid = gearId(q.reward.gear, rollRarity(3)); this.give(gid, 1); gtxt = ` · ${ITEMS[gid].name}`; }
  this.toast(`📜 의뢰 완료! 💰${fmt(q.reward.coins)} · 공훈 +${q.reward.cp}${gtxt}`, 'pet');
  return true;
};

// 떠돌이 상인
P.traderStock = function () {
  const tr = this.s.trader, now = Date.now();
  const slot = Math.floor(now / SHOP_PERIOD);
  if (tr.at === slot && tr.items.length) return tr;
  const maxT = Math.max(0, ...ZONES.filter((z) => this.combatLevel() + 5 >= z.lvl).map((z) => z.t));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const items = [];
  for (let i = 0; i < 6; i++) {
    const t = Math.floor(Math.random() * (maxT + 1));
    const kind = pick(['pot', 'pot', 'gear', 'herb', 'gem', 'box']);
    let id, price, stock;
    if (kind === 'gear') { id = gearId(pick(Object.keys(GEAR)) + t, rollRarity(2)); price = ITEMS[id].value * 3; stock = 1; }
    else if (kind === 'pot') { id = pick(['atk', 'str', 'def', 'rng', 'mag', 'regen', 'boss', 'luck', 'gather', 'prod', 'craft', 'thief']); id = `pot_${id}${t}`; price = ITEMS[id].value * 4; stock = 3 + Math.floor(Math.random() * 5); }
    else if (kind === 'herb') { id = 'herb' + t; price = ITEMS[id].value * 4; stock = 10 + Math.floor(Math.random() * 20); }
    else if (kind === 'gem') { id = 'gem' + t; price = ITEMS[id].value * 4; stock = 2 + Math.floor(Math.random() * 4); }
    else if (kind === 'box') { id = pick(['nest', 'gembag', 'chest']) + t; price = ITEMS[id].value * 5; stock = 1 + Math.floor(Math.random() * 3); }
    else { id = `tool_${pick(['wood', 'mine', 'fish'])}${t}`; price = ITEMS[id].value * 3; stock = 1; }
    items.push({ id, price, stock });
  }
  this.s.trader = { at: slot, items };
  return this.s.trader;
};
P.traderBuy = function (i, n = 1) {
  const it = this.s.trader.items[i];
  if (!it) return 0;
  let k = 0;
  while (k < n && it.stock > 0 && this.s.coins >= it.price) { this.s.coins -= it.price; it.stock--; this.give(it.id, 1); k++; }
  this.s.trader = { ...this.s.trader };
  return k;
};
// 축제: 처치마다 별사탕 20%
const _kill = P.kill;
P.kill = function (m) {
  _kill.call(this, m);
  if (isFestival() && Math.random() < 0.2 * (1 + this.sp('drop'))) { this.s.candy = (this.s.candy || 0) + (m.boss ? 5 : 1); }
};
P.festTier = function () { return Math.max(0, ...ZONES.filter((z) => this.combatLevel() + 5 >= z.lvl).map((z) => z.t)); };
P.festBuy = function (x) {
  if ((this.s.candy || 0) < x.price) return false;
  if (x.pet && this.s.pets.includes(x.pet)) { if (!this.petUp?.(PET[x.pet])) return false; } // 이미 있으면 레벨 업
  else if (x.pet) { const pt = PET[x.pet]; if (!pt) return false; this.s.pets.push(pt.id); if (!this.s.pet) this.s.pet = pt.id; this.dirty(); this.toast(`🐾 펫 획득! ${pt.icon} ${pt.name}`, 'pet'); }
  else if (ITEMS[x.id]) this.give(x.id, x.n || 1);
  else return false;
  this.s.candy -= x.price;
  return true;
};

// ---------- 화면 ----------
export function tabTown(ui, p) {
  const g = ui.g, s = g.s;
  g.townInit();
  const seg = h('div', 'seg');
  for (const [k, n] of [['quest', '📜 의뢰'], ['talent', '🌟 재능'], ['museum', '🏛️ 박물관'], ['trader', '🧳 상인'], ['fest', '🎉 축제'], ...(ui.townExtra || [])]) {
    const b = h('button', (ui.town || 'quest') === k ? 'on' : '', n);
    b.addEventListener('click', () => { ui.town = k; });
    seg.appendChild(b);
  }
  p.appendChild(seg);
  const fn = { quest: townQuest, talent: townTalent, museum: townMuseum, trader: townTrader, fest: townFest, ...(ui.townFns || {}) }[ui.town || 'quest'];
  fn(ui, p, g, s);
}

function townQuest(ui, p, g, s) {
  const A = s.quests.active;
  ui.autoQuestCard?.(p);
  p.appendChild(h('div', 'card mut', `동시에 ${MAX_ACTIVE}개까지 받을 수 있습니다 · 완료하면 💰 · 공훈 점수(재능) · 장비(희귀 이상) · 완료 ${s.quests.done.length} / ${QUESTS.length}`));
  p.appendChild(h('div', 'h', '진행 중'));
  if (!Object.keys(A).length) p.appendChild(h('div', 'mut', '받은 의뢰가 없습니다'));
  for (const [id, base] of Object.entries(A)) {
    const q = QUEST[id];
    const pr = Math.min(q.qty, g.questProgress(q, base));
    const r = h('div', 'row on', `<div class="ic">📜</div><div class="info"><div class="nm">[${q.rank}] ${q.name}</div><div class="mut">${q.desc} · ${fmt(pr)} / ${fmt(q.qty)}</div>
      <div class="lvbar"><div style="width:${pct(pr / q.qty)}"></div></div></div>
      ${pr >= q.qty ? '<button class="btn pri cl">보상 받기</button>' : '<button class="btn sm dr">포기</button>'}`);
    r.querySelector('.cl')?.addEventListener('click', () => g.claimQuest(id));
    r.querySelector('.dr')?.addEventListener('click', () => g.dropQuest(id));
    p.appendChild(r);
  }
  p.appendChild(h('div', 'h', '받을 수 있는 의뢰'));
  const list = QUESTS.filter((q) => A[q.id] == null && !s.quests.done.includes(q.id) && g.questOpen(q));
  for (const q of list.slice(0, 15)) {
    const rw = `💰${fmt(q.reward.coins)} · 공훈 +${q.reward.cp}${q.reward.gear ? ` · ${ITEMS[q.reward.gear].name} (희귀 이상)` : ''}`;
    const r = h('div', 'row', `<div class="ic">📋</div><div class="info"><div class="nm">[${q.rank}] ${q.name} <span class="mut">${BASE_ZONE[q.z].n}</span></div><div class="mut">${q.desc}</div><div class="mut sp">${rw}</div></div><button class="btn sm pri"${Object.keys(A).length >= MAX_ACTIVE ? ' disabled' : ''}>받기</button>`);
    r.querySelector('button').addEventListener('click', () => g.acceptQuest(q.id));
    p.appendChild(r);
  }
  if (!list.length) p.appendChild(h('div', 'mut', '전투 레벨을 올리면 다음 지역 의뢰가 열립니다'));
}

function townTalent(ui, p, g, s) {
  const cost = 1000 * (s.talentResets + 1) ** 2;
  const c = h('div', 'card', `<b>🌟 공훈 점수 ${fmt(g.cpFree())}</b> <span class="mut">/ 전체 ${fmt(g.cpTotal())} (의뢰 · 모든 스킬 레벨 합 5마다 1 · 지역 보스 첫 처치 2)</span>
    <div class="seg" style="margin-top:6px"><button class="rs">↺ 초기화 💰${fmt(cost)}</button></div>`);
  c.querySelector('.rs').addEventListener('click', () => ui.modal('재능 초기화', `찍은 재능을 모두 되돌립니다. 💰${fmt(cost)}이 듭니다.`, [{ label: '취소' }, { label: '초기화', pri: true, fn: () => { if (!g.resetTalents()) g.toast('골드가 부족합니다', 'bad'); } }]));
  p.appendChild(c);
  for (const t of TALENTS) {
    const L = s.talents[t.id] || 0;
    const now = Object.fromEntries(Object.entries(t.fx).map(([k, v]) => [k, v * L]));
    const r = h('div', 'row', `<div class="ic">${t.icon}</div><div class="info"><div class="nm">${t.n} <span class="mut">${L} / ${t.max}</span></div>
      <div class="mut sp">지금 ${spText(now) || '없음'} · 1단계 ${spText(t.fx)}</div><div class="lvbar"><div style="width:${pct(L / t.max)}"></div></div></div>
      <button class="btn sm pri"${L >= t.max || g.cpFree() < talentCost(L) ? ' disabled' : ''}>${L >= t.max ? '최대' : `+1 (${talentCost(L)}점)`}</button>`);
    r.querySelector('button').addEventListener('click', () => g.learn(t.id));
    p.appendChild(r);
  }
}

function townMuseum(ui, p, g, s) {
  ui.autoDonateCard?.(p);
  ui.museumLootCard?.(p);
  const st = g.style();
  const b = g.museumBonus(st);
  p.appendChild(h('div', 'card', `<b>🏛️ 박물관</b> <span class="mut">기증한 장비 ${Object.keys(s.museum).length}종</span>
    <div class="mut">장비를 기증하면 (사라짐) 지금 쓰는 전투 방식에 맞는 스탯이 %로 오릅니다. 단계가 높고 등급이 좋을수록 큼 · 같은 장비는 더 높은 등급으로만 바꿔 기증</div>
    <div style="margin-top:6px">${STYLES[st].icon} ${STYLES[st].name} 보너스: <span class="sp">${spText(b) || '없음'}</span></div>`));
  const cand = Object.keys(s.bank).filter((id) => ITEMS[id]?.kind === 'gear' && ITEMS[id].r > (s.museum[ITEMS[id].base] || 0))
    .sort((a, c) => ITEMS[c].t - ITEMS[a].t || ITEMS[c].r - ITEMS[a].r);
  p.appendChild(h('div', 'h', '기증할 수 있는 장비'));
  if (!cand.length) p.appendChild(h('div', 'mut', '기증할 장비가 없습니다 (같은 장비는 더 높은 등급만)'));
  for (const id of cand.slice(0, 30)) {
    const it = ITEMS[id];
    const fam = families(it.type).map((f) => STYLES[f].icon).join('');
    const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm" style="color:${it.rc}">${it.name} <span class="mut">x${g.have(id)}</span></div><div class="mut">${fam} 박물관 · 지금 기증 등급: ${s.museum[it.base] ? RARITY[s.museum[it.base] - 1].n : '없음'}</div></div><button class="btn sm pri">기증</button>`);
    r.querySelector('button').addEventListener('click', () => g.donate(id));
    p.appendChild(r);
  }
  const done = Object.entries(s.museum).filter(([bid]) => ITEMS[bid]).sort((a, c) => ITEMS[c[0]].t - ITEMS[a[0]].t);
  p.appendChild(h('div', 'h', `전시 중 (${done.length})`));
  p.appendChild(h('div', 'card', done.map(([bid, r]) => `<span style="color:${RARITY[r - 1].c}">${ITEMS[bid].icon}${ITEMS[bid].name}</span>`).join(' · ') || '<span class="mut">없음</span>'));
}

function townTrader(ui, p, g, s) {
  const tr = g.traderStock();
  const left = SHOP_PERIOD - (Date.now() % SHOP_PERIOD);
  p.appendChild(h('div', 'card mut', `🧳 떠돌이 상인 · 1시간마다 물건이 바뀝니다 (다음 교체까지 약 ${Math.ceil(left / 60000)}분) · 💰 ${fmt(s.coins)}`));
  tr.items.forEach((x, i) => {
    const it = ITEMS[x.id];
    const r = h('div', 'row' + (x.stock ? '' : ' lock'), `<div class="ic">${it.icon}</div><div class="info"><div class="nm" style="color:${it.rc || 'inherit'}">${it.name} <span class="mut">재고 ${x.stock}</span></div><div class="mut">개당 💰${fmt(x.price)}</div></div>
      <button class="btn sm pri b1"${x.stock && s.coins >= x.price ? '' : ' disabled'}>사기</button><button class="btn sm ba"${x.stock > 1 && s.coins >= x.price ? '' : ' disabled'}>모두</button>`);
    r.querySelector('.b1').addEventListener('click', () => g.traderBuy(i, 1));
    r.querySelector('.ba').addEventListener('click', () => g.traderBuy(i, x.stock));
    p.appendChild(r);
  });
}

function townFest(ui, p, g, s) {
  const t = g.festTier();
  p.appendChild(h('div', 'card', `<b>🎉 별빛 축제</b> <span class="sp">매일 진행 중!</span>
    <div class="mut">몬스터를 잡으면 20% 확률로 🍬 별사탕 (보스는 5개) · 드롭률 보너스 적용 · 물건은 내 단계(${TIERS[t].n})에 맞춰 바뀝니다</div><div style="margin-top:4px">🍬 별사탕 <b>${fmt(s.candy || 0)}</b></div>`));
  let grp = '';
  for (const x of festShop(t)) {
    if (x.g !== grp) { grp = x.g; p.appendChild(h('div', 'h', grp)); }
    const pet = x.pet ? PET[x.pet] : null;
    const it = pet || ITEMS[x.id];
    const plv = pet && s.pets.includes(pet.id) ? g.petLv(pet.id) : 0;
    const owned = plv >= (g.PET_MAX || 10);
    const info = pet ? (plv ? `Lv ${plv} → ${plv + 1} · ` : '') + spText(plv ? g.petFx(pet.id, plv + 1) : pet.fx) : `x${fmt(x.n)}${it.kind === 'potion' ? ' · ' + spText(it.fx) : ''}`;
    const r = h('div', 'row' + (owned ? ' lock' : ''), `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name}</div><div class="mut sp">${info}</div></div><button class="btn sm pri"${!owned && (s.candy || 0) >= x.price ? '' : ' disabled'}>${owned ? '최대 레벨' : `${plv ? '⬆ ' : ''}🍬 ${fmt(x.price)}`}</button>`);
    r.querySelector('button').addEventListener('click', () => g.festBuy(x));
    p.appendChild(r);
  }
}
