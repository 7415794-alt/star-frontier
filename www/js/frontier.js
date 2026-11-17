// 별무리 개척기 — 5차: 탄약(화살 · 룬) · 스킬 보스 · 세계 보스 · 초희귀 드롭 · 기도서 · 펫 호루라기 · 보스 축하 · 처치 효과
import { ITEMS, TIERS, SKILL, ACTIONS, PETS, PRAYERS, TOMES, GEAR, STYLES, STATS, gearId, rollRarity, monDef, penChance, defEff, MON_ROLL, monFloor, COMBAT_TICK, monAtkStr, TOOLS, toolCost } from './data.js';
import { Game, C } from './game.js';
import { UI } from './ui.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const mmss = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초`);
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const tierFor = (L) => { let t = 0; TIERS.forEach((T, i) => { if (L >= T.lvl) t = i; }); return t; };

// ---------- 상수 ----------
export const SBOSS = [
  { skill: 'wood', n: '고목 정령왕', icon: '🌳', box: 'nest' },
  { skill: 'mine', n: '수정 거인', icon: '💠', box: 'gembag' },
  { skill: 'fish', n: '심해의 군주', icon: '🦑', box: 'chest' },
  { skill: 'steal', n: '그림자 도둑왕', icon: '🥷', box: null },
];
const SB_TIME = 120, SB_HIT = 1.5;
const sbHp = (t) => 50 * (TIERS[t].lvl + 15);
const WB_TIME = 60, WB_MAX = 3, WB_REGEN = 2 * 3600 * 1000;
const WEAK = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
const ROT = ['melee', 'ranged', 'magic'];
const WHISTLE_SEC = 1800, WHISTLE_PET = 0.15;
const ULTRA_GEAR = 0.001, ULTRA_TOME = 0.002;
export const KFX = [
  { id: 'none', n: '없음', e: '', price: 0 },
  { id: 'spark', n: '반짝임', e: '✨', price: 5000 },
  { id: 'fire', n: '불꽃', e: '🔥', price: 20000 },
  { id: 'star', n: '별빛', e: '🌟', price: 50000 },
  { id: 'skull', n: '해골', e: '💀', price: 100000 },
  { id: 'rainbow', n: '무지개', e: '🌈', price: 250000 },
  { id: 'firework', n: '불꽃놀이', e: '🎆', price: 500000 },
];

// 세계 보스: 내 전투 레벨에 맞춰 강해짐 · 전투 방식은 날마다 바뀜
export function wbMonster(L, style) {
  const b = 1.25;
  const defMul = { melee: 1, ranged: 1, magic: 1 };
  defMul[WEAK[style]] = 0.5;
  defMul[style] = 1.4;
  return {
    id: 'wb', name: '별을 삼키는 고래', icon: '🐋', lvl: L, style, boss: true, z: -1, weak: WEAK[style], defMul, interval: 3.2,
    hp: Infinity,
    ...((o) => ({ atk: o.atk, str: Math.round(o.str * 0.8) }))(monAtkStr(L, b)), def: Math.round((1 + 0.176 * L ** 1.45) * b),
  };
}
export const wbStyle = () => ROT[Math.floor(Date.now() / 86400000) % 3];

// ---------- 게임에 기능 붙이기 ----------
const P = Game.prototype;
const _townInit = P.townInit;
P.townInit = function () {
  _townInit.call(this);
  const s = this.s;
  s.wb ||= { tk: WB_MAX, at: Date.now(), best: 0, runs: 0 };
  s.tomes ||= [];
  s.kfx ||= ['none'];
  s.kfxOn ||= 'none';
  s.whistle ||= 0;
  if (s.ammoOn == null) s.ammoOn = true;
  if (s.cele == null) s.cele = true;
  s.sbWins ||= {};
  if (s.fight && !['sboss', 'wboss'].includes(s.activity?.type)) s.fight = null;
};

// 탄약: 가진 것 중 가장 좋은 것 (요구 레벨 충족) 자동 사용
P.ammoId = function (style = this.style()) {
  return null; // 화살 · 룬 없음 (원거리 · 마법은 탄약 없이 싸움)
  // eslint-disable-next-line no-unreachable
  if (this.s.ammoOn === false) return null;
  const pre = style === 'ranged' ? 'arrow' : style === 'magic' ? 'rune' : null;
  if (!pre) return null;
  for (let t = TIERS.length - 1; t >= 0; t--) {
    const id = pre + t;
    if (this.have(id) > 0 && this.lvl(ITEMS[id].req[0]) >= ITEMS[id].req[1]) return id;
  }
  return null;
};
const _bon = P.bonuses;
P.bonuses = function () {
  const fresh = !this.rt.cache;
  const b = _bon.call(this);
  if (fresh) { const a = ITEMS[this.ammoId()]; if (a) for (const [k, v] of Object.entries(a.st)) b.st[k] += v; }
  return b;
};
P.useAmmo = function () {
  const id = this.ammoId();
  if (!id) return;
  this.give(id, -1);
  if (this.have(id) < 1) { this.dirty(); this.toast(`${ITEMS[id].icon} ${ITEMS[id].name}이(가) 떨어졌습니다`, 'bad'); }
};
const _pa = P.playerAttack;
P.playerAttack = function (m, p) { _pa.call(this, m, p); this.useAmmo(); };
const _gain = P.gain;
P.gain = function (id, n = 1) {
  const r = _gain.call(this, id, n);
  if (ITEMS[id]?.kind === 'ammo') this.dirty();
  return r;
};

// 기도서로 배운 기도만 켤 수 있음
const _prayer = P.prayer;
P.prayer = function () { const pr = _prayer.call(this); return pr?.tome && !(this.s.tomes || []).includes(pr.id) ? null : pr; };
P.prayerOpen = function (pr) { return this.lvl('div') >= pr.lvl && (!pr.tome || (this.s.tomes || []).includes(pr.id)); };

// 아이템 사용: 펫 호루라기 · 기도서
P.useItem = function (id) {
  const it = ITEMS[id];
  if (!it || this.have(id) < 1) return false;
  if (it.kind === 'whistle') {
    this.give(id, -1);
    this.s.whistle = (this.s.whistle || 0) + WHISTLE_SEC;
    this.toast(`📯 펫 호루라기! 보스 펫 확률 +${pct(WHISTLE_PET, 0)} (${mmss(this.s.whistle)})`, 'pet');
    return true;
  }
  if (it.kind === 'tome') {
    if (this.s.tomes.includes(it.pr)) { this.toast('이미 배운 기도입니다', 'bad'); return false; }
    this.give(id, -1);
    this.s.tomes = [...this.s.tomes, it.pr];
    const pr = PRAYERS.find((x) => x.id === it.pr);
    this.toast(`📕 새 기도를 배웠습니다: ${pr.icon} ${pr.name} (신성 Lv ${pr.lvl})`, 'pet');
    return true;
  }
  return false;
};
const _tryPet = P.tryPet;
P.tryPet = function (pet, mul = 1) {
  if ((this.s.whistle || 0) > 0 && /boss/.test(pet.src)) mul *= 1 + WHISTLE_PET;
  return _tryPet.call(this, pet, mul);
};

// 보스 처치: 축하 · 초희귀 드롭 · 처치 효과
const _kill = P.kill;
P.kill = function (m) {
  _kill.call(this, m);
  const s = this.s;
  const e = KFX.find((x) => x.id === s.kfxOn)?.e;
  if (e) this.fx('mon', e, 'kfx');
  if (!m.boss) return;
  const mul = this.dropMult(m);
  if (Math.random() < ULTRA_GEAR * mul) {
    const gl = m.loot.filter((l) => ITEMS[l.id]?.kind === 'gear');
    if (gl.length) {
      const id = gearId(ITEMS[pick(gl).id].base, rollRarity(5));
      this.gain(id, 1);
      s.log.gear[id] = (s.log.gear[id] || 0) + 1;
      s.log.ultra = (s.log.ultra || 0) + 1;
      this.toast(`🌟 초희귀 드롭! ${ITEMS[id].name}`, 'pet');
      this.celebrate(`🌟 초희귀! ${ITEMS[id].name}`);
      this.autoEquipCheck(id);
    }
  }
  if (Math.random() < ULTRA_TOME * mul) {
    const c = TOMES.filter((tm) => tm.z <= m.t);
    if (c.length) { const tm = pick(c); this.gain(tm.id, 1); this.toast(`📕 기도서 발견! ${ITEMS[tm.id].name}`, 'pet'); this.celebrate(`📕 ${ITEMS[tm.id].name}`); }
  }
};
P.celebrate = function (text) { if (!this.quiet) this.rt.cele = { text }; };

// 다른 행동을 시작하거나 멈추면 보스전 정리
for (const fn of ['startCombat', 'startSkill', 'startBury']) {
  const o = P[fn];
  P[fn] = function (...a) { this.endFight('중단'); return o.apply(this, a); };
}
const _stop = P.stop;
P.stop = function () { this.endFight('그만둠'); _stop.call(this); };
P.endFight = function (why) {
  const A = this.s.activity;
  if (!this.s.fight) return;
  if (A?.type === 'wboss') this.wbEnd(why);
  else if (A?.type === 'sboss') { this.s.fight = null; this.s.activity = null; this.toast(`스킬 보스 도전을 ${why}했습니다`, 'bad'); }
  else this.s.fight = null;
};

// 진행: 호루라기 시간 · 보스전
const _update = P.update;
P.update = function (dt) {
  _update.call(this, dt);
  if (this.s.whistle > 0) this.s.whistle = Math.max(0, this.s.whistle - dt);
  const A = this.s.activity;
  if (A?.type === 'sboss') this.sbTick(dt);
  else if (A?.type === 'wboss') this.wbTick(dt);
};

// ---------- 스킬 보스: 스킬 레벨 · 채집 속도(도둑은 성공률)로 피해 · 제한 시간 2분 ----------
P.sbDmg = function (skill) {
  const L = this.lvl(skill);
  const spd = skill === 'steal' ? 1 + this.sp('thief') * 2 : 1 + this.sp('gspd') + this.toolSpeed(skill);
  return { lo: Math.round((L + 10) * spd * 0.8), hi: Math.round((L + 10) * spd * 1.2) };
};
P.startSB = function (skill, t) {
  const B = SBOSS.find((x) => x.skill === skill);
  if (!B || this.lvl(skill) < TIERS[t].lvl || this.have('sstone' + t) < 1) return false;
  if (this.s.activity) this.stop();
  this.give('sstone' + t, -1);
  this.newSess();
  this.rt.fx = [];
  this.s.fight = { kind: 'sb', skill, t, hp: sbHp(t), max: sbHp(t), time: SB_TIME, hitT: 0 };
  this.s.activity = { type: 'sboss', id: skill + t };
  this.rt.mon = null;
  return true;
};
P.sbTick = function (dt) {
  const f = this.s.fight;
  if (f?.kind !== 'sb') { this.s.activity = null; return; }
  f.time -= dt;
  f.hitT += dt;
  while (f.hitT >= SB_HIT && f.hp > 0) {
    f.hitT -= SB_HIT;
    const d = this.sbDmg(f.skill);
    const dmg = R(d.lo, d.hi);
    f.hp = Math.max(0, f.hp - dmg);
    this.fx('mon', String(dmg), 'hit');
    this.addXp(f.skill, dmg * 0.6);
  }
  if (f.hp <= 0) return this.sbWin(f);
  if (f.time <= 0) {
    this.s.fight = null;
    this.s.activity = null;
    this.toast(`⏱ 시간 초과! ${SBOSS.find((x) => x.skill === f.skill).n}이(가) 달아났습니다`, 'bad');
  }
};
P.sbWin = function (f) {
  const B = SBOSS.find((x) => x.skill === f.skill), t = f.t;
  this.s.fight = null;
  this.s.activity = null;
  const a = (ACTIONS[f.skill] || []).find((x) => x.lvl === TIERS[t].lvl);
  const xp = Math.round((a?.xp || 50) * 40 * (1 + this.sp('sxp')));
  this.addXp(f.skill, xp);
  const coins = 300 * (t + 1) ** 2 * (B.box ? 1 : 4);
  this.s.coins += coins;
  const got = [];
  if (B.box) { const n = R(2, 4); this.gain(B.box + t, n); got.push(`${ITEMS[B.box + t].icon}${n}`); }
  const hn = R(2, 5); this.gain('herb' + t, hn); got.push(`🌿${hn}`);
  if (Math.random() < 0.3) { this.gain('gem' + t, 1); got.push('💎1'); }
  this.s.sbWins = { ...this.s.sbWins, [f.skill]: (this.s.sbWins[f.skill] || 0) + 1 };
  const pet = PETS.find((x) => x.src === 'sboss:' + f.skill);
  if (pet) this.tryPet(pet, 1 + this.sp('drop'));
  if (this.s.cele !== false) this.celebrate(`${B.icon} ${B.n} 격파!`);
  this.rt.popup = { title: `${B.icon} ${B.n} 격파!`, html: `${SKILL[f.skill].name} XP +${fmt(xp)} · 💰 +${fmt(coins)}<br>획득 ${got.join(' ')}` };
};

// ---------- 세계 보스: 체력 무한 · 1분 동안 넣은 피해만큼 보상 · 도전권 3장 (2시간마다 1장) ----------
P.wbRegen = function () {
  const w = this.s.wb;
  if (!w) return;
  const now = Date.now();
  if (w.tk >= WB_MAX) { w.at = now; return; }
  const n = Math.floor((now - w.at) / WB_REGEN);
  if (n > 0) { w.tk = Math.min(WB_MAX, w.tk + n); w.at += n * WB_REGEN; if (w.tk >= WB_MAX) w.at = now; }
};
P.wbNext = function () { const w = this.s.wb; return w.tk >= WB_MAX ? 0 : Math.max(0, (w.at + WB_REGEN - Date.now()) / 1000); };
P.wbLevel = function () { return Math.max(5, this.combatLevel() + 5); };
P.startWB = function () {
  this.wbRegen();
  if (this.s.wb.tk < 1) return false;
  if (this.s.activity) this.stop();
  this.s.wb.tk--;
  this.newSess();
  this.rt.fx = [];
  this.s.fight = { kind: 'wb', L: this.wbLevel(), style: wbStyle(), time: WB_TIME, dmg: 0 };
  this.s.activity = { type: 'wboss', id: 'wb' };
  const rt = this.rt;
  rt.mon = null; rt.atkT = 0; rt.monT = 0; rt.dead = 0;
  rt.hp = this.maxHp();
  return true;
};
P.wbTick = function (dt) {
  const f = this.s.fight, rt = this.rt;
  if (f?.kind !== 'wb') { this.s.activity = null; return; }
  const m = (rt.wbm && rt.wbm.lvl === f.L && rt.wbm.style === f.style) ? rt.wbm : (rt.wbm = wbMonster(f.L, f.style));
  const p = this.profile();
  f.time -= dt;
  rt.tickT += dt;
  while (rt.tickT >= COMBAT_TICK) { rt.tickT -= COMBAT_TICK; if (p.sp.hpTick) rt.hp = Math.min(C.maxHp(p), rt.hp + p.sp.hpTick); }
  rt.atkT += dt;
  const iv = C.interval(p);
  while (rt.atkT >= iv) {
    rt.atkT -= iv;
    const cap = C.cap(p, monDef(m, p.style));
    const lo = C.minHit(p, cap);
    const dmg = Math.floor((lo + Math.floor(Math.random() * (cap - lo + 1))) * C.dmgMult(p, m));
    f.dmg += dmg;
    this.fx('mon', String(dmg), 'hit');
    this.useEffects('atk');
    this.useAmmo();
    const ls = C.ls(p);
    if (ls > 0 && dmg > 0) rt.hp = Math.min(C.maxHp(p), rt.hp + Math.max(1, Math.ceil(dmg * ls)));
    if (dmg > 0) this.combatXp(dmg * 0.5, p.style);
  }
  rt.monT += dt;
  while (rt.monT >= m.interval) {
    rt.monT -= m.interval;
    const hits = Math.random() < C.mHit(p, m);
    const d = hits ? C.mDmg(p, m, MON_ROLL[0] + Math.random() * (MON_ROLL[1] - MON_ROLL[0])) : 0;
    rt.hp -= d;
    this.fx('hero', !hits ? '빗나감' : d ? '-' + d : '0', d ? 'hurt' : 'miss');
    this.autoEat();
    if (rt.hp <= 0) { rt.hp = 1; return this.wbEnd('쓰러짐'); }
  }
  if (f.time <= 0) this.wbEnd('시간 종료');
};
P.wbEnd = function (why) {
  const f = this.s.fight;
  this.s.fight = null;
  this.s.activity = null;
  this.rt.mon = null;
  if (f?.kind !== 'wb') return;
  const L = f.L, t = tierFor(L);
  const unit = 15 + 0.0516 * L ** 2.45; // 같은 레벨 일반 몬스터 체력
  const c = f.dmg / unit; // 기여도 = 일반 몬스터 몇 마리 분량의 피해인지
  const w = this.s.wb;
  w.runs++;
  w.best = Math.max(w.best || 0, f.dmg);
  const mul = 1 + this.sp('drop');
  const coins = Math.round(c * (L * 2 + 4) * 2);
  this.s.coins += coins;
  const got = {};
  const add = (id, n) => { if (n > 0) { const g = this.gain(id, n); got[g] = (got[g] || 0) + n; } };
  add('herb' + t, Math.floor(c / 2));
  add('gem' + t, Math.floor((c / 6) * mul));
  add(pick(['nest', 'gembag', 'chest']) + t, Math.floor((c / 12) * mul));
  if (c >= 5) {
    const id = gearId(pick(Object.keys(GEAR)) + t, rollRarity(c >= 40 ? 5 : c >= 20 ? 4 : c >= 10 ? 3 : 2));
    add(id, 1);
    this.s.log.gear[id] = (this.s.log.gear[id] || 0) + 1;
    this.autoEquipCheck(id);
  }
  if (c >= 12 && Math.random() < 0.01 * mul) { const tm = pick(TOMES.filter((x) => x.z <= t) || []); if (tm) { add(tm.id, 1); this.celebrate(`📕 ${ITEMS[tm.id].name}`); } }
  const pet = PETS.find((x) => x.src === 'wboss');
  if (pet) this.tryPet({ ...pet, p: Math.min(pet.p, c / 3000) }, mul);
  this.rt.popup = {
    title: `🐋 세계 보스 — ${why}`,
    html: `넣은 피해 <b>${fmt(f.dmg)}</b> (최고 ${fmt(w.best)}) · 기여도 ${c.toFixed(1)}<br>💰 +${fmt(coins)}<br>${Object.entries(got).map(([id, n]) => `${ITEMS[id].icon} ${ITEMS[id].name} x${n}`).join('<br>') || '추가 보상 없음 (기여도 5 이상이면 장비)'}`,
  };
};

// 처치 효과 구매
P.buyKfx = function (id) {
  const k = KFX.find((x) => x.id === id);
  if (!k || this.s.kfx.includes(id) || this.s.coins < k.price) return false;
  this.s.coins -= k.price;
  this.s.kfx = [...this.s.kfx, id];
  this.s.kfxOn = id;
  return true;
};

// ---------- 화면 ----------
const U = UI.prototype;
U.townExtra = [['boss', '🐲 보스'], ['deco', '🎨 꾸미기']];
U.townFns = { boss: townBoss, deco: townDeco };
U.sigX = function () {
  const s = this.g.s;
  this.g.wbRegen();
  return [s.ammoOn, s.tomes, s.kfx, s.kfxOn, (s.whistle || 0) > 0, s.wb?.tk, s.cele, s.sbWins, this.g.ammoId()];
};
U.ammoCard = function (p) {
  return; // 탄약 없음
  // eslint-disable-next-line no-unreachable
  const g = this.g, s = g.s, st = g.style();
  if (st === 'melee') return;
  const pre = st === 'ranged' ? 'arrow' : 'rune';
  const cur = ITEMS[g.ammoId()];
  const stock = TIERS.map((T, t) => pre + t).filter((id) => g.have(id) > 0).map((id) => `${ITEMS[id].name} ${fmt(g.have(id))}`).join(' · ');
  const c = h('div', 'card', `<b>${st === 'ranged' ? '➶ 화살' : '🔹 룬'}</b> <label class="tg" style="display:inline-flex;margin-left:8px"><input type="checkbox" class="ao"${s.ammoOn ? ' checked' : ''}> 사용</label>
    <div>${cur ? `사용 중: <b>${cur.name}</b> (${STATS[Object.keys(cur.st)[0]].name} +${Object.values(cur.st)[0]}) · 공격마다 1개` : '<span class="mut">사용 중인 탄약 없음</span>'}</div>
    <div class="mut">${stock || '보유 없음'} · ${st === 'ranged' ? '공예에서 화살 제작' : '마법 공예에서 룬 제작'}</div>`);
  c.querySelector('.ao').addEventListener('change', (e) => { s.ammoOn = e.target.checked; g.dirty(); });
  p.appendChild(c);
};
U.actHtmlX = function (A) {
  const f = this.g.s.fight;
  if (A.type === 'sboss' && f) {
    const B = SBOSS.find((x) => x.skill === f.skill);
    return `<div class="skillact"><div class="ic">${B.icon}</div><div class="grow"><b>${B.n} <span class="mut">${TIERS[f.t].n} · ${SKILL[f.skill].icon}${SKILL[f.skill].name}</span></b><div class="bar mon xb"><div></div><span></span></div><div class="actinfo"><span class="info"></span></div></div><button class="btn sm" id="stopBtn">■ 포기</button></div><div class="floats"></div>`;
  }
  if (A.type === 'wboss' && f) {
    return `<div class="skillact"><div class="ic">🐋</div><div class="grow"><b>별을 삼키는 고래 <span class="mut">Lv ${f.L} · ${STYLES[f.style].icon}</span></b><div class="bar hpP xh"><div></div><span></span></div><div class="actinfo"><span class="info"></span></div></div><button class="btn sm" id="stopBtn">■ 그만</button></div><div class="floats"></div>`;
  }
  if (A.type === 'sboss' || A.type === 'wboss') return '<div class="idle">보스전 정리 중…</div>';
  return null;
};
U.frameX = function (act, A) {
  const g = this.g, s = g.s, rt = g.rt, f = s.fight;
  if (A?.type === 'sboss' && f?.kind === 'sb') {
    const b = act.querySelector('.xb');
    if (b) { b.firstElementChild.style.width = pct(f.hp / f.max); b.lastElementChild.textContent = `${fmt(f.hp)} / ${fmt(f.max)}`; }
    const d = g.sbDmg(f.skill);
    const i = act.querySelector('.info');
    if (i) i.textContent = `남은 시간 ${Math.max(0, f.time).toFixed(0)}초 · 피해 ${d.lo}~${d.hi} / ${SB_HIT}초`;
  } else if (A?.type === 'wboss' && f?.kind === 'wb') {
    const b = act.querySelector('.xh');
    const mx = g.maxHp();
    if (b) { b.firstElementChild.style.width = pct(Math.max(0, rt.hp) / mx); b.lastElementChild.textContent = `내 체력 ${fmt(Math.max(0, rt.hp))} / ${fmt(mx)}`; }
    const i = act.querySelector('.info');
    if (i) i.textContent = `남은 시간 ${Math.max(0, f.time).toFixed(0)}초 · 넣은 피해 ${fmt(f.dmg)}`;
  }
  if (A?.type === 'sboss' || A?.type === 'wboss') {
    const fl = act.querySelector('.floats');
    if (fl) {
      act._fl ||= new Set();
      for (const x of rt.fx) {
        if (act._fl.has(x)) continue;
        act._fl.add(x);
        const e = h('div', 'fl ' + x.kind, x.text);
        e.style.left = `calc(${x.at === 'hero' ? 20 : 80}% + ${x.x}px)`;
        fl.appendChild(e);
        setTimeout(() => e.remove(), 1000);
      }
    }
  }
  if (rt.cele && !this.popOk('cele')) rt.cele = null;
  if (rt.cele) {
    const c = h('div', 'cele', rt.cele.text);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1900);
    rt.cele = null;
  }
  if (rt.popup && !this.popOk('modal')) rt.popup = null;
  if (rt.popup && document.getElementById('modal')?.classList.contains('hidden')) {
    const pp = rt.popup;
    rt.popup = null;
    this.modal(pp.title, pp.html, [{ label: '확인', pri: true }]);
  }
};

function townBoss(ui, p, g, s) {
  g.wbRegen();
  const w = s.wb;
  const L = g.wbLevel(), st = wbStyle(), m = wbMonster(L, st);
  const v = g.vs({ ...m, hp: 1e9 });
  const inWb = s.activity?.type === 'wboss';
  const c = h('div', 'card', `<b>🐋 세계 보스: 별을 삼키는 고래</b> <span class="mut">Lv ${L} (내 전투 레벨 + 5) · 오늘의 방식 ${STYLES[st].icon}${STYLES[st].name} · 약점 ${STYLES[m.weak].icon}</span>
    <div>체력 무한 · ${WB_TIME}초 동안 넣은 피해만큼 보상 · 쓰러지면 그때까지 보상</div>
    <div class="mut">예상 피해 ${fmt(v.dps * WB_TIME)} 안팎 · 적 명중 ${pct(v.mHit)} · 최대 ${v.mMax}</div>
    <div>🎟 도전권 <b>${w.tk} / ${WB_MAX}</b>${w.tk < WB_MAX ? ` · 다음 1장까지 ${mmss(g.wbNext())}` : ''} · 최고 피해 ${fmt(w.best || 0)} · 도전 ${fmt(w.runs || 0)}회</div>
    <div class="mut">보상: 💰 · 약초 · 보석 · 상자 · 기여도(같은 레벨 일반 몬스터 몇 마리 분량) 5+ 장비 (10+ 희귀 · 20+ 영웅 · 40+ 전설 이상) · 12+ 기도서 1% · 🐋 아기 별고래 펫</div>
    <button class="btn pri wbgo"${w.tk < 1 || inWb ? ' disabled' : ''} style="margin-top:6px">${inWb ? '싸우는 중…' : '⚔ 도전 (도전권 1장)'}</button>`);
  c.querySelector('.wbgo').addEventListener('click', () => g.startWB());
  p.appendChild(c);

  p.appendChild(h('div', 'h', '🌿 스킬 보스'));
  p.appendChild(h('div', 'card mut', `마법 공예로 만든 소환석으로 도전 · 스킬 레벨과 채집 속도(도구 · 물약 · 기도 · 펫)만큼 피해 · ${SB_TIME}초 안에 쓰러뜨리면 큰 경험치 · 상자 · 전용 펫(1/40)`));
  for (const B of SBOSS) {
    const pet = PETS.find((x) => x.src === 'sboss:' + B.skill);
    const d = g.sbDmg(B.skill);
    const owned = pet && s.pets.includes(pet.id);
    const btns = TIERS.map((T, t) => {
      if (g.lvl(B.skill) < T.lvl) return '';
      const n = g.have('sstone' + t);
      return `<button class="btn sm ${n ? 'pri' : ''} sb" data-t="${t}"${n ? '' : ' disabled'}>${T.n} (체력 ${fmt(sbHp(t))} · 소환석 ${n})</button>`;
    }).join(' ');
    const r = h('div', 'card', `<b>${B.icon} ${B.n}</b> <span class="mut">${SKILL[B.skill].icon}${SKILL[B.skill].name} Lv ${g.lvl(B.skill)} · 내 피해 ${d.lo}~${d.hi} / ${SB_HIT}초 · 격파 ${fmt(s.sbWins?.[B.skill] || 0)}</span>
      <div class="mut">펫 ${pet.icon} ${pet.name}${owned ? ' ✅' : ''}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${btns}</div>`);
    r.querySelectorAll('.sb').forEach((b) => b.addEventListener('click', () => g.startSB(B.skill, +b.dataset.t)));
    p.appendChild(r);
  }

  p.appendChild(h('div', 'h', '✨ 희귀한 것들'));
  const wl = s.whistle > 0 ? `사용 중 · 남은 ${mmss(s.whistle)} (게임 시간)` : `보유 ${fmt(g.have('whistle'))}개 · 가방에서 사용`;
  p.appendChild(h('div', 'card', `📯 <b>펫 호루라기</b> — 보스 펫 확률 +${pct(WHISTLE_PET, 0)} · ${WHISTLE_SEC / 60}분 · ${wl}<div class="mut">마법 공예 Lv 30에서 제작</div>`));
  p.appendChild(h('div', 'card', `🌟 <b>초희귀 드롭</b> — 보스를 잡으면 ${pct(ULTRA_GEAR, 1)} 확률로 전설 이상 장비 · ${pct(ULTRA_TOME, 1)} 확률로 기도서 (드롭률 보너스 적용) · 지금까지 ${fmt(s.log.ultra || 0)}번
    <div class="mut">${TOMES.map((tm) => { const pr = PRAYERS.find((x) => x.id === tm.pr); return `📕 ${tm.n}: ${pr.icon}${pr.name} (신성 ${pr.lvl}) ${s.tomes.includes(pr.id) ? '✅' : `— 지역 ${tm.z + 1}+ 보스`}`; }).join('<br>')}</div>`));
}

function townDeco(ui, p, g, s) {
  const c = h('div', 'card', `<label class="tg"><input type="checkbox" class="ce"${s.cele !== false ? ' checked' : ''}> 🌟 초희귀 드롭 · 스킬 보스 격파 축하 화면 <span class="mut">(지역 보스는 표시 안 함)</span></label>`);
  c.querySelector('.ce').addEventListener('change', (e) => { s.cele = e.target.checked; });
  p.appendChild(c);
  p.appendChild(h('div', 'h', '💥 처치 효과 (몬스터를 잡을 때 떠오름 · 꾸미기 전용)'));
  for (const k of KFX) {
    const own = s.kfx.includes(k.id), on = s.kfxOn === k.id;
    const r = h('div', 'row' + (on ? ' on' : ''), `<div class="ic">${k.e || '—'}</div><div class="info"><div class="nm">${k.n}</div><div class="mut">${own ? '보유' : `💰 ${fmt(k.price)}`}</div></div>
      <button class="btn sm ${on ? '' : 'pri'}"${!own && s.coins < k.price ? ' disabled' : ''}>${on ? '사용 중' : own ? '사용' : '구매'}</button>`);
    r.querySelector('button').addEventListener('click', () => { if (own) s.kfxOn = k.id; else g.buyKfx(k.id); });
    p.appendChild(r);
  }
}

// ====================== v0.5: 조합 · 자동 판매 · 방식별 장비 · 함께 사냥 · 자동 의뢰 ======================
import { SLOT_IDS, MONSTER } from './data.js';
import { QUESTS } from './town.js';

// 장착 비교 결과 기억 (같은 상태에서 다시 계산하지 않아 렉 감소)
P.stateKey = function () {
  const s = this.s;
  return JSON.stringify([s.equip, s.pets.length, this.lvl('div'), Object.keys(s.effects || {}), ['atk', 'str', 'def', 'rng', 'mag'].map((k) => this.lvl(k)), this.ammoId(), s.tomes?.length, Object.keys(s.museum || {}).length, s.talents]);
};
const _ed = P.equipDelta;
P.equipDelta = function (id) {
  const k = this.stateKey();
  if (this._edKey !== k) { this._edKey = k; this._ed = new Map(); }
  if (!this._ed.has(id)) this._ed.set(id, _ed.call(this, id));
  return this._ed.get(id);
};

// 같은 장비(같은 단계 · 같은 등급) 3개 + 골드 → 한 등급 위. 비용 = 결과 장비 가치의 60%
export const COMBINE_N = 3;
P.combineCost = function (id) { const it = ITEMS[id]; return it.r >= 8 ? Infinity : Math.round(ITEMS[gearId(it.base, it.r + 1)].value * 0.6); };
P.combinable = function () { return Object.keys(this.s.bank).filter((id) => ITEMS[id]?.kind === 'gear' && ITEMS[id].r < 8 && this.have(id) >= COMBINE_N); };
P.combineAll = function () {
  let made = 0, spent = 0, short = false;
  const out = new Set();
  for (let r = 1; r < 8; r++) {
    for (const id of Object.keys(this.s.bank)) {
      const it = ITEMS[id];
      if (it?.kind !== 'gear' || it.r !== r) continue;
      const nid = gearId(it.base, r + 1), c = this.combineCost(id);
      while (this.have(id) >= COMBINE_N) {
        if (this.s.coins < c) { short = true; break; }
        this.s.coins -= c; spent += c;
        this.give(id, -COMBINE_N); this.give(nid, 1);
        this.s.log.gear[nid] = (this.s.log.gear[nid] || 0) + 1;
        out.add(nid); made++;
      }
    }
  }
  for (const id of out) if (this.have(id) > 0) this.autoEquipCheck(id);
  this.toast(made ? `⚒️ 조합 ${fmt(made)}번 · 💰 -${fmt(spent)}${short ? ' (골드 부족으로 일부만)' : ''}` : short ? '골드가 부족합니다' : '조합할 장비가 없습니다 (같은 장비 3개 필요)', made ? 'loot' : 'bad');
  return { made, spent };
};
// 유물(최고 등급)까지 올려도 지금 낀 장비보다 약하면 판매. 다른 전투 방식 장비 · 빈 칸 장비는 남김
const STYLE_REQ = { melee: ['atk', 'str', 'def'], ranged: ['rng', 'def'], magic: ['mag', 'def'] };
P.uselessGear = function () {
  const st = this.style(), list = [];
  for (const id of Object.keys(this.s.bank)) {
    const it = ITEMS[id];
    if (it?.kind !== 'gear' || !this.s.equip[it.slot]) continue;
    if (it.slot === 'weapon' ? it.style !== st : !STYLE_REQ[st].includes(it.req[0])) continue;
    if (this.equipDelta(gearId(it.base, 8)) <= 0) list.push(id);
  }
  return list;
};
P.sellUseless = function () {
  let n = 0, coins = 0;
  for (const id of this.uselessGear()) { n += this.have(id); coins += this.sell(id, this.have(id)); }
  this.toast(n ? `💰 약한 장비 ${fmt(n)}개 판매 · +${fmt(coins)}` : '팔 장비가 없습니다', n ? 'loot' : 'bad');
  return { n, coins };
};

// 전투 방식별 가장 강한 장비 조합 (전투력 기준)
P.bestLoadout = function (style) {
  const s = this.s, eq0 = { ...s.equip };
  const pool = {};
  for (const id of new Set([...Object.keys(s.bank), ...Object.values(eq0)])) {
    const it = ITEMS[id];
    if (it?.kind === 'gear' && this.canEquip(id)) (pool[it.slot] ||= []).push(id);
  }
  const weapons = (pool.weapon || []).filter((id) => ITEMS[id].style === style);
  if (!weapons.length) return null;
  const ev = (eq) => { s.equip = eq; this.dirty(); return this.powerRaw(); };
  const eq = { ...eq0 };
  let bw = null, bp = -1;
  try {
    for (const w of weapons) { const e = { ...eq, weapon: w }; const pw = ev(e); if (pw > bp) { bp = pw; bw = w; } }
    eq.weapon = bw;
    for (const sl of SLOT_IDS) {
      if (sl === 'weapon') continue;
      let cur = ev(eq), pk = eq[sl];
      for (const id of pool[sl] || []) { const pw = ev({ ...eq, [sl]: id }); if (pw > cur) { cur = pw; pk = id; } }
      if (pk) eq[sl] = pk;
    }
    return { eq, power: ev(eq) };
  } finally { s.equip = eq0; this.dirty(); }
};
P.loadoutPowers = function () {
  // 화면 그리는 중 연달아 부르면 (가방이 그대로이니) 방금 결과를 바로 사용
  const now = performance.now();
  if (this._lo && !this._inUpd && now - (this._loT || 0) < 50) return this._lo;
  this._loT = now;
  const k = this.stateKey();
  // 레벨만 오른 경우 (낀 장비 그대로): 8초 안에는 방금 결과를 그대로 (빠른 배속에서 레벨업마다 다시 계산하지 않게)
  const eqk = JSON.stringify(this.s.equip);
  if (this._lo && this._loKey !== k && this._loEq === eqk && now - (this._loFull || 0) < 8000) return this._lo;
  this._loEq = eqk;
  const ids = Object.keys(this.s.bank).filter((id) => ITEMS[id]?.kind === 'gear');
  // 렉 줄이기: 새로 들어온 장비가 모두 확실히 약하고, 최적 장비가 가방에서 빠지지 않았으면 그대로 사용
  if (this._loKey === k && this._loIds && now - (this._loFull || 0) < 60000) { // 1분마다 한 번은 전부 다시 계산
    const set = new Set(ids);
    const used = new Set(Object.values(this._lo).flatMap((L) => (L ? Object.values(L.eq) : [])));
    let ok = true;
    for (const id of this._loIds) if (!set.has(id) && used.has(id)) { ok = false; break; }
    if (ok) for (const id of ids) if (!this._loIds.has(id) && !this.loWeak(id)) { ok = false; break; }
    if (ok) { this._loIds = set; return this._lo; }
  }
  this._lo = Object.fromEntries(['melee', 'ranged', 'magic'].map((st) => [st, this.bestLoadout(st)]));
  this._loKey = k;
  this._loIds = new Set(ids);
  this._loVer = (this._loVer || 0) + 1;
  this._loFull = now;
  return this._lo;
};
// 이 장비가 모든 방식의 지금 최적 장비보다 대략 점수가 낮은지 (낮으면 최적 장비 찾기를 다시 안 함)
P.loWeak = function (id) {
  const it = ITEMS[id];
  if (!this.canEquip(id)) return true;
  for (const st of ['melee', 'ranged', 'magic']) {
    if (it.slot === 'weapon' && it.style !== st) continue;
    const L = this._lo[st];
    if (!L) return false;
    const cur = ITEMS[L.eq[it.slot]];
    if (!cur || roughScore(it, st) >= roughScore(cur, st)) return false;
  }
  return true;
};
P.applyLoadout = function (style) {
  const L = this.bestLoadout(style);
  if (!L) { this.toast(`${STYLES[style].name} 무기가 없습니다`, 'bad'); return false; }
  if (L.eq.weapon !== this.s.equip.weapon) this.equip(L.eq.weapon);
  for (const sl of SLOT_IDS) if (sl !== 'weapon' && L.eq[sl] && L.eq[sl] !== this.s.equip[sl]) this.equip(L.eq[sl]);
  this.toast(`${STYLES[style].icon} ${STYLES[style].name} 장비로 교체 · 전투력 ${fmt(this.power())}`, 'loot');
  return true;
};

// 스킬 · 뼈 묻기 중에도 마지막으로 싸운 몬스터와 계속 사냥
const _sc = P.startCombat;
P.startCombat = function (monId) { const r = _sc.call(this, monId); if (r) this.s.huntMon = monId; return r; };
P.bgHunting = function () {
  const A = this.s.activity;
  return (A?.type === 'skill' || A?.type === 'bury') && this.s.bgHunt !== false && !!MONSTER[this.s.huntMon];
};
const _upd2 = P.update;
P.update = function (dt) {
  _upd2.call(this, dt);
  if (this.bgHunting()) this.combatTick(dt);
  // 자동 의뢰 (게임 시간 2초마다)
  this.rt.aqT = (this.rt.aqT || 0) + dt;
  if (this.rt.aqT >= 2) { this.rt.aqT = 0; if (this.s.autoQuest !== false) this.autoQuest(); }
};
P.autoQuest = function () {
  const Q = this.s.quests;
  if (!Q) return;
  for (const id of Object.keys(Q.active)) this.claimQuest(id);
  const open = Object.keys(Q.active).length;
  if (open >= 3) return;
  const mon = this.s.hunt || this.s.huntMon;
  const cand = QUESTS.filter((q) => Q.active[q.id] == null && !Q.done.includes(q.id) && this.questOpen(q));
  // 지금 잡는 몬스터 → 전투 레벨 → 나머지 토벌 → 납품 순서
  const score = (q) => (q.target === mon ? 0 : q.type === 'clvl' ? 1 : q.type === 'kill' ? 2 : 3);
  cand.sort((a, b) => score(a) - score(b));
  for (const q of cand.slice(0, 3 - open)) this.acceptQuest(q.id);
};
const _ti2 = P.townInit;
P.townInit = function () {
  _ti2.call(this);
  if (this.s.bgHunt == null) this.s.bgHunt = true;
  if (this.s.autoQuest == null) this.s.autoQuest = true;
};

// ---------- 화면 ----------
U.styleCard = function (p) {
  const g = this.g, cur = g.style(), lo = g.loadoutPowers();
  const c = h('div', 'seg');
  for (const st of ['melee', 'ranged', 'magic']) {
    const L = lo[st];
    const b = h('button', st === cur ? 'on' : '', `${STYLES[st].icon} ${STYLES[st].name}<br><small>${L ? `전투력 ${fmt(L.power)}` : '무기 없음'}</small>`);
    if (!L) b.disabled = true;
    b.addEventListener('click', () => g.applyLoadout(st));
    c.appendChild(b);
  }
  p.appendChild(c);
};
U.gearToolsCard = function (p) {
  const g = this.g;
  const cb = g.combinable();
  const cost = cb.reduce((a, id) => a + g.combineCost(id) * Math.floor(g.have(id) / COMBINE_N), 0);
  const ul = g.uselessGear();
  const n = ul.reduce((a, id) => a + g.have(id), 0), val = ul.reduce((a, id) => a + (ITEMS[id].value || 0) * g.have(id), 0);
  const c = h('div', 'card', `<b>⚒️ 장비 정리</b>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn pri cmb"${cb.length ? '' : ' disabled'}>⚒️ 자동 조합 (${cb.length}종 · 💰${fmt(cost)}~)</button>
    <button class="btn sel"${n ? '' : ' disabled'}>💰 약한 장비 판매 (${fmt(n)}개 · +${fmt(val)})</button></div>
    <div class="mut">조합: 같은 장비 · 같은 등급 3개 + 골드 → 한 등급 위 (유물까지 이어서 조합) · 비용은 결과 장비 가치의 60%<br>판매: 유물까지 올려도 지금 낀 장비보다 전투력이 낮은 장비만 · 다른 전투 방식 장비와 빈 칸 장비는 남김</div>`);
  c.querySelector('.cmb').addEventListener('click', () => g.combineAll());
  c.querySelector('.sel').addEventListener('click', () => g.sellUseless());
  p.appendChild(c);
};
U.bgHuntCard = function (p) {
  const g = this.g, s = g.s, m = MONSTER[s.huntMon];
  const c = h('div', 'card', `<label class="tg"><input type="checkbox" class="bh"${s.bgHunt !== false ? ' checked' : ''}> ⚔ 스킬 수련 중에도 사냥 계속</label>
    <div class="mut">${m ? `${m.icon} ${m.name} (Lv ${m.lvl}) — 전투 탭에서 마지막으로 싸운 몬스터` : '전투 탭에서 몬스터와 한 번 싸우면 그 몬스터를 함께 사냥합니다'}</div>`);
  c.querySelector('.bh').addEventListener('change', (e) => { s.bgHunt = e.target.checked; });
  p.appendChild(c);
};
U.autoQuestCard = function (p) {
  const s = this.g.s;
  const c = h('div', 'card', `<label class="tg"><input type="checkbox" class="aq"${s.autoQuest !== false ? ' checked' : ''}> 🤖 의뢰 자동으로 받고 자동 완료</label><div class="mut">지금 잡는 몬스터 의뢰 → 전투 레벨 → 토벌 → 납품 순서로 받습니다</div>`);
  c.querySelector('.aq').addEventListener('change', (e) => { s.autoQuest = e.target.checked; });
  p.appendChild(c);
};
const _fx2 = U.frameX;
U.frameX = function (act, A) {
  _fx2.call(this, act, A);
  const g = this.g, rt = g.rt;
  if (!(A?.type === 'skill' || A?.type === 'bury')) return;
  let d = act.querySelector('.bgh');
  if (!d) { d = h('div', 'bgh mut'); (act.querySelector('.grow') || act).appendChild(d); this._bghT = 0; }
  if (this._bghT && performance.now() - this._bghT < 250) return;
  this._bghT = performance.now();
  if (!g.bgHunting()) { d.textContent = ''; d._l = null; return; }
  const m = MONSTER[g.s.huntMon], mx = g.maxHp();
  // 늘 2줄: 1줄 = 사냥 중인 몬스터 / 2줄 = 체력 · 처치 (숫자가 바뀌어도 줄 수 그대로)
  const l2 = `${rt.mon ? `적 ${fmt(rt.monHp)}/${fmt(m.hp)}` : rt.dead > 0 ? `부활까지 ${rt.dead.toFixed(0)}초` : '다음 몬스터'} · ❤ ${fmt(Math.max(0, rt.hp))}/${fmt(mx)} · 처치 ${fmt(g.s.kills?.[m.id] || 0)}`;
  if (!d._l) { d.innerHTML = '<div class="l1"></div><div class="l2"></div>'; d._l = [d.firstChild, d.lastChild]; }
  d._l[0].textContent = `⚔ 함께 사냥: ${m.icon} ${m.name}`;
  d._l[1].textContent = l2;
  this.noWrapSeg(d);
};
const _sig2 = U.sigX;
U.sigX = function () { const s = this.g.s; return [..._sig2.call(this), s.bgHunt, s.huntMon, s.autoQuest]; };

// 박물관 자동 기증: 지금 낀 장비보다 약하고 박물관 기록(등급)을 올려 주는 장비부터 기증
P.donatable = function () {
  const s = this.s, best = {};
  for (const id of Object.keys(s.bank)) {
    const it = ITEMS[id];
    if (it?.kind !== 'gear' || it.r <= (s.museum?.[it.base] || 0)) continue;
    if (best[it.base] && ITEMS[best[it.base]].r >= it.r) continue;
    best[it.base] = id;
  }
  return Object.values(best).filter((id) => this.s.equip[ITEMS[id].slot] && (ITEMS[id].slot !== 'weapon' || ITEMS[id].style === this.style()) && this.equipDelta(id) <= 0);
};
P.autoDonate = function () {
  let n = 0;
  for (const id of this.donatable()) if (this.donate(id)) n++;
  return n;
};
const _sell2 = P.sellUseless;
P.sellUseless = function () { if (this.s.autoDonate !== false) this.autoDonate(); return _sell2.call(this); };
const _upd3 = P.update;
P.update = function (dt) {
  _upd3.call(this, dt);
  this.rt.adT = (this.rt.adT || 0) + dt;
  if (this.rt.adT >= 10) { this.rt.adT = 0; if (this.s.autoDonate !== false && this.s.museum) this.autoDonate(); }
};
U.autoDonateCard = function (p) {
  const s = this.g.s;
  const c = h('div', 'card', `<label class="tg"><input type="checkbox" class="ad"${s.autoDonate !== false ? ' checked' : ''}> 🏛️ 자동 기증</label><div class="mut">지금 낀 장비보다 약하고 박물관 기록(등급)을 올려 주는 장비를 자동으로 기증합니다 · 약한 장비 판매 전에도 먼저 기증</div>`);
  c.querySelector('.ad').addEventListener('change', (e) => { s.autoDonate = e.target.checked; });
  p.appendChild(c);
};
const _sig3 = U.sigX;
U.sigX = function () { return [..._sig3.call(this), this.g.s.autoDonate]; };

// 줄바꿈 정리: ' · ' 로 나눈 짧은 항목은 한 줄로 묶어서 글자가 한두 개씩 다음 줄로 넘어가지 않게
U.noWrapSeg = function (root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.includes(' · ') && !n.parentElement?.closest('select, option, .nw') && !/flex|grid/.test(getComputedStyle(n.parentElement).display) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const list = [];
  while (w.nextNode()) list.push(w.currentNode);
  for (const n of list) {
    const parts = n.nodeValue.split(' · ');
    const fr = document.createDocumentFragment();
    parts.forEach((t, i) => {
      if (i) fr.append('\u00a0· ');
      if (t.trim() && t.length <= 26) { const sp = document.createElement('span'); sp.className = 'nw'; sp.textContent = t; fr.append(sp); } else fr.append(t);
    });
    n.replaceWith(fr);
  }
};

// ====================== 자동 조합 켜기 · 무작위 의뢰 30개 · 팝업 설정 ======================
import { ZONES } from './data.js';

// ---------- 팝업 설정: 종류별로 켜고 끔 ----------
export const POP_KINDS = [
  ['lvl', '⬆️ 레벨 업 · 목표 달성'], ['loot', '📦 아이템 · 장비 · 보석 획득'], ['pet', '🐾 펫 · 희귀 발견 · 의뢰 완료'],
  ['bad', '⚠️ 경고 (음식 없음 · 쓰러짐 · 재료 부족)'], ['info', '💬 일반 알림 (배속 · 저장 · 물약)'], ['cele', '🎉 축하 화면 (초희귀 · 스킬 보스)'], ['modal', '🪟 결과 창 (보스 결과 · 오프라인 진행)'],
];
U.popOk = function (kind) {
  const p = this.g.s.pop || {};
  if (p.all === false) return false;
  return p[kind || 'info'] !== false;
};
U.popCard = function (p) {
  const g = this.g, s = g.s;
  s.pop ||= {};
  const c = h('div', 'card', `<b>🔔 팝업 · 알림</b>
    <label class="tg"><input type="checkbox" data-k="all"${s.pop.all !== false ? ' checked' : ''}> <b>모든 팝업</b> (끄면 아래 전부 안 보임)</label>
    ${POP_KINDS.map(([k, n]) => `<label class="tg" style="margin-left:18px${s.pop.all === false ? ';opacity:.45' : ''}"><input type="checkbox" data-k="${k}"${s.pop[k] !== false ? ' checked' : ''}> ${n}</label>`).join('')}
    <label class="tg" style="margin-left:18px">📦 장비 드롭 알림 <select class="gt2">${[[1, '모두 보기'], [3, '희귀 이상만'], [4, '영웅 이상만'], [5, '전설 이상만'], [99, '끄기']].map(([v, n]) => `<option value="${v}"${(s.gearToast ?? 1) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`);
  c.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('change', (e) => { s.pop = { ...s.pop, [i.dataset.k]: e.target.checked }; }));
  c.querySelector('.gt2').addEventListener('change', (e) => { s.gearToast = +e.target.value; });
  p.appendChild(c);
};

// ---------- 자동 조합 (켜 두면 10초마다) ----------
const _upd4 = P.update;
P.update = function (dt) {
  _upd4.call(this, dt);
  if (this.s.autoCombine) {
    this.rt.acT = (this.rt.acT || 0) + dt;
    if (this.rt.acT >= 10) {
      this.rt.acT = 0;
      if (this.combinable().some((id) => this.s.coins >= this.combineCost(id))) this.combineAll();
    }
  }
};
const _gtc = U.gearToolsCard;
U.gearToolsCard = function (p) {
  _gtc.call(this, p);
  const s = this.g.s, c = p.lastElementChild;
  const l = h('label', 'tg', `<input type="checkbox"${s.autoCombine ? ' checked' : ''}> ⚒️ 자동 조합 켜기 (10초마다 · 골드가 있을 때만)`);
  l.querySelector('input').addEventListener('change', (e) => { s.autoCombine = e.target.checked; });
  c.insertBefore(l, c.children[1]);
};

// ---------- 의뢰: 항상 무작위 30개 · 조건을 채우면 자동 완료 → 새 의뢰 ----------
const RQ_N = 30;
const RQ_LIFE = 5 * 60 * 1000; // 실제 시간 5분 (배속과 상관없음) 안에 못 끝내면 새 의뢰로 교체
const QUEST_PETS = () => PETS.filter((x) => x.src === 'quest');
P.rqInit = function () {
  this.s.rq ||= { list: [], seq: 0, done: 0 };
  while (this.s.rq.list.length < RQ_N) this.s.rq.list.push(this.rqGen());
};
P.rqCount = function (q) { return q.type === 'kill' ? this.s.kills?.[q.target] || 0 : this.s.log.got?.[q.target] || 0; };
P.rqProg = function (q) { return Math.max(0, this.rqCount(q) - q.base); };
P.rqGen = function () {
  const cl = this.combatLevel();
  const reach = ZONES.filter((z) => z.lvl <= cl + 8);
  const pool = (reach.length ? reach : [ZONES[0]]).slice(-6); // 갈 수 있는 가장 높은 지역 6곳
  const z = pick(pool), t = z.t, r = Math.random();
  let q;
  if (r < 0.45) {
    const m = pick(z.mons.slice(0, 3)), qty = R(15, 40) * 10;
    q = { type: 'kill', target: m.id, qty, icon: m.icon, name: `${m.name} 토벌`, desc: `${m.name} ${fmt(qty)}마리 처치` };
  } else if (r < 0.65) {
    const m = z.mons[3], qty = R(5, 15);
    q = { type: 'kill', target: m.id, qty, icon: '👑', name: `${m.name} 사냥`, desc: `👑 ${m.name} ${qty}마리 처치` };
  } else {
    const id = pick(['log', 'ore', 'raw', 'food', 'bar', 'herb', 'hide', 'cloth']) + t, qty = R(20, 50) * 10;
    q = { type: 'got', target: id, qty, icon: ITEMS[id].icon, name: `${ITEMS[id].name} 납품`, desc: `${ITEMS[id].name} ${fmt(qty)}개 모으기` };
  }
  q.id = 'r' + ++this.s.rq.seq;
  q.base = this.rqCount(q);
  q.z = z.n;
  q.t = t;
  q.reward = this.rqReward(t);
  q.at = Date.now();
  return q;
};
// 보상: 💰 · 공훈 + (전설 이상 장비 / 의뢰 펫 / 기도서 / 귀한 묶음) 중 하나
P.rqReward = function (t) {
  const k = Math.random();
  const rw = { coins: Math.round(2000 * (t + 1) ** 2 * (0.8 + Math.random() * 0.4)), cp: 2 + Math.floor(t / 3) };
  if (k < 0.5) rw.gear = pick(Object.keys(GEAR)) + t;
  else if (k < 0.65) rw.pet = 0.25;
  else if (k < 0.75) rw.tome = true;
  else rw.items = { whistle: 1, ['sstone' + t]: 2, ['pot_luck' + t]: 5 };
  return rw;
};
P.rqRewardText = function (rw) {
  const x = rw.gear ? `🎁 ${ITEMS[rw.gear].icon} ${ITEMS[rw.gear].name} (전설 이상)` : rw.pet ? `🐾 의뢰 펫 ${pct(rw.pet, 0)} (못 얻으면 영웅 이상 장비)` : rw.tome ? '📕 기도서 (모두 배웠으면 호루라기 3개)'
    : '🎁 ' + Object.entries(rw.items).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} x${n}`).join(', ');
  return `💰${fmt(rw.coins)} · 공훈 +${rw.cp} · ${x}`;
};
P.rqClaim = function (q) {
  const s = this.s, rw = q.reward;
  s.coins += rw.coins;
  s.cpQuest = (s.cpQuest || 0) + rw.cp;
  let got = '';
  const gearOf = (base, min) => { const id = gearId(base, rollRarity(min)); this.give(id, 1); s.log.gear[id] = (s.log.gear[id] || 0) + 1; this.autoEquipCheck(id); return ITEMS[id].name; };
  if (rw.gear) got = gearOf(rw.gear, 5);
  else if (rw.pet) {
    const left = QUEST_PETS().filter((x) => !s.pets.includes(x.id));
    if (left.length && Math.random() < rw.pet) { const pt = pick(left); s.pets.push(pt.id); if (!s.pet) s.pet = pt.id; this.dirty(); got = `🐾 ${pt.icon} ${pt.name}!`; this.celebrate(`🐾 ${pt.name}`); }
    else if (!left.length && Math.random() < rw.pet && this.petUp?.(pick(QUEST_PETS()), true)) got = '🐾 의뢰 펫 레벨 업!';
    else got = gearOf(pick(Object.keys(GEAR)) + q.t, 4);
  } else if (rw.tome) {
    const left = TOMES.filter((tm) => !s.tomes.includes(tm.pr));
    if (left.length) { const tm = pick(left); this.give(tm.id, 1); got = `📕 ${tm.n}`; } else { this.give('whistle', 3); got = '📯 펫 호루라기 x3'; }
  } else { for (const [id, n] of Object.entries(rw.items)) this.give(id, n); got = Object.entries(rw.items).map(([id, n]) => `${ITEMS[id].icon}${n}`).join(' '); }
  s.rq.done++;
  this.toast(`📜 의뢰 완료! ${q.name} · 💰${fmt(rw.coins)} · ${got}`, 'pet');
};
P.rqTick = function () {
  this.rqInit();
  const L = this.s.rq.list;
  const now = Date.now();
  for (let i = 0; i < L.length; i++) {
    if (this.rqProg(L[i]) >= L[i].qty) { this.rqClaim(L[i]); L[i] = this.rqGen(); continue; }
    L[i].at ||= now;
    if (now - L[i].at >= RQ_LIFE) { L[i] = this.rqGen(); this.s.rq.expired = (this.s.rq.expired || 0) + 1; }
  }
};
// 예전 의뢰(받기 · 완료) 대신 새 방식으로
P.autoQuest = function () { this.rqTick(); };
const _ti3 = P.townInit;
P.townInit = function () { _ti3.call(this); this.s.autoQuest = true; this.rqInit(); };

U.townFns = { ...U.townFns, quest: townRq };
function townRq(ui, p, g, s) {
  g.rqInit();
  p.appendChild(h('div', 'card', `<b>📜 의뢰판</b> <span class="mut">완료 ${fmt(s.rq.done)}개</span>
    <div class="mut">의뢰 ${RQ_N}개가 항상 붙어 있고, 조건을 채우면 저절로 완료되고 새 의뢰가 붙습니다 · 실제 시간 5분(배속과 상관없음) 안에 못 끝낸 의뢰는 새 의뢰로 바뀝니다 · 내 전투 레벨로 갈 수 있는 높은 지역에서 나옵니다 · 보상: 💰 · 공훈(재능) · 전설 이상 장비 / 의뢰 전용 펫 / 기도서 / 귀한 묶음</div>`));
  const rows = s.rq.list.map((q) => ({ q, r: Math.min(1, g.rqProg(q) / q.qty) })).sort((a, b) => b.r - a.r);
  for (const { q, r } of rows) {
    const pr = Math.min(q.qty, g.rqProg(q));
    p.appendChild(h('div', 'row', `<div class="ic">${q.icon}</div><div class="info"><div class="nm">${q.name} <span class="mut">${q.z}</span></div>
      <div class="mut">${q.desc} · ${fmt(pr)} / ${fmt(q.qty)} (${pct(r, 0)}) · <span class="rqt" data-at="${q.at || Date.now()}">⏳ ${mmss(Math.max(0, RQ_LIFE - (Date.now() - (q.at || Date.now()))) / 1000)}</span></div><div class="lvbar"><div style="width:${pct(r)}"></div></div>
      <div class="mut sp">${g.rqRewardText(q.reward)}</div></div>`));
  }
}
const _sig4 = U.sigX;
U.sigX = function () { const s = this.g.s; return [..._sig4.call(this), s.rq?.done, s.rq?.expired, s.autoCombine, s.pop]; };

// ---------- 전리품 검색: 아이템 이름으로 떨어뜨리는 몬스터 찾기 ----------
let LOOT_IDX = null;
const lootIdx = () => LOOT_IDX ||= ZONES.flatMap((z, zi) => z.mons.flatMap((m) => m.loot.map((l) => ({ it: ITEMS[l.id], l, m, z, zi })))).filter((x) => x.it);
U.lootSearch = function (p) {
  const g = this.g;
  const c = h('div', 'card', `<input type="search" class="lsq" placeholder="🔎 전리품 검색 (예: 루비, 검, 약초)" value="${(this.lq || '').replace(/"/g, '')}" style="width:100%;box-sizing:border-box"><div class="lsr"></div>`);
  const box = c.querySelector('.lsr');
  const show = () => {
    const q = (this.lq || '').trim();
    if (!q) { box.innerHTML = ''; return; }
    const mul = g.dropMult();
    const res = lootIdx().filter((x) => x.it.name.includes(q)).sort((a, b) => a.m.lvl - b.m.lvl);
    box.innerHTML = res.length ? res.slice(0, 40).map((x, i) => {
      const pr = x.l.fixed ? 1 : Math.min(1, x.l.p * mul);
      return `<div class="lr ls" data-i="${i}"><span class="li">${x.it.icon}</span><span class="ln">${x.it.name} <span class="mut">← ${x.m.boss ? '👑' : ''}${x.m.name} Lv ${x.m.lvl} · ${x.z.n}</span></span><span class="lp${pr >= 1 ? ' all' : ''}">${pr >= 1 ? '항상' : pct(pr, pr < 0.01 ? 2 : 1)}</span></div>`;
    }).join('') + (res.length > 40 ? `<div class="mut">${res.length - 40}개 더 있음 · 더 자세히 검색해 보세요</div>` : '') : '<div class="mut">떨어뜨리는 몬스터가 없습니다</div>';
    box.querySelectorAll('.ls').forEach((r) => r.addEventListener('click', () => { const x = res[+r.dataset.i]; document.activeElement?.blur(); this.zone = x.zi; }));
  };
  c.querySelector('.lsq').addEventListener('input', (e) => { this.lq = e.target.value; show(); });
  show();
  p.appendChild(c);
};

// ====================== 뒤로가기 · 만지는 중 다시 그리기 멈춤 · 탭별 장면 · 처치 전리품 팝업 끄기 ======================
// 뒤로가기: 열린 창 닫기 → 전투 탭으로 (앱은 꺼지지 않음)
window.onAppBack = () => {
  const ui = window.ui;
  const m = document.getElementById('modal');
  if (m && !m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  if (document.activeElement?.blur) document.activeElement.blur();
  if (ui && ui.tab !== 'combat') { ui.tab = 'combat'; return; }
  ui?.g?.toast('나가려면 홈 버튼을 눌러 주세요 (게임은 계속 진행)');
};
// 예전 앱(이전 APK)용: 뒤로가기가 웹 기록을 먼저 되돌리도록 기록을 하나 쌓아 둠
try {
  history.pushState({ sf: 1 }, '');
  window.addEventListener('popstate', () => { history.pushState({ sf: 1 }, ''); window.onAppBack(); });
} catch (e) { /* 무시 */ }

// 함께 사냥 중: 전투 탭에서는 전투 장면, 다른 탭에서는 스킬 장면
U.dispAct = function () {
  const g = this.g, A = g.s.activity;
  if (this.tab === 'combat' && g.bgHunting && g.bgHunting()) return { type: 'combat', mon: g.s.huntMon, bg: true };
  return A;
};
// 손가락으로 스크롤 · 끌기 중이면 0.8초 동안 화면을 다시 그리지 않음 (지역 칩이 옆으로 안 넘어가던 문제)
U.panelBusy = function () {
  if (this._busyHooked) return;
  const p = document.getElementById('panel');
  if (!p) return;
  this._busyHooked = true;
  const busy = () => { this._busy = performance.now() + 800; };
  for (const ev of ['touchmove', 'wheel']) p.addEventListener(ev, busy, { passive: true });
  p.addEventListener('scroll', busy, { passive: true, capture: true });
  p.addEventListener('touchstart', () => { this._busy = performance.now() + 400; }, { passive: true });
};
// 다시 그려도 가로 · 안쪽 스크롤 위치 그대로
U.saveScroll = function () {
  const p = document.getElementById('panel');
  return [...p.querySelectorAll('.tstrip, .lsr, .ltbl')].map((e) => [e.className, e.scrollLeft, e.scrollTop, e.closest('.zpick') ? this.zone : null]);
};
U.loadScroll = function (keep) {
  const p = document.getElementById('panel');
  const els = [...p.querySelectorAll('.tstrip, .lsr, .ltbl')];
  for (const [cls, l, t, z] of keep) {
    const e = els.find((x) => x.className === cls);
    if (!e) continue;
    // 단계 칩: 같은 단계를 보고 있을 때만 위치 유지 (단계를 바꾸면 가운데로)
    if (cls === 'tstrip' && z != null && (window.__ZT?.(z) !== window.__ZT?.(this.zone))) continue;
    e.scrollLeft = l; e.scrollTop = t;
  }
};
window.__ZT = (i) => ZONES[i]?.t;

// 몬스터를 잡을 때 나오는 전리품 팝업 끄기 (펫 · 초희귀 같은 특별 알림은 그대로)
const _toastK = P.toast;
P.toast = function (text, kind = '') { if (this._inKill && (kind === 'loot' || /^(📦|💎|🔄)/u.test(text))) return; return _toastK.call(this, text, kind); };
const _killK = P.kill;
P.kill = function (m) { this._inKill = true; try { return _killK.call(this, m); } finally { this._inKill = false; } };

// 의뢰 남은 시간: 1초마다 숫자만 바꿈
const _fx5 = U.frameX;
U.frameX = function (act, A) {
  _fx5.call(this, act, A);
  if (this.tab !== 'town' || performance.now() - (this._rqtT || 0) < 1000) return;
  this._rqtT = performance.now();
  const now = Date.now();
  document.querySelectorAll('.rqt').forEach((e) => { e.textContent = `⏳ ${mmss(Math.max(0, RQ_LIFE - (now - +e.dataset.at)) / 1000)}`; });
};

// 의뢰가 걸린 몬스터 · 행동 · 지역에 📜 표시
U.qMark = function (ids, small = false) {
  const L = this.g.s.rq?.list;
  if (!L) return '';
  const key = L.map((q) => q.id).join(',');
  if (this._qmKey !== key) { this._qmKey = key; this._qm = {}; for (const q of L) this._qm[q.target] = (this._qm[q.target] || 0) + 1; }
  const n = ids.reduce((a, id) => a + (this._qm[id] || 0), 0);
  return n ? `<span class="qm" title="의뢰 ${n}개">${small ? '📜' : `📜${n > 1 ? n : ''}`}</span>` : '';
};

// ====================== 스킬 도구: 종류마다 1개 · 21단계 업그레이드 ======================
P.toolTier = function (sk) { const it = ITEMS[this.s.tools?.[sk]]; return it ? it.t : -1; };
// 예전 저장: 가방에 있던 도구는 가장 좋은 것 하나로 합치고 나머지는 팔아서 골드로
const _townInitT = P.townInit;
P.townInit = function () {
  _townInitT.call(this);
  const s = this.s;
  if (s.toolsV === 2) return;
  let refund = 0;
  for (const [id, n] of Object.entries(s.bank)) {
    const it = ITEMS[id];
    if (it?.kind !== 'tool') continue;
    const cur = ITEMS[s.tools?.[it.skill]];
    if (!cur || it.t > cur.t) { if (cur) refund += cur.value; s.tools = { ...s.tools, [it.skill]: id }; refund += it.value * (n - 1); }
    else refund += it.value * n;
    delete s.bank[id];
  }
  if (refund) s.coins += refund;
  s.toolsV = 2;
};
P.toolNext = function (sk) {
  const t = this.toolTier(sk) + 1;
  if (t >= TIERS.length) return null;
  const c = toolCost(sk, t);
  const lvOk = this.lvl(sk) >= TIERS[t].lvl;
  const matOk = Object.entries(c.mat).every(([id, n]) => this.have(id) >= n);
  return { t, ...c, lvOk, matOk, coinOk: this.s.coins >= c.coins, ok: lvOk && matOk && this.s.coins >= c.coins };
};
P.upgradeTool = function (sk) {
  const nx = this.toolNext(sk);
  if (!nx?.ok) return false;
  for (const [id, n] of Object.entries(nx.mat)) this.give(id, -n);
  this.s.coins -= nx.coins;
  this.s.tools = { ...this.s.tools, [sk]: `tool_${sk}${nx.t}` };
  this.dirty?.();
  this.toast(`🛠️ ${ITEMS[`tool_${sk}${nx.t}`].name} (${nx.t + 1}단계)로 업그레이드!`, 'info');
  return true;
};
// 가방에서 장착 · 해제는 이제 쓰지 않음
P.unequipTool = function () {};
P.bestTool = function () { return null; };
U.toolShop = function (p) {
  const g = this.g, s = g.s;
  p.appendChild(h('div', 'h', '🛠️ 도구 제작'));
  p.appendChild(h('div', 'card mut', `도구는 종류마다 1개만 가지고, 재료와 골드로 한 단계씩 올립니다 (1~${TIERS.length}단계). 단계가 오를수록 그 스킬의 속도(채집 · 제작 · 요리 · 연금 · 뼈 묻기 · 도둑질)가 빨라집니다. 해당 스킬 레벨이 단계 레벨 이상이어야 합니다.`));
  for (const [sk, T0] of Object.entries(TOOLS)) {
    const cur = ITEMS[s.tools?.[sk]], t = g.toolTier(sk), nx = g.toolNext(sk);
    const FX = T0.fx;
    const dots = TIERS.map((T, i) => `<i style="background:${i <= t ? T.c : 'var(--line)'}"></i>`).join('');
    let body;
    if (!nx) body = '<div class="mut">최고 단계에 도달했습니다 ✨</div>';
    else {
      const need = Object.entries(nx.mat).map(([id, n]) => `<span style="color:${g.have(id) >= n ? 'var(--good)' : '#f87171'}">${ITEMS[id].icon}${ITEMS[id].name} ${fmt(g.have(id))}/${fmt(n)}</span>`).join(' · ');
      body = `<div>다음: <b style="color:${TIERS[nx.t].c}">${TIERS[nx.t].n} ${T0.n}</b> <span class="mut">(${nx.t + 1}단계 · ${FX} +${pct(ITEMS[`tool_${sk}${nx.t}`].gspd)})</span></div>
        <div class="mut">필요: <span style="color:${nx.lvOk ? 'var(--good)' : '#f87171'}">${SKILL[sk].icon}${SKILL[sk].name} Lv ${TIERS[nx.t].lvl}</span> · ${need} · <span style="color:${nx.coinOk ? 'var(--good)' : '#f87171'}">🪙 ${fmt(nx.coins)}</span></div>
        <button class="btn sm ${nx.ok ? 'pri' : ''} tup"${nx.ok ? '' : ' disabled'}>⬆️ 업그레이드</button>`;
    }
    const c = h('div', 'card tshop', `<b>${T0.icon} ${cur ? cur.name : T0.n + ' (없음)'}</b> <span class="mut">${t + 1} / ${TIERS.length}단계${cur ? ` · ${FX} +${pct(cur.gspd)}` : ''}</span>
      <div class="tdots">${dots}</div>${body}`);
    c.querySelector('.tup')?.addEventListener('click', () => g.upgradeTool(sk));
    p.appendChild(c);
  }
};
const _sigT = U.sigX;
U.sigX = function () { return [..._sigT.call(this), this.g.s.tools, this.skillSel === 'tools' ? this.g.s.coins : 0]; };

// ====================== 자동 장착: 가방 전체에서 더 강한 조합을 주기적으로 찾아 장착 ======================
// (드롭 때만 비교하던 방식은 조합 · 의뢰 · 레벨업으로 생긴 더 좋은 장비를 놓쳤음)
P.autoBest = function () {
  const s = this.s;
  if (!s.autoEquip || s.fight) return;
  const st = this.style();
  const L = this.loadoutPowers()[st];
  if (!L) return;
  const now = this.powerRaw();
  if (L.power <= now * 1.001) return;
  const changed = [];
  if (L.eq.weapon !== s.equip.weapon) { this.equip(L.eq.weapon); changed.push(ITEMS[L.eq.weapon].name); }
  for (const sl of SLOT_IDS) if (sl !== 'weapon' && L.eq[sl] && L.eq[sl] !== s.equip[sl]) { this.equip(L.eq[sl]); changed.push(ITEMS[L.eq[sl]].name); }
  if (changed.length) this.toast(`🔄 더 강한 장비로 자동 교체 (${changed.length}개) · 전투력 ${fmt(this.power())}`, 'info');
};
const _updAB = P.update;
P.update = function (dt) {
  _updAB.call(this, dt);
  this._abT = (this._abT || 0) + dt;
  if (this._abT >= 5) { this._abT = 0; this.autoBest(); }
};
// 전투 탭: 피해 숫자 빠른 끄기 버튼
const _styleCardN = U.styleCard;
U.styleCard = function (p) {
  _styleCardN?.call(this, p);
  const s = this.g.s;
  const c = h('div', 'card', `<button class="btn sm nd">💥 주는 피해 ${s.numDeal !== false ? '켜짐' : '꺼짐'}</button> <button class="btn sm nt">🩸 받는 피해 ${s.numTake !== false ? '켜짐' : '꺼짐'}</button>`);
  c.querySelector('.nd').addEventListener('click', () => { s.numDeal = s.numDeal === false; });
  c.querySelector('.nt').addEventListener('click', () => { s.numTake = s.numTake === false; });
  p.appendChild(c);
};
const _sigN = U.sigX;
U.sigX = function () { return [..._sigN.call(this), this.g.s.numDeal, this.g.s.numTake]; };

// ====================== 전투 방식 선택 · 최고 행동 자동 · 분해 ======================
const STYLE_IDS = ['melee', 'ranged', 'magic'];
// 예전 저장 정리: 화살 · 룬은 판매 가격만큼 골드로
const _townInitX = P.townInit;
P.townInit = function () {
  _townInitX.call(this);
  const s = this.s;
  if (s.cleanV === 3) return;
  let c = 0;
  for (const [id, n] of Object.entries(s.bank)) if (ITEMS[id]?.kind === 'ammo') { c += (ITEMS[id].value || 1) * n; delete s.bank[id]; }
  s.coins += c;
  if (s.autoAct == null) s.autoAct = true;
  s.cleanV = 3;
};

// ---- 어떤 전투 방식에서도 지금 최선보다 약한지 (그 방식의 최적 장비를 기준으로) ----
P.weakForAll = function (id) {
  const it = ITEMS[id];
  if (!it || it.kind !== 'gear') return false;
  const lo = this.loadoutPowers(), s = this.s, eq0 = s.equip;
  try {
    for (const st of STYLE_IDS) {
      const L = lo[st];
      if (!L) continue;
      if (it.slot === 'weapon' && it.style !== st) continue;
      if (Object.values(L.eq).includes(id)) return false; // 그 방식의 최적 장비
      s.equip = { ...L.eq }; this.dirty();
      const base = this.powerRaw();
      s.equip = { ...L.eq, [it.slot]: id }; this.dirty();
      if (this.powerRaw() > base) return false;
    }
    return true;
  } finally { s.equip = eq0; this.dirty(); }
};
// 판매: 유물까지 올려도 모든 방식에서 약한 장비만 · 기증: 지금 그대로 모든 방식에서 약한 장비만
P.uselessGear = function () {
  const list = [];
  for (const id of Object.keys(this.s.bank)) {
    const it = ITEMS[id];
    if (it?.kind !== 'gear') continue;
    const top = gearId(it.base, 8);
    if (ITEMS[top] && this.weakForAll(top) && this.weakForAll(id)) list.push(id);
  }
  return list;
};
const _donatable = P.donatable;
P.donatable = function () { return _donatable.call(this).filter((id) => this.weakForAll(id)); };
// weakForAll 결과 기억 (같은 상태 · 같은 가방이면 다시 계산 안 함)
const _wfa = P.weakForAll;
P.weakForAll = function (id) {
  this.loadoutPowers();
  const k = this.stateKey() + '|' + this._loVer;
  if (this._wfaKey !== k) { this._wfaKey = k; this._wfa = new Map(); }
  if (!this._wfa.has(id)) this._wfa.set(id, _wfa.call(this, id));
  return this._wfa.get(id);
};

// ---- 전투 방식 선택: 고르면 그 방식의 최적 장비로 바꾸고, 이후에도 계속 최적으로 유지 ----
P.chooseStyle = function (st) {
  this.s.cstyle = st;
  this.applyLoadout(st);
};
const _autoBest = P.autoBest;
P.autoBest = function () {
  const s = this.s;
  if (!s.cstyle) return _autoBest.call(this);
  if (s.fight) return;
  const L = this.loadoutPowers()[s.cstyle];
  if (!L) return;
  const same = SLOT_IDS.every((sl) => (L.eq[sl] || null) === (s.equip[sl] || null));
  if (same) return;
  if (this.style() === s.cstyle && L.power <= this.powerRaw() * 1.001) return;
  let n = 0;
  if (L.eq.weapon !== s.equip.weapon) { this.equip(L.eq.weapon); n++; }
  for (const sl of SLOT_IDS) if (sl !== 'weapon' && L.eq[sl] && L.eq[sl] !== s.equip[sl]) { this.equip(L.eq[sl]); n++; }
  if (n) this.toast(`🔄 ${STYLES[s.cstyle].name} 최적 장비로 교체 (${n}개) · 전투력 ${fmt(this.power())}`, 'info');
};
U.styleCard = function (p) {
  const g = this.g, s = g.s, cur = s.cstyle || g.style(), lo = g.loadoutPowers();
  const c = h('div', 'seg');
  for (const st of STYLE_IDS) {
    const L = lo[st];
    const b = h('button', st === cur ? 'on' : '', `${STYLES[st].icon} ${STYLES[st].name}<br><small>${L ? `전투력 ${fmt(L.power)}` : '무기 없음'}</small>`);
    if (!L) b.disabled = true;
    b.addEventListener('click', () => g.chooseStyle(st));
    c.appendChild(b);
  }
  p.appendChild(c);
  p.appendChild(h('div', 'mut', '전투 방식을 고르면 그 방식의 가장 강한 장비로 바뀌고, 더 좋은 장비가 생기면 계속 자동 교체됩니다 · 다른 방식의 최적 장비도 판매 · 기증하지 않고 남겨 둡니다'));
};

// ---- 모든 스킬: 할 수 있는 가장 높은 레벨 행동을 자동으로 ----
const SPECIAL_ACT = /^(sstone|whistle|life_)/;
P.bestAct = function (skill) {
  const L = this.lvl(skill);
  const list = (ACTIONS[skill] || []).filter((a) => a.lvl <= L && !SPECIAL_ACT.test(a.id) && (!a.in || this.hasInputs(a)));
  if (!list.length) return null;
  return list.reduce((b, a) => (a.lvl > b.lvl || (a.lvl === b.lvl && this.actionXp(skill, a) / this.actionTime(skill, a) > this.actionXp(skill, b) / this.actionTime(skill, b)) ? a : b));
};
const _skillTick = P.skillTick;
P.skillTick = function (dt) {
  const A = this.s.activity;
  if (this.s.autoAct !== false && A?.skill && !SPECIAL_ACT.test(A.act || '')) {
    this._baT = (this._baT || 0) + dt;
    const cur = (ACTIONS[A.skill] || []).find((x) => x.id === A.act);
    if (this._baT >= 1 || !cur || (cur.in && !this.hasInputs(cur))) {
      this._baT = 0;
      const b = this.bestAct(A.skill);
      if (b && b.id !== A.act) this.s.activity = { ...A, act: b.id };
    }
  }
  return _skillTick.call(this, dt);
};
U.bestActCard = function (p, k) {
  const g = this.g, s = g.s, b = g.bestAct(k.id);
  const c = h('div', 'card', `<label class="tg"><input type="checkbox" class="aa"${s.autoAct !== false ? ' checked' : ''}> ⚡ 항상 가장 높은 레벨 행동</label>
    ${b ? `<button class="btn sm pri ba">▶ 최고 행동 시작: ${b.name}</button>` : '<span class="mut">할 수 있는 행동이 없습니다 (재료 부족)</span>'}`);
  c.querySelector('.aa').addEventListener('change', (e) => { s.autoAct = e.target.checked; });
  c.querySelector('.ba')?.addEventListener('click', () => g.startSkill(k.id, b.id));
  p.appendChild(c);
};

// ---- 분해: 한 단계 높은 아이템 1개 → 2개 (모자라면 더 높은 단계부터 차례로) ----
const DECOMP_KIND = new Set(['mat', 'bone', 'food', 'raw', 'potion']);
const upOf = (id) => {
  const m = /^(.*?)(\d+)$/.exec(id);
  if (!m || !DECOMP_KIND.has(ITEMS[id]?.kind)) return null;
  const up = m[1] + (+m[2] + 1);
  return ITEMS[up] && ITEMS[up].kind === ITEMS[id].kind ? up : null;
};
P.canProduce = function (id, n, depth = 0) {
  if (n <= 0) return true;
  const up = upOf(id);
  if (!up || depth > 25) return false;
  const k = Math.ceil(n / 2), have = this.have(up);
  return have >= k || this.canProduce(up, k - have, depth + 1);
};
P.produce = function (id, n) {
  if (n <= 0) return true;
  if (!this.canProduce(id, n)) return false;
  const up = upOf(id), k = Math.ceil(n / 2);
  if (this.have(up) < k && !this.produce(up, k - this.have(up))) return false;
  this.give(up, -k);
  this.give(id, 2 * k);
  this.s.log.got[id] = (this.s.log.got[id] || 0) + 2 * k;
  return true;
};
// 행동 재료가 모자라면: 최대 10번 할 만큼 (안 되면 1번이라도) 분해해서 채움
P.fillFor = function (inp) {
  const short = (times) => Object.entries(inp || {}).map(([id, n]) => [id, n * times - this.have(id)]).filter(([, d]) => d > 0);
  for (const times of [10, 5, 3, 1]) {
    const need = short(times);
    if (!need.length) return times;
    if (need.every(([id, d]) => this.canProduce(id, d))) {
      for (const [id, d] of need) this.produce(id, d);
      this.toast(`🔽 분해로 채움: ${need.map(([id, d]) => `${ITEMS[id].name} +${fmt(d)}`).join(', ')}`, 'info');
      return times;
    }
  }
  this.toast('분해할 상위 아이템이 없습니다', 'bad');
  return 0;
};
P.canFill = function (inp) { return Object.entries(inp || {}).every(([id, n]) => this.have(id) >= n || this.canProduce(id, n - this.have(id))); };
// 의뢰(납품): 남은 수량만큼 분해해서 납품
P.rqFill = function (q) {
  const left = q.qty - this.rqProg(q);
  if (left <= 0 || !this.produce(q.target, left)) { this.toast('분해할 상위 아이템이 없습니다', 'bad'); return false; }
  this.toast(`🔽 분해로 납품: ${ITEMS[q.target].name} +${fmt(left)}`, 'info');
  this.rqTick?.();
  return true;
};
// 의뢰판: 납품 의뢰에 분해 버튼
const _townRqFn = U.townFns?.quest;
if (_townRqFn) {
  U.townFns.quest = function (ui, p, g, s) {
    _townRqFn(ui, p, g, s);
    const rows = [...p.querySelectorAll('.row')];
    const list = s.rq.list.map((q) => ({ q, r: Math.min(1, g.rqProg(q) / q.qty) })).sort((a, b) => b.r - a.r);
    list.forEach(({ q }, i) => {
      if (q.type !== 'got' || !rows[i]) return;
      const left = q.qty - g.rqProg(q);
      if (left <= 0 || !g.canProduce(q.target, left)) return;
      const b = h('button', 'btn sm', '🔽 분해로 납품');
      b.addEventListener('click', () => g.rqFill(q));
      rows[i].appendChild(b);
    });
  };
}
// 도구 업그레이드: 재료가 모자라면 분해 버튼
const _toolShop = U.toolShop;
U.toolShop = function (p) {
  _toolShop.call(this, p);
  const g = this.g;
  const cards = [...p.querySelectorAll('.tshop')];
  Object.keys(TOOLS).forEach((sk, i) => {
    const nx = g.toolNext(sk), c = cards[i];
    if (!nx || nx.matOk || !c || !g.canFill(nx.mat)) return;
    const b = h('button', 'btn sm', '🔽 분해해서 재료 채우기');
    b.addEventListener('click', () => {
      const need = Object.entries(nx.mat).map(([id, n]) => [id, n - g.have(id)]).filter(([, d]) => d > 0);
      for (const [id, d] of need) g.produce(id, d);
      g.toast(`🔽 분해로 채움: ${need.map(([id, d]) => `${ITEMS[id].name} +${fmt(d)}`).join(', ')}`, 'info');
    });
    c.appendChild(b);
  });
};
// 없어진 장비(방패 등)가 보상인 의뢰는 보상을 새로 뽑음
const _rqInitX = P.rqInit;
P.rqInit = function () {
  _rqInitX.call(this);
  for (const q of this.s.rq.list) if ((q.reward?.gear && !ITEMS[q.reward.gear]) || Object.keys(q.reward?.items || {}).some((id) => !ITEMS[id])) q.reward = this.rqReward(q.t ?? 0);
};
// 화면을 누르거나 값을 바꾸면 바로 다시 그림 (평소에는 1.2초 간격)
const _pbX = U.panelBusy;
U.panelBusy = function () {
  const first = !this._busyHooked;
  _pbX.call(this);
  if (!first || !this._busyHooked) return;
  const now = () => { this._rT = 0; this._busy = 0; };
  for (const ev of ['click', 'change']) document.addEventListener(ev, () => setTimeout(now, 0), true);
};
// 전투 탭: 피해 숫자 빠른 끄기 버튼 (전투 방식 카드 아래)
const _styleCardN2 = U.styleCard;
U.styleCard = function (p) {
  _styleCardN2.call(this, p);
  const s = this.g.s;
  const c = h('div', 'card', `<button class="btn sm nd">💥 주는 피해 ${s.numDeal !== false ? '켜짐' : '꺼짐'}</button> <button class="btn sm nt">🩸 받는 피해 ${s.numTake !== false ? '켜짐' : '꺼짐'}</button>`);
  c.querySelector('.nd').addEventListener('click', () => { s.numDeal = s.numDeal === false; });
  c.querySelector('.nt').addEventListener('click', () => { s.numTake = s.numTake === false; });
  p.appendChild(c);
};

// ====================== 전투와 스킬 완전 분리 ======================
// 전투(s.hunt)와 스킬(s.activity)은 따로 진행 — 하나를 멈추거나 바꿔도 다른 하나는 그대로
P.bgHunting = function () { return !!(this.s.hunt && MONSTER[this.s.hunt] && !this.s.fight); };
P.startCombat = function (monId) {
  if (!MONSTER[monId]) return false;
  if (this.s.fight) this.endFight('중단');
  if (this.s.activity?.type === 'combat') this.s.activity = null;
  this.s.hunt = monId;
  this.s.huntMon = monId;
  this.rt.mon = null;
  this.rt.respawn = 0;
  if (this.rt.dead <= 0) this.spawn();
  return true;
};
P.stopCombat = function () { this.s.hunt = null; this.rt.mon = null; };
// 스킬 멈춤 · 시작은 전투 몬스터를 건드리지 않음
for (const fn of ['stop', 'startSkill', 'startBury']) {
  const o = P[fn];
  P[fn] = function (...a) { const m = this.rt.mon, hp = this.rt.monHp; const r = o.apply(this, a); if (this.s.hunt && m && !this.rt.mon) { this.rt.mon = m; this.rt.monHp = hp; } return r; };
}
// 예전 저장: 전투 중이었으면 전투 칸으로, 스킬 + 함께 사냥이었으면 둘 다 유지
const _townInitSep = P.townInit;
P.townInit = function () {
  _townInitSep.call(this);
  const s = this.s;
  if (s.sepV === 1) return;
  if (s.activity?.type === 'combat') { s.hunt = s.activity.mon; s.huntMon = s.activity.mon; s.activity = null; }
  else if ((s.activity?.type === 'skill' || s.activity?.type === 'bury') && s.bgHunt !== false && MONSTER[s.huntMon]) s.hunt = s.huntMon;
  s.sepV = 1;
};
// 위쪽 장면: 전투 탭은 전투, 스킬 탭은 스킬, 나머지 탭은 진행 중인 것
U.dispAct = function () {
  const g = this.g, s = g.s, A = s.activity && s.activity.type !== 'combat' ? s.activity : null;
  const C = s.hunt && MONSTER[s.hunt] && !s.fight ? { type: 'combat', mon: s.hunt } : null;
  if (s.fight) return A;
  if (this.tab === 'combat') return C || A;
  if (this.tab === 'skills') return A || C;
  return A || C;
};
// 스킬 탭: 따로 진행 중인 전투 안내
U.bgHuntCard = function (p) {
  const g = this.g, s = g.s, m = MONSTER[s.hunt];
  const c = h('div', 'card', m ? `⚔ 전투는 따로 진행 중: ${m.icon} ${m.name} (Lv ${m.lvl}) <button class="btn sm sc">■ 전투 멈춤</button><div class="mut">전투와 스킬은 서로 따로 움직입니다 · 스킬을 바꾸거나 멈춰도 전투는 계속됩니다</div>`
    : '<span class="mut">⚔ 전투는 쉬는 중 · 전투 탭에서 몬스터를 고르면 스킬과 따로 함께 진행됩니다</span>');
  c.querySelector('.sc')?.addEventListener('click', () => g.stopCombat());
  p.appendChild(c);
};
const _sigSep = U.sigX;
U.sigX = function () { return [..._sigSep.call(this), this.g.s.hunt]; };

import { SPECIAL_NAMES as SPN_ML, FLAT_SP as FSP_ML } from './data.js';
const spText = (sp) => Object.entries(sp || {}).filter(([k]) => SPN_ML[k] && sp[k]).map(([k, v]) => `${SPN_ML[k]} +${FSP_ML.has(k) ? fmt(v) : pct(v, v < 0.1 ? 2 : 1)}`).join(', ');

// ====================== 박물관: 모든 전리품 기증 (조금씩 능력치) ======================
// 아이템 종류별로 오르는 능력치 · 기증 개수 1 / 10 / 100 / 1,000 / 10,000 개마다 한 단계
const MU_FAM = { log: 'rngFlat', ore: 'atkFlat', bar: 'strFlat', gem: 'magFlat', cloth: 'magFlat', hide: 'defFlat', raw: 'heal', food: 'heal', herb: 'drop', nest: 'drop', gembag: 'drop', chest: 'drop', sstone: 'bossDmg' };
const MU_STEPS = [1, 10, 100, 1000, 10000];
const MU_CAP = { heal: 0.5 };
const MU_CAP_DEF = 0.25;
const muFam = (id) => { const m = /^([a-z]+)(\d+)$/.exec(id); return m && MU_FAM[m[1]] && ITEMS[id] ? { k: MU_FAM[m[1]], t: +m[2] } : null; };
const muLevel = (n) => MU_STEPS.filter((x) => (n || 0) >= x).length;
const muPerPct = (t) => 0.00043 * (1 + 0.2 * t);
// 한 단계당: 공격 · 힘 · 방어 · 원거리 · 마법은 고정 수치 (높은 등급일수록 큼), 나머지는 %
const muPer = (t, k) => (/Flat$/.test(k) ? Math.round((1 + 0.6 * t) * (k === 'defFlat' ? 1.5 : 1)) : muPerPct(t));
P.museumLootBonus = function () {
  const tot = {};
  for (const [id, n] of Object.entries(this.s.museumLoot || {})) {
    const f = muFam(id);
    if (f) tot[f.k] = (tot[f.k] || 0) + muLevel(n) * muPer(f.t, f.k);
  }
  for (const k of Object.keys(tot)) if (!/Flat$/.test(k)) tot[k] = Math.min(MU_CAP[k] ?? MU_CAP_DEF, Math.round(tot[k] * 10000) / 10000);
  return tot;
};
const _extraML = P.extraSources;
P.extraSources = function () { return [..._extraML.call(this), this.museumLootBonus()]; };
// 다음 단계까지 필요한 개수
P.muNeed = function (id) {
  const n = this.s.museumLoot?.[id] || 0, nx = MU_STEPS.find((x) => x > n);
  return nx ? nx - n : 0;
};
P.donateLoot = function (id, quiet = false) {
  const k = Math.min(this.have(id), this.muNeed(id));
  if (k <= 0 || !muFam(id)) return 0;
  this.give(id, -k);
  this.s.museumLoot = { ...(this.s.museumLoot || {}), [id]: (this.s.museumLoot?.[id] || 0) + k };
  this.dirty();
  if (!quiet) this.toast(`🏛️ ${ITEMS[id].name} ${fmt(k)}개 기증 · ${muLevel(this.s.museumLoot[id])}단계`, 'loot');
  return k;
};
P.lootDonatable = function () { return Object.keys(this.s.bank).filter((id) => muFam(id) && this.muNeed(id) > 0 && this.have(id) > 0); };
P.donateAllLoot = function () {
  let n = 0, kinds = 0;
  for (const id of this.lootDonatable()) { const k = this.donateLoot(id, true); if (k) { n += k; kinds++; } }
  this.toast(n ? `🏛️ 전리품 ${kinds}종 ${fmt(n)}개 기증` : '기증할 전리품이 없습니다', n ? 'loot' : 'bad');
  return n;
};
// 자동 기증이 켜져 있으면 전리품도 다음 단계에 필요한 만큼만 (10초마다)
const _adML = P.autoDonate;
P.autoDonate = function () {
  const r = _adML.call(this);
  if (this.s.autoLootDonate) for (const id of this.lootDonatable()) this.donateLoot(id, true);
  return r;
};
U.museumLootCard = function (p) {
  const g = this.g, s = g.s, b = g.museumLootBonus();
  const list = g.lootDonatable().sort((a, c) => (ITEMS[c].t || 0) - (ITEMS[a].t || 0));
  const done = Object.keys(s.museumLoot || {}).length;
  const c = h('div', 'card', `<b>🏛️ 전리품 전시실</b> <span class="mut">기증 ${done}종</span>
    <div class="mut">재료 · 음식 · 약초 · 상자 같은 전리품을 기증할 수 있습니다 (뼈는 신성에 쓰여서 제외). 아이템마다 1 / 10 / 100 / 1,000 / 10,000개를 기증할 때마다 능력치가 조금씩 오릅니다 (높은 단계일수록 큼) · 목재=원거리 · 광석=공격 · 주괴=힘 · 보석 · 마력 천=마법 · 가죽=방어 · 생선 · 음식=음식 회복 · 약초 · 상자=드롭률 · 소환석=보스 피해</div>
    <div style="margin-top:6px">보너스: <span class="sp">${spText(b) || '없음'}</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn pri dal"${list.length ? '' : ' disabled'}>🏛️ 전리품 한꺼번에 기증 (${list.length}종)</button>
    <label class="tg"><input type="checkbox" class="ald"${s.autoLootDonate ? ' checked' : ''}> 전리품 자동 기증</label></div>
    <div class="mut">한꺼번에 · 자동 기증은 다음 단계에 필요한 만큼만 냅니다 (재료를 다 쓰지 않음)</div>`);
  c.querySelector('.dal').addEventListener('click', () => g.donateAllLoot());
  c.querySelector('.ald').addEventListener('change', (e) => { s.autoLootDonate = e.target.checked; });
  p.appendChild(c);
  for (const id of list.slice(0, 20)) {
    const it = ITEMS[id], f = muFam(id), n = s.museumLoot?.[id] || 0;
    const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name} <span class="mut">보유 ${fmt(g.have(id))}</span></div><div class="mut">기증 ${fmt(n)}개 · ${muLevel(n)} / ${MU_STEPS.length}단계 · 다음 단계까지 ${fmt(g.muNeed(id))}개 · ${spText({ [f.k]: muPer(f.t, f.k) })} / 단계</div></div><button class="btn sm pri">기증</button>`);
    r.querySelector('button').addEventListener('click', () => g.donateLoot(id));
    p.appendChild(r);
  }
  if (list.length > 20) p.appendChild(h('div', 'mut', `외 ${list.length - 20}종 (한꺼번에 기증으로 모두)`));
};
const _sigML = U.sigX;
U.sigX = function () { const s = this.g.s; return [..._sigML.call(this), Object.keys(s.museumLoot || {}).length, s.autoLootDonate, s.autoDecomp, this.tab === 'town' && this.town === 'museum' ? this.bankSig() : 0]; };

// ====================== 자동 분해 (켜기 / 끄기) ======================
// 켜면: 스킬 재료 · 도구 업그레이드 재료 · 납품 의뢰가 모자랄 때 한 단계 위 아이템을 저절로 분해
const _bestActD = P.bestAct;
P.bestAct = function (skill) {
  if (!this.s.autoDecomp) return _bestActD.call(this, skill);
  const L = this.lvl(skill);
  const list = (ACTIONS[skill] || []).filter((a) => a.lvl <= L && !/^(sstone|whistle|life_)/.test(a.id) && (!a.in || this.hasInputs(a) || this.canFill(a.in)));
  if (!list.length) return null;
  return list.reduce((b, a) => (a.lvl > b.lvl || (a.lvl === b.lvl && this.actionXp(skill, a) / this.actionTime(skill, a) > this.actionXp(skill, b) / this.actionTime(skill, b)) ? a : b));
};
const _skillTickD = P.skillTick;
P.skillTick = function (dt) {
  const A = this.s.activity;
  if (this.s.autoDecomp && A?.type === 'skill') {
    const a = (ACTIONS[A.skill] || []).find((x) => x.id === A.act);
    if (a?.in && !this.hasInputs(a) && this.canFill(a.in)) this.fillFor(a.in, true);
  }
  return _skillTickD.call(this, dt);
};
const _fillFor = P.fillFor;
P.fillFor = function (inp, quiet = false) {
  if (!quiet) return _fillFor.call(this, inp);
  const q = this.quiet; this.quiet = true;
  try { return _fillFor.call(this, inp); } finally { this.quiet = q; }
};
const _upTool = P.upgradeTool;
P.upgradeTool = function (sk) {
  const nx = this.toolNext(sk);
  if (this.s.autoDecomp && nx && nx.lvOk && nx.coinOk && !nx.matOk && this.canFill(nx.mat)) {
    for (const [id, n] of Object.entries(nx.mat)) if (this.have(id) < n) this.produce(id, n - this.have(id));
  }
  return _upTool.call(this, sk);
};
// 도구는 자동 분해가 켜져 있으면 재료가 모자라도 업그레이드 버튼이 눌리게
const _toolNextD = P.toolNext;
P.toolNext = function (sk) {
  const nx = _toolNextD.call(this, sk);
  if (nx && this.s.autoDecomp && !nx.matOk && this.canFill(nx.mat)) { nx.decompOk = true; nx.ok = nx.lvOk && nx.coinOk; }
  return nx;
};
const _aqD = P.autoQuest;
P.autoQuest = function () {
  _aqD.call(this);
  if (!this.s.autoDecomp || !this.s.rq) return;
  for (const q of this.s.rq.list) {
    if (q.type !== 'got') continue;
    const left = q.qty - this.rqProg(q);
    if (left > 0 && this.canProduce(q.target, left)) this.produce(q.target, left);
  }
};
const decompToggle = (g) => {
  const l = h('label', 'tg', `<input type="checkbox"${g.s.autoDecomp ? ' checked' : ''}> 🔽 자동 분해 <span class="mut">(재료가 모자라면 한 단계 위 아이템 1개 → 2개)</span>`);
  l.querySelector('input').addEventListener('change', (e) => { g.s.autoDecomp = e.target.checked; });
  return l;
};
const _bestActCardD = U.bestActCard;
U.bestActCard = function (p, k) {
  _bestActCardD.call(this, p, k);
  if (ACTIONS[k.id]?.some((a) => a.in)) p.lastElementChild.appendChild(decompToggle(this.g));
};
const _toolShopD = U.toolShop;
U.toolShop = function (p) {
  const n0 = p.children.length;
  _toolShopD.call(this, p);
  const c = h('div', 'card');
  c.appendChild(decompToggle(this.g));
  p.insertBefore(c, p.children[n0 + 2] || null);
};
const _rqFnD = U.townFns.quest;
U.townFns.quest = function (ui, p, g, s) {
  const n0 = p.children.length;
  _rqFnD(ui, p, g, s);
  const c = h('div', 'card');
  c.appendChild(decompToggle(g));
  c.appendChild(h('div', 'mut', '켜면 납품 의뢰를 상위 아이템 분해로 저절로 채웁니다'));
  p.insertBefore(c, p.children[n0 + 1] || null);
};
// 자동 분해가 켜져 있으면 스킬을 시작할 때도 모자란 재료를 먼저 채움
const _startSkillD = P.startSkill;
P.startSkill = function (skill, actId) {
  const a = (ACTIONS[skill] || []).find((x) => x.id === actId);
  if (this.s.autoDecomp && a?.in && !this.hasInputs(a) && this.canFill(a.in)) this.fillFor(a.in, true);
  return _startSkillD.call(this, skill, actId);
};

// 박물관에 이미 기증한 뼈는 가방으로 돌려줌 (뼈는 신성에 씀)
const _townInitMB = P.townInit;
P.townInit = function () {
  _townInitMB.call(this);
  const s = this.s;
  if (s.muBoneV === 1) return;
  for (const [id, n] of Object.entries(s.museumLoot || {})) if (/^bone\d+$/.test(id)) { this.give(id, n); delete s.museumLoot[id]; }
  s.muBoneV = 1;
};

// ====================== 🗼 별의 탑: 층마다 강해지는 적 · 처음 깬 층마다 고정 능력치 영구 보상 ======================
import { refDef as refDef_T, SPECIAL_NAMES as SPN_T, FLAT_SP as FSP_T } from './data.js';
const TW_STAT = ['atk', 'str', 'def', 'rng', 'mag'];
const TW_MON = [['🦇', '탑의 박쥐'], ['💀', '탑지기 해골'], ['🧿', '떠도는 눈'], ['🗿', '돌 파수꾼'], ['👻', '별빛 망령'], ['🦂', '수정 전갈'], ['🧙', '타락한 마법사'], ['🐺', '그림자 늑대'], ['🤖', '고대 자동인형']];
const TW_BOSS = [['🐉', '탑의 용'], ['👹', '별 먹는 귀신'], ['🦅', '폭풍의 군주'], ['🧛', '밤의 군주'], ['🌋', '용암 거인']];
const twLevel = (F) => 2 + 2 * F; // 1층 Lv 4 · 50층 Lv 102 · 100층 Lv 202
const twBossF = (F) => F % 10 === 0;
// 층 보상: 공격 → 힘 → 방어 → 원거리 → 마법 순서로 고정 수치 (방어는 1.5배 · 보스 층은 3배)
const twReward = (F) => { const k = TW_STAT[(F - 1) % 5], L = twLevel(F); return { k: k + 'Flat', v: Math.max(1, Math.round(0.01 * refDef_T(L) * (k === 'def' ? 1.5 : 1) * (twBossF(F) ? 3 : 1))) }; };
const twMonHp = (L) => (L <= 100 ? 15 + 0.0516 * L ** 2.45 : (15 + 0.0516 * 100 ** 2.45) * (L / 100) ** 2);
export function twMonster(F) {
  const L = twLevel(F), boss = twBossF(F), style = ROT[F % 3], b = boss ? 1.25 : 1.1;
  const defMul = { melee: 1, ranged: 1, magic: 1 };
  defMul[WEAK[style]] = 0.5;
  defMul[style] = 1.4;
  const [icon, name] = boss ? TW_BOSS[(F / 10 - 1) % TW_BOSS.length] : TW_MON[F % TW_MON.length];
  return {
    id: 'tw' + F, name, icon, lvl: L, style, boss, z: -1, weak: WEAK[style], defMul, interval: boss ? 3.0 : 2.6,
    hp: Math.round(twMonHp(L) * (boss ? 6 : 2.5)),
    ...monAtkStr(L, b), def: Math.round((1 + 0.176 * L ** 1.45) * b),
  };
}
const twSum = (best) => { const o = {}; for (let F = 1; F <= best; F++) { const r = twReward(F); o[r.k] = (o[r.k] || 0) + r.v; } return o; };
P.towerBonus = function () {
  const best = this.s.tw?.best || 0;
  if (this._twB?.best !== best) this._twB = { best, v: twSum(best) };
  return this._twB.v;
};
const _extraTW = P.extraSources;
P.extraSources = function () { return [..._extraTW.call(this), this.towerBonus()]; };
P.twInit = function () { this.s.tw ||= { best: 0, runs: 0, auto: true }; return this.s.tw; };
P.startTower = function (F) {
  const w = this.twInit();
  F = Math.max(1, Math.min(F || w.best + 1, w.best + 1));
  if (this.s.activity) this.stop();
  this.newSess();
  this.rt.fx = [];
  this.s.fight = { kind: 'tw', F, start: F, time: 0, hp: twMonster(F).hp, cleared: 0, coins: 0, got: {} };
  this.s.activity = { type: 'tower', id: 'tw' };
  const rt = this.rt;
  rt.mon = null; rt.atkT = 0; rt.monT = 0; rt.dead = 0;
  rt.hp = this.maxHp();
  w.runs++;
  return true;
};
P.twTick = function (dt) {
  const f = this.s.fight, rt = this.rt;
  if (f?.kind !== 'tw') { this.s.activity = null; return; }
  const m = rt.twm?.id === 'tw' + f.F ? rt.twm : (rt.twm = twMonster(f.F));
  const p = this.profile();
  f.time += dt; // 이번 층에서 싸운 시간 (제한 없음 · 쓰러질 때까지)
  rt.tickT += dt;
  while (rt.tickT >= COMBAT_TICK) { rt.tickT -= COMBAT_TICK; if (p.sp.hpTick) rt.hp = Math.min(C.maxHp(p), rt.hp + p.sp.hpTick); }
  rt.atkT += dt;
  const iv = C.interval(p);
  while (rt.atkT >= iv) {
    rt.atkT -= iv;
    {
      const cap = C.cap(p, monDef(m, p.style));
      const lo = C.minHit(p, cap);
      const dmg = Math.floor((lo + Math.floor(Math.random() * (cap - lo + 1))) * C.dmgMult(p, m));
      f.hp -= dmg;
      this.fx('mon', String(dmg), 'hit');
      const ls = C.ls(p);
      if (ls > 0 && dmg > 0) rt.hp = Math.min(C.maxHp(p), rt.hp + Math.max(1, Math.ceil(dmg * ls)));
      if (dmg > 0) this.combatXp(dmg * 0.5, p.style);
    }
    this.useEffects('atk');
    if (f.hp <= 0) return this.twWin(f, m);
  }
  rt.monT += dt;
  while (rt.monT >= m.interval) {
    rt.monT -= m.interval;
    const hits = Math.random() < C.mHit(p, m);
    const d = hits ? C.mDmg(p, m, MON_ROLL[0] + Math.random() * (MON_ROLL[1] - MON_ROLL[0])) : 0;
    rt.hp -= d;
    this.fx('hero', !hits ? '빗나감' : d ? '-' + d : '0', d ? 'hurt' : 'miss');
    this.autoEat();
    if (rt.hp <= 0) { rt.hp = 1; return this.twEnd('쓰러짐'); }
  }
};
P.twWin = function (f, m) {
  const w = this.twInit(), F = f.F, L = m.lvl, t = tierFor(L);
  const coins = Math.round((L * 6 + 20) * (1 + L / 60) * (m.boss ? 5 : 1));
  this.s.coins += coins;
  f.coins += coins;
  f.cleared++;
  const add = (id, n) => { if (n > 0) { const g = this.gain(id, n); f.got[g] = (f.got[g] || 0) + n; } };
  if (F > w.best) {
    const r = twReward(F);
    w.best = F;
    this.dirty();
    this.toast(`🗼 ${F}층 첫 돌파! ${SPN_T[r.k]} +${fmt(r.v)} (영구)`, 'pet');
    if (m.boss) {
      const id = gearId(pick(Object.keys(GEAR)) + t, rollRarity(4));
      add(id, 1);
      this.s.log.gear[id] = (this.s.log.gear[id] || 0) + 1;
      this.autoEquipCheck(id);
      add(pick(['nest', 'gembag', 'chest']) + t, 2);
      if (this.s.cele !== false) this.celebrate(`🗼 ${F}층 ${m.icon} ${m.name} 격파!`);
    }
  } else if (m.boss) add(pick(['nest', 'gembag', 'chest']) + t, 1);
  // 다음 층으로 (자동 오르기) · 층 사이에 체력 30% 회복
  if (w.auto !== false) {
    f.F = F + 1;
    f.time = 0;
    f.hp = twMonster(f.F).hp;
    this.rt.monT = 0;
    this.rt.hp = Math.min(this.maxHp(), this.rt.hp + this.maxHp() * 0.3);
  } else this.twEnd(`${F}층 돌파`);
};
P.twEnd = function (why) {
  const f = this.s.fight;
  this.s.fight = null;
  this.s.activity = null;
  this.rt.mon = null;
  this.rt.twm = null;
  if (f?.kind !== 'tw') return;
  const w = this.twInit();
  const got = Object.entries(f.got).map(([id, n]) => `${ITEMS[id].icon} ${ITEMS[id].name} x${n}`).join('<br>');
  this.rt.popup = {
    title: `🗼 별의 탑 — ${why}`,
    html: `${f.start}층 → ${f.F}층 · 돌파 ${f.cleared}층 · 최고 기록 <b>${w.best}층</b><br>💰 +${fmt(f.coins)}${got ? '<br>' + got : ''}`,
  };
};
const _endTW = P.endFight;
P.endFight = function (why) {
  if (this.s.fight?.kind === 'tw') return this.twEnd(why);
  return _endTW.call(this, why);
};
const _updTW = P.update;
P.update = function (dt) {
  _updTW.call(this, dt);
  if (this.s.activity?.type === 'tower') this.twTick(dt);
};
const _tiTW = P.townInit;
P.townInit = function () {
  const keep = this.s.activity?.type === 'tower' ? this.s.fight : null;
  _tiTW.call(this);
  if (keep && !this.s.fight) this.s.fight = keep;
  this.twInit();
};

// ---- 화면 ----
const _ahTW = U.actHtmlX;
U.actHtmlX = function (A) {
  if (A.type !== 'tower') return _ahTW.call(this, A);
  const f = this.g.s.fight;
  if (f?.kind !== 'tw') return '<div class="idle">탑 정리 중…</div>';
  const m = twMonster(f.F), g = this.g;
  return `<div class="duel">
    <div class="fighter"><div class="ic heroIc">🧝</div><div class="nm">나 (${STYLES[g.style()].icon} ${STYLES[g.style()].name})</div><div class="bar hpP twh"><div></div><span></span></div></div>
    <div class="vs twf">🗼${f.F}층</div>
    <div class="fighter"><div class="ic monIc twi">${m.icon}</div><div class="nm twn">${m.boss ? '👑 ' : ''}${m.name} Lv ${m.lvl} · ${STYLES[m.style].icon}</div><div class="bar mon twm"><div></div><span></span></div></div>
  </div><div class="floats"></div><div class="actinfo"><span class="info"></span><button class="btn sm" id="stopBtn">■ 그만</button></div>`;
};
const _fxTW = U.frameX;
U.frameX = function (act, A) {
  _fxTW.call(this, act, A);
  if (A?.type !== 'tower') return;
  const g = this.g, rt = g.rt, f = g.s.fight;
  if (f?.kind !== 'tw') return;
  const m = twMonster(f.F), mx = g.maxHp();
  const ff = act.querySelector('.twf');
  if (ff && act._twF !== f.F) {
    act._twF = f.F;
    ff.textContent = `🗼${f.F}층`;
    act.querySelector('.twi').textContent = m.icon;
    act.querySelector('.twn').textContent = `${m.boss ? '👑 ' : ''}${m.name} Lv ${m.lvl} · ${STYLES[m.style].icon}`;
  }
  const hb = act.querySelector('.twh'), mb = act.querySelector('.twm');
  if (hb) { hb.firstElementChild.style.width = pct(Math.max(0, rt.hp) / mx); hb.lastElementChild.textContent = `${fmt(Math.max(0, rt.hp))} / ${fmt(mx)}`; }
  if (mb) { mb.firstElementChild.style.width = pct(Math.max(0, f.hp) / m.hp); mb.lastElementChild.textContent = `${fmt(Math.max(0, f.hp))} / ${fmt(m.hp)}`; }
  const i = act.querySelector('.info');
  if (i) i.textContent = `이번 층 ${mmss(f.time)} · 이번 도전 ${f.cleared}층 돌파 · 최고 ${g.s.tw.best}층`;
  const fl = act.querySelector('.floats');
  if (fl) {
    act._fl ||= new Set();
    for (const x of rt.fx) {
      if (act._fl.has(x)) continue;
      act._fl.add(x);
      const e = h('div', 'fl ' + x.kind, x.text);
      e.style.left = `calc(${x.at === 'hero' ? 20 : 80}% + ${x.x}px)`;
      fl.appendChild(e);
      setTimeout(() => e.remove(), 1000);
    }
    if (act._fl.size > 200) act._fl = new Set(rt.fx);
  }
};
const spTextTW = (sp) => Object.entries(sp || {}).filter(([k]) => SPN_T[k] && sp[k]).map(([k, v]) => `${SPN_T[k]} +${FSP_T.has(k) ? fmt(v) : pct(v)}`).join(', ');
function townTower(ui, p, g, s) {
  const w = g.twInit(), F = w.best + 1, m = twMonster(F), v = g.vs(m);
  const inTw = s.activity?.type === 'tower';
  const killT = v.dps > 0 ? m.hp / v.dps : Infinity;
  // 쓰러질 때까지: 이 층을 잡는 동안 잃는 체력으로 판단 (음식 제외)
  const tip = v.killsPerLife >= 2 ? '✅ 여유' : v.killsPerLife >= 1 ? '⚠ 빠듯함 (음식 필요할 수 있음)' : '❌ 쓰러질 가능성 큼';
  const r = twReward(F);
  const c = h('div', 'card', `<b>🗼 별의 탑</b> <span class="mut">최고 기록 <b>${w.best}층</b> · 도전 ${fmt(w.runs)}회</span>
    <div class="mut">층마다 강해지는 적과 <b>쓰러질 때까지</b> 싸웁니다 (시간 제한 없음) · 이기면 체력 30%를 회복하고 다음 층으로 · 처음 깬 층마다 <b>고정 능력치</b>가 영구로 오릅니다 (공격 → 힘 → 방어 → 원거리 → 마법 순서) · 10층마다 보스 (능력치 3배 + 영웅 이상 장비)</div>
    <div style="margin-top:6px">다음: <b>${F}층</b> ${m.boss ? '👑 ' : ''}${m.icon} ${m.name} Lv ${m.lvl} · ${STYLES[m.style].icon} · 체력 ${fmt(m.hp)}</div>
    <div class="mut">예상 처치 ${Number.isFinite(killT) ? killT.toFixed(0) + '초' : '불가'} ${tip} · 적 명중 ${pct(v.mHit)} · 첫 돌파 보상 ${SPN_T[r.k]} +${fmt(r.v)}</div>
    <div style="margin-top:6px">탑 보너스 (영구): <span class="sp">${spTextTW(g.towerBonus()) || '없음'}</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button class="btn pri twgo"${inTw ? ' disabled' : ''}>${inTw ? '오르는 중…' : `⚔ ${F}층 도전`}</button>
      ${w.best >= 10 ? `<button class="btn twgo2"${inTw ? ' disabled' : ''}>↺ ${Math.max(1, F - 10)}층부터 (몸풀기)</button>` : ''}
      <label class="tg"><input type="checkbox" class="twa"${w.auto !== false ? ' checked' : ''}> 이기면 자동으로 다음 층</label>
    </div>
    <div class="mut">탑에 오르는 동안 스킬은 멈춥니다 · 쓰러지면 그때까지 보상 · 음식은 자동 섭취 설정대로 먹습니다</div>`);
  c.querySelector('.twgo').addEventListener('click', () => g.startTower(F));
  c.querySelector('.twgo2')?.addEventListener('click', () => g.startTower(Math.max(1, F - 10)));
  c.querySelector('.twa').addEventListener('change', (e) => { w.auto = e.target.checked; });
  p.appendChild(c);
  const rows = [];
  for (let k = F; k < F + 10; k++) { const x = twReward(k), mm = twMonster(k); rows.push(`${mm.boss ? '👑' : '·'} ${k}층 Lv ${mm.lvl} ${mm.icon} ${mm.name} → ${SPN_T[x.k]} +${fmt(x.v)}`); }
  p.appendChild(h('div', 'card mut', `<b>다가오는 층 보상</b><br>${rows.join('<br>')}`));
}
U.townExtra = [...U.townExtra, ['tower', '🗼 탑']];
U.townFns.tower = townTower;
const _sigTW = U.sigX;
U.sigX = function () { const s = this.g.s; return [..._sigTW.call(this), s.tw?.best, s.tw?.auto, s.activity?.type === 'tower']; };

// ====================== 🎟 쿠폰: 누르면 바로 도전권 등 보상 (무제한) ======================
// 도전권은 최대치(3장)를 넘어 쌓을 수 있음
export const COUPONS = {
  STAR2026: { wb: 3, text: '세계 보스 도전권 3장' },
  별무리: { wb: 5, text: '세계 보스 도전권 5장' },
  WORLDBOSS: { wb: 3, coins: 50000, text: '세계 보스 도전권 3장 · 💰 50,000' },
  TOWER: { wb: 2, coins: 30000, text: '세계 보스 도전권 2장 · 💰 30,000' },
};
const cpNorm = (c) => String(c || '').trim().replace(/\s+/g, '').toUpperCase();
P.redeemCoupon = function (code) {
  const k = cpNorm(code);
  const key = Object.keys(COUPONS).find((x) => cpNorm(x) === k);
  if (!k) return { ok: false, msg: '쿠폰 번호를 입력하세요' };
  if (!key) return { ok: false, msg: '없는 쿠폰입니다' };
  const c = COUPONS[key];
  this.s.cpUsed = (this.s.cpUsed || 0) + 1; // 쿠폰은 무제한으로 쓸 수 있음
  if (c.wb) { this.wbRegen(); this.s.wb.tk += c.wb; }
  if (c.coins) this.s.coins += c.coins;
  this.dirty();
  this.save?.();
  return { ok: true, msg: `🎟 쿠폰 사용! ${c.text}` };
};
U.couponModal = function () {
  this.modal('🎟 쿠폰 입력', `<input id="cpIn" type="text" autocomplete="off" placeholder="쿠폰 번호" style="width:100%;box-sizing:border-box;padding:8px;font-size:16px;border-radius:8px;border:1px solid var(--line,#444);background:var(--bg2,#111);color:inherit">
    <div class="mut" style="margin-top:6px">세계 보스 도전권 같은 보상을 받습니다 · 쿠폰마다 한 번 · 도전권은 최대치를 넘어 쌓입니다</div>`, [
    { label: '받기', pri: true, fn: () => { const r = this.g.redeemCoupon(document.getElementById('cpIn')?.value); this.g.toast(r.msg, r.ok ? 'pet' : 'bad'); this._rT = 0; } },
    { label: '닫기' },
  ]);
  setTimeout(() => document.getElementById('cpIn')?.focus(), 50);
};
const couponCard = (ui) => {
  const g = ui.g;
  const c = h('div', 'card', `<b>🎟 쿠폰</b> <span class="mut">누르면 바로 사용 · 무제한 · 도전권 ${g.s.wb?.tk ?? 0}장</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div>`);
  const box = c.lastElementChild;
  for (const [k, v] of Object.entries(COUPONS)) {
    const b = h('button', 'btn sm pri', `🎟 ${v.text}`);
    b.addEventListener('click', () => { const r = g.redeemCoupon(k); g.toast(r.msg, r.ok ? 'pet' : 'bad'); ui._rT = 0; });
    box.appendChild(b);
  }
  return c;
};
const _tabMoreCP = U.tabMore;
U.tabMore = function (p) { p.appendChild(couponCard(this)); return _tabMoreCP.call(this, p); };
// 세계 보스 카드 아래에도 쿠폰 버튼
const _bossCP = U.townFns.boss;
U.townFns.boss = function (ui, p, g, s) {
  const n0 = p.children.length;
  _bossCP(ui, p, g, s);
  p.insertBefore(couponCard(ui), p.children[n0 + 1] || null);
};
const _sigCP = U.sigX;
U.sigX = function () { return [..._sigCP.call(this), this.g.s.cpUsed || 0, this.g.s.wb?.tk]; };

// ====================== ⭐ 별 강화: 부위마다 0 ~ 30성 · 성공 / 실패(하락) / 파괴 · 자동 강화 ======================
// 강화 수치는 '부위'에 붙음 → 더 좋은 장비로 바꿔 껴도 별은 그대로
import { SLOTS as SLOTS_SF, SLOT_IDS as SLOT_IDS_SF } from './data.js';
const SF_MAX = 30;
const SF_SAFE = [15, 20, 25]; // 실패해도 떨어지지 않는 별
const sfBreakTo = (k) => (k < 22 ? 12 : 20); // 파괴되면 이 별로 (22성부터는 20성)
const SF_HI = [0.32, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.18]; // 22 ~ 29성 성공 확률
const SF_OFF = ['atk', 'str', 'rng', 'mag'];
// 부위별 능력치 비율: 무기 = 공격 계열 / 방어구 = 방어 + 공격 계열 일부 / 장신구 = 공격 계열 위주
const sfMix = (sl) => (sl === 'weapon' ? { off: 1, def: 0 } : SLOTS_SF[sl]?.cat === 'acc' ? { off: 0.6, def: 0.3 } : { off: 0.35, def: 1 });
// k번째 별 하나가 주는 기본 수치 (뒤로 갈수록 크게)
const sfGain = (k) => 2 + 0.8 * k + (k > 15 ? 0.5 * (k - 15) ** 1.7 : 0);
export const sfRate = (k) => {
  const ok = k < 15 ? Math.max(0.3, 0.95 - 0.05 * k) : k < 22 ? 0.3 : SF_HI[k - 22];
  const brk = k < 15 ? 0 : k < 18 ? 0.021 : k < 20 ? 0.028 : k < 22 ? 0.035 : 0.04 + 0.004 * (k - 22);
  return { ok, brk };
};
const sfCost = (k, prot) => Math.round(200 * (k + 1) ** 2 * (prot ? 2 : 1));
const sfCanProt = (k) => k >= 15 && k < 22;
const sfDrops = (k) => k >= 15 && !SF_SAFE.includes(k);
P.sfInit = function () {
  this.s.sf ||= { st: {}, auto: false, target: 15, slot: 'all', reserve: 0.1, prot: false, chance: {}, log: [], tries: 0, breaks: 0 };
  const f = this.s.sf;
  f.st ||= {}; f.chance ||= {}; f.log ||= [];
  return f;
};
P.sfStars = function (sl) { return this.s.sf?.st?.[sl] || 0; };
P.sfBonus = function () {
  const st = this.s.sf?.st || {};
  const key = JSON.stringify(st);
  if (this._sfB?.key === key) return this._sfB.v;
  const v = {};
  for (const sl of SLOT_IDS_SF) {
    const n = st[sl] || 0;
    if (!n) continue;
    let tot = 0;
    for (let k = 1; k <= n; k++) tot += sfGain(k);
    const m = sfMix(sl);
    if (m.off) for (const k of SF_OFF) v[k + 'Flat'] = (v[k + 'Flat'] || 0) + tot * m.off;
    if (m.def) v.defFlat = (v.defFlat || 0) + tot * m.def;
  }
  for (const k of Object.keys(v)) v[k] = Math.round(v[k]);
  this._sfB = { key, v };
  return v;
};
const _extraSF = P.extraSources;
P.extraSources = function () { return [..._extraSF.call(this), this.sfBonus()]; };
// 한 번 강화 · 결과: 'ok' | 'keep' | 'down' | 'break' | 'chance' | null(못 함)
P.sfTry = function (sl, quiet = false) {
  const f = this.sfInit(), k = this.sfStars(sl);
  if (!SLOTS_SF[sl] || k >= SF_MAX) return null;
  const prot = f.prot && sfCanProt(k);
  const cost = sfCost(k, prot);
  if (this.s.coins < cost) { if (!quiet) this.toast(`💰 골드가 부족합니다 (${fmt(cost)})`, 'bad'); return null; }
  this.s.coins -= cost;
  f.tries++;
  const r = sfRate(k);
  let res;
  if ((f.chance[sl] || 0) >= 2) { res = 'chance'; f.st[sl] = k + 1; f.chance[sl] = 0; }
  else {
    const x = Math.random();
    if (x < r.ok) { res = 'ok'; f.st[sl] = k + 1; f.chance[sl] = 0; }
    else if (!prot && x < r.ok + r.brk) { res = 'break'; f.st[sl] = sfBreakTo(k); f.chance[sl] = 0; f.breaks++; }
    else if (sfDrops(k)) { res = 'down'; f.st[sl] = k - 1; f.chance[sl] = (f.chance[sl] || 0) + 1; }
    else { res = 'keep'; f.chance[sl] = 0; }
  }
  const nk = f.st[sl];
  const txt = { ok: '성공', chance: '찬스 타임 성공', keep: '실패 (유지)', down: '실패 (하락)', break: '💥 파괴' }[res];
  f.log = [{ sl, k, nk, res, txt }, ...f.log].slice(0, 10);
  this.dirty();
  if (!quiet || res === 'break' || ((res === 'ok' || res === 'chance') && nk >= 20)) {
    this.toast(`⭐ ${SLOTS_SF[sl].name} ${k}성 → ${nk}성 · ${txt}`, res === 'ok' || res === 'chance' ? 'pet' : res === 'break' ? 'bad' : '');
  }
  if ((res === 'ok' || res === 'chance') && nk >= 22 && this.s.cele !== false) this.celebrate(`⭐ ${SLOTS_SF[sl].name} ${nk}성 달성!`);
  return res;
};
// 자동 강화: 목표 별까지 (모든 부위면 별이 가장 낮은 부위부터) · 골드가 남겨 둘 만큼만 쓰면 멈춤
P.sfAutoPick = function () {
  const f = this.sfInit();
  const list = f.slot === 'all' ? SLOT_IDS_SF : [f.slot];
  let best = null;
  for (const sl of list) { const n = this.sfStars(sl); if (n < f.target && n < SF_MAX && (best == null || n < this.sfStars(best))) best = sl; }
  return best;
};
P.sfAutoStop = function (why, kind = 'info') { const f = this.sfInit(); f.auto = false; this._sfT = 0; this.toast(`⭐ 자동 강화 멈춤 · ${why}`, kind); };
P.sfAutoTick = function (dt) {
  const f = this.s.sf;
  if (!f?.auto) return;
  this._sfT = (this._sfT || 0) + dt;
  let n = 0;
  while (this._sfT >= 0.25 && n < 8) {
    this._sfT -= 0.25; n++;
    const sl = this.sfAutoPick();
    if (!sl) return this.sfAutoStop(`목표 ${f.target}성 달성!`, 'pet');
    const k = this.sfStars(sl), cost = sfCost(k, f.prot && sfCanProt(k));
    if (this.s.coins - cost < (f.resAmt || 0)) return this.sfAutoStop('골드 부족 (남겨 둘 골드 도달)', 'bad');
    this.sfTry(sl, true);
  }
};
P.sfAutoStart = function () {
  const f = this.sfInit();
  if (!this.sfAutoPick()) { this.toast(`이미 목표 ${f.target}성입니다`, 'bad'); return false; }
  f.resAmt = Math.floor(this.s.coins * (f.reserve || 0));
  f.auto = true;
  this._sfT = 0;
  return true;
};
const _updSF = P.update;
P.update = function (dt) { _updSF.call(this, dt); this.sfAutoTick(dt); };

// ---- 화면 ----
const SF_TARGETS = [5, 10, 12, 15, 17, 18, 20, 22, 25, 30];
const starBar = (n) => `<span style="color:#ffd84d;letter-spacing:-1px">${'★'.repeat(Math.min(n, 15))}</span>${n > 15 ? `<span style="color:#ff9f43;letter-spacing:-1px">${'★'.repeat(n - 15)}</span>` : ''}`;
function townStar(ui, p, g, s) {
  const f = g.sfInit();
  const b = g.sfBonus();
  const bonusTxt = ['atk', 'str', 'def', 'rng', 'mag'].filter((k) => b[k + 'Flat']).map((k) => `${STATS[k].name} +${fmt(b[k + 'Flat'])}`).join(', ');
  const top = h('div', 'card', `<b>⭐ 별 강화</b> <span class="mut">시도 ${fmt(f.tries)} · 파괴 ${fmt(f.breaks)}</span>
    <div class="mut">부위마다 최대 ${SF_MAX}성 · 별은 부위에 붙어서 장비를 바꿔도 그대로 · 별마다 <b>고정 능력치</b> (무기 = 공격 · 힘 · 원거리 · 마법 / 방어구 = 방어 + 공격 계열 일부 / 장신구 = 공격 계열 위주)</div>
    <div class="mut">15성부터: 실패하면 1성 하락 (15 · 20 · 25성은 하락 없음) · 💥 파괴되면 12성으로 (22성부터는 20성으로) · 연속 2번 하락하면 다음은 찬스 타임 (100% 성공)</div>
    <div style="margin-top:6px">강화 보너스: <span class="sp">${bonusTxt || '없음'}</span></div>`);
  p.appendChild(top);
  // 자동 강화
  const a = h('div', 'card', `<b>🤖 자동 강화</b> ${f.auto ? '<span class="sp">진행 중…</span>' : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px">
      <label class="tg">목표 <select class="sft">${SF_TARGETS.map((t) => `<option value="${t}"${f.target === t ? ' selected' : ''}>${t}성</option>`).join('')}</select></label>
      <label class="tg">부위 <select class="sfs"><option value="all"${f.slot === 'all' ? ' selected' : ''}>모든 부위 (낮은 것부터)</option>${SLOT_IDS_SF.map((sl) => `<option value="${sl}"${f.slot === sl ? ' selected' : ''}>${SLOTS_SF[sl].icon} ${SLOTS_SF[sl].name}</option>`).join('')}</select></label>
      <label class="tg">골드 남기기 <select class="sfr">${[0, 0.1, 0.3, 0.5, 0.8].map((v) => `<option value="${v}"${(f.reserve || 0) === v ? ' selected' : ''}>${v ? pct(v, 0) : '안 남김'}</option>`).join('')}</select></label>
      <label class="tg"><input type="checkbox" class="sfp"${f.prot ? ' checked' : ''}> 🛡 파괴 방지 (15~21성 · 비용 2배)</label>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px"><button class="btn ${f.auto ? '' : 'pri'} sfa">${f.auto ? '■ 자동 강화 멈춤' : '▶ 자동 강화 시작'}</button></div>
    <div class="mut">0.25초마다 1번 강화 · 목표에 닿거나 골드가 남겨 둘 만큼 줄면 멈춤 · 시작할 때 가진 골드 기준</div>`);
  a.querySelector('.sft').addEventListener('change', (e) => { f.target = +e.target.value; });
  a.querySelector('.sfs').addEventListener('change', (e) => { f.slot = e.target.value; });
  a.querySelector('.sfr').addEventListener('change', (e) => { f.reserve = +e.target.value; });
  a.querySelector('.sfp').addEventListener('change', (e) => { f.prot = e.target.checked; });
  a.querySelector('.sfa').addEventListener('click', () => { if (f.auto) g.sfAutoStop('직접 멈춤'); else g.sfAutoStart(); ui._rT = 0; });
  p.appendChild(a);
  // 부위 목록
  for (const sl of SLOT_IDS_SF) {
    const k = g.sfStars(sl), it = ITEMS[s.equip[sl]];
    const r = sfRate(k), prot = f.prot && sfCanProt(k), cost = sfCost(k, prot);
    const ch = (f.chance[sl] || 0) >= 2;
    const info = k >= SF_MAX ? '<span class="sp">최대 강화!</span>'
      : ch ? '<span class="sp">🎯 찬스 타임: 다음 강화 100% 성공</span>'
      : `성공 ${pct(r.ok, 1)} · ${sfDrops(k) ? '실패 시 하락' : '실패 시 유지'} ${pct(1 - r.ok - (prot ? 0 : r.brk), 1)}${r.brk ? ` · 💥 파괴 ${prot ? '방지됨' : pct(r.brk, 1)}` : ''} · 💰${fmt(cost)}`;
    const row = h('div', 'row', `<div class="ic">${SLOTS_SF[sl].icon}</div><div class="info"><div class="nm">${SLOTS_SF[sl].name} <b>${k}성</b> <span class="mut">${it ? it.name : '비어 있음'}</span></div><div>${starBar(k)}</div><div class="mut">${info}</div></div><button class="btn sm pri"${k >= SF_MAX || s.coins < cost || f.auto ? ' disabled' : ''}>⭐ 강화</button>`);
    row.querySelector('button').addEventListener('click', () => { g.sfTry(sl); ui._rT = 0; });
    p.appendChild(row);
  }
  if (f.log.length) p.appendChild(h('div', 'card mut', `<b>최근 결과</b><br>${f.log.map((x) => `${SLOTS_SF[x.sl].icon} ${x.k}성 → ${x.nk}성 · ${x.txt}`).join('<br>')}`));
  // 확률표
  const rows = [];
  for (let k = 0; k < SF_MAX; k++) { const r = sfRate(k); rows.push(`${k}→${k + 1}성: 성공 ${pct(r.ok, 1)}${r.brk ? ` · 파괴 ${pct(r.brk, 1)}` : ''} · 💰${fmt(sfCost(k))} · 별 하나 +${Math.round(sfGain(k + 1))}`); }
  const t = h('details', 'card mut', `<summary>📋 확률 · 비용표</summary>${rows.join('<br>')}`);
  p.appendChild(t);
}
U.townExtra = [...U.townExtra, ['star', '⭐ 강화']];
U.townFns.star = townStar;
const _sigSF = U.sigX;
U.sigX = function () { const f = this.g.s.sf; const on = this.tab === 'town' && this.town === 'star'; return [..._sigSF.call(this), f ? JSON.stringify(f.st) : '', f?.auto, on ? f?.tries : 0, f?.prot, f?.target, f?.slot, f?.reserve]; };

// ====================== 🐾 펫 레벨: 같은 펫을 또 얻으면 레벨 업 (최대 10 · 레벨마다 효과 +12%) ======================
import { SKILLS as SKILLS_A, RARITY as RARITY_A, PET as PET_A, SPECIAL_NAMES as SPN_A, FLAT_SP as FSP_A, huntTier as huntTier_A } from './data.js';
const PET_MAX = 10;
P.PET_MAX = PET_MAX;
const petMult = (lv) => 1 + 0.12 * (Math.max(1, lv) - 1);
P.petLv = function (id) { return this.s.pets.includes(id) ? Math.min(PET_MAX, this.s.petLv?.[id] || 1) : 0; };
P.petFx = function (id, lv) {
  const pet = PET_A[id];
  if (!pet) return {};
  const m = petMult(lv ?? this.petLv(id));
  const o = {};
  for (const [k, v] of Object.entries(pet.fx || {})) o[k] = FSP_A.has(k) ? Math.round(v * m) : Math.round(v * m * 10000) / 10000;
  return o;
};
P.petUp = function (pet, quiet = false) {
  if (!pet || !this.s.pets.includes(pet.id)) return false;
  const lv = this.petLv(pet.id);
  if (lv >= PET_MAX) return false;
  this.s.petLv = { ...(this.s.petLv || {}), [pet.id]: lv + 1 };
  this.dirty();
  if (!quiet || lv + 1 >= 5) this.toast(`🐾 펫 레벨 업! ${pet.icon} ${pet.name} Lv ${lv + 1}`, 'pet');
  if (lv + 1 === PET_MAX && this.s.cele !== false) this.celebrate(`👑 ${pet.icon} ${pet.name} 최대 레벨!`);
  return true;
};
// 이미 가진 펫이 또 나오면 → 레벨 업 (호루라기 보너스도 적용)
const _tryPetLv = P.tryPet;
P.tryPet = function (pet, mul = 1) {
  if (!this.s.pets.includes(pet.id)) return _tryPetLv.call(this, pet, mul);
  if ((this.s.whistle || 0) > 0 && /boss/.test(pet.src)) mul *= 1 + WHISTLE_PET;
  if (this.petLv(pet.id) < PET_MAX && Math.random() < pet.p * mul) this.petUp(pet);
};

// ====================== 🏆 업적: 목표를 이루면 고정 능력치 영구 보상 ======================
const ACH_V = [2, 4, 8, 16, 32, 64, 128]; // 등급별 보상 크기
const ACH_ST = ['atk', 'str', 'def', 'rng', 'mag'];
const ACH_CATS = { fight: '⚔️ 전투', boss: '👑 정복', lvl: '📈 성장', col: '📚 수집', gear: '🛡️ 장비', pet: '🐾 펫', chal: '🗼 도전', life: '🌱 생활', fun: '🎲 재미' };
export const ACHS = [];
const add = (cat, id, icon, name, desc, grade, fn) => ACHS.push({ cat, id, icon, name, desc, grade: Math.min(6, grade), fn });
const ladder = (cat, id, icon, names, desc, steps, fn, g0 = 0) => steps.forEach((n, i) => add(cat, `${id}_${n}`, icon, names[i] || `${names[names.length - 1]} ${i + 1}`, desc(n), g0 + i, (g) => [fn(g), n]));
const famT = (g, fam) => { let n = 0; for (let t = 0; t < TIERS.length; t++) if ((g.s.log.got?.[fam + t] || 0) > 0 || g.have(fam + t) > 0) n++; return n; };
const gearT = (g, ty) => { const b = g._achGear(); let n = 0; for (let t = 0; t < TIERS.length; t++) if (b.has(ty + t)) n++; return n; };
P._achGear = function () {
  const keys = Object.keys(this.s.log.gear || {});
  if (this._agK === keys.length) return this._agS;
  const st = new Set();
  for (const id of keys) st.add(id.replace(/_r\d+$/, ''));
  for (const id of Object.keys(this.s.bank)) if (ITEMS[id]?.kind === 'gear') st.add(ITEMS[id].base);
  for (const id of Object.values(this.s.equip)) if (ITEMS[id]) st.add(ITEMS[id].base);
  this._agK = keys.length; this._agS = st;
  return st;
};
const maxRar = (g) => { let r = 0; for (const id of [...Object.keys(g.s.log.gear || {}), ...Object.values(g.s.equip)]) r = Math.max(r, ITEMS[id]?.r || 0); return r; };
const totalLv = (g) => SKILLS_A.reduce((a, k) => a + g.lvl(k.id), 0);

// ⚔️ 전투
ladder('fight', 'kill', '🗡️', ['첫 사냥', '사냥꾼 입문', '백전노장', '만인 처치', '전설의 학살자', '백만 대군 섬멸'], (n) => `몬스터 ${fmt(n)}마리 처치`, [10, 100, 1000, 10000, 100000, 1000000], (g) => g.s.stats.kills || 0);
ladder('fight', 'boss', '👑', ['보스 사냥 입문', '보스 킬러', '보스 수집가', '보스의 악몽', '보스 학살자'], (n) => `보스 ${fmt(n)}번 처치`, [1, 10, 100, 1000, 10000], (g) => g.s.log.bossKills || 0);
ladder('fight', 'one', '🎯', ['단골손님', '천적', '멸종 위기'], (n) => `같은 몬스터 하나를 ${fmt(n)}번 처치`, [100, 1000, 10000], (g) => Math.max(0, ...Object.values(g.s.kills || {})), 1);
ladder('fight', 'hunt', '🏹', ['전설의 사냥꾼', '사냥터의 왕', '모든 숲의 주인'], (n) => `사냥꾼 숙련 최고 단계 몬스터 ${n}종`, [1, 10, 50], (g) => Object.values(g.s.kills || {}).filter((k) => huntTier_A(k) >= 5).length, 2);
ladder('fight', 'dead', '💀', ['다시 일어나라', '넘어져도 괜찮아', '불사조', '죽음과 친구'], (n) => `${fmt(n)}번 쓰러지기 (실패도 경험!)`, [1, 10, 100, 1000], (g) => g.s.stats.deaths || 0);
ladder('fight', 'food', '🍖', ['간식 타임', '대식가', '먹방 유튜버', '위장이 우주'], (n) => `음식 ${fmt(n)}개 먹기`, [100, 1000, 10000, 100000], (g) => g.s.log.food || 0);
// 👑 정복: 지역마다 보스 처치 + 레벨 구간마다 전부 처치
for (const z of ZONES) {
  const b = z.mons[3];
  add('boss', 'zone_' + z.z, b.icon, `${z.n} 정복`, `${z.n}의 보스 ${b.name} 처치 (Lv ${b.lvl})`, Math.min(6, Math.floor(z.lvl / 40)), (g) => [g.s.kills?.[b.id] ? 1 : 0, 1]);
  add('boss', 'zall_' + z.z, '🗺️', `${z.n} 소탕`, `${z.n}의 몬스터 4종 모두 처치`, Math.min(6, Math.floor(z.lvl / 50)), (g) => [z.mons.filter((m) => g.s.kills?.[m.id]).length, 4]);
}
[25, 50, 75, 100, 125, 150, 175, 200, 230].forEach((L, i) => {
  const zs = ZONES.filter((z) => z.lvl <= L);
  add('boss', 'zb_' + L, '🏆', `Lv ${L} 지역의 지배자`, `Lv ${L} 이하 지역 보스 ${zs.length}마리 전부 처치`, 1 + Math.floor(i * 0.7), (g) => [zs.filter((z) => g.s.kills?.[z.mons[3].id]).length, zs.length]);
});
// 📈 성장
ladder('lvl', 'cl', '⚔️', ['견습 모험가', '모험가', '숙련 모험가', '베테랑', '영웅', '전설', '신화', '별의 수호자', '개척의 끝'], (n) => `전투 레벨 ${n} 달성`, [10, 25, 50, 75, 100, 125, 150, 175, 200], (g) => g.combatLevel());
for (const k of SKILLS_A) ladder('lvl', 'sk_' + k.id, k.icon, [`${k.name} 입문`, `${k.name} 숙련`, `${k.name} 달인`, `${k.name} 장인`, `${k.name} 대가`, `${k.name}의 신`], (n) => `${k.name} 레벨 ${n}`, [25, 50, 75, 100, 150, 200], (g) => g.lvl(k.id));
ladder('lvl', 'tot', '📊', ['다재다능', '만능 재주꾼', '르네상스인', '모든 것의 달인'], (n) => `모든 스킬 레벨 합 ${fmt(n)}`, [200, 600, 1200, 2400], (g) => totalLv(g), 1);
// 📚 수집: 재료마다 등급 모으기
const FAMS = [['log', '목재', '🪵'], ['ore', '광석', '🪨'], ['bar', '주괴', '🧱'], ['gem', '보석', '💎'], ['raw', '날생선', '🐟'], ['food', '요리', '🍲'], ['hide', '가죽', '🟫'], ['cloth', '마력 천', '🧵'], ['bone', '뼈', '🦴'], ['herb', '약초', '🌿'], ['nest', '새 둥지', '🪺'], ['gembag', '보석 주머니', '👝'], ['chest', '물속 상자', '🧰'], ['sstone', '소환석', '🔮']];
for (const [fam, n, ic] of FAMS) {
  add('col', 'fam5_' + fam, ic, `${n} 수집가`, `${n} 5등급 모으기`, 0, (g) => [famT(g, fam), 5]);
  add('col', 'fam12_' + fam, ic, `${n} 박사`, `${n} 12등급 모으기`, 2, (g) => [famT(g, fam), 12]);
  add('col', 'famall_' + fam, ic, `${n} 도감 완성`, `${n} 전 등급(${TIERS.length}) 모으기`, 4, (g) => [famT(g, fam), TIERS.length]);
}
for (const [ty, gd] of Object.entries(GEAR)) {
  add('col', 'g7_' + ty, gd.icon, `${gd.name} 수집 시작`, `${gd.name} 7등급 모으기`, 1, (g) => [gearT(g, ty), 7]);
  add('col', 'gall_' + ty, gd.icon, `${gd.name} 도감 완성`, `${gd.name} 전 등급(${TIERS.length}) 모으기`, 5, (g) => [gearT(g, ty), TIERS.length]);
}
ladder('col', 'gtypes', '📦', ['장비 수집 입문', '장비 창고', '장비 박물관', '모든 장비의 주인'], (n) => `서로 다른 장비 ${n}종 얻기`, [20, 100, 250, 480], (g) => g._achGear().size);
ladder('col', 'mus', '🏛️', ['기증 첫걸음', '후원자', '박물관의 기둥', '박물관장'], (n) => `박물관 장비 ${n}종 기증`, [5, 30, 100, 300], (g) => Object.keys(g.s.museum || {}).length);
ladder('col', 'mul', '🏺', ['전리품 기증', '전리품 전시', '전리품 대전시회'], (n) => `박물관 전리품 ${n}종 기증`, [10, 60, 200], (g) => Object.keys(g.s.museumLoot || {}).length, 1);
// 🛡️ 장비
RARITY_A.slice(1).forEach((R, i) => add('gear', 'rar_' + R.r, '🌟', `${R.n} 등급 손에 넣다`, `${R.n} 등급 장비 얻기`, Math.min(6, i), (g) => [maxRar(g) >= R.r ? 1 : 0, 1]));
add('gear', 'full12', '🧍', '완전 무장', '장비 12칸 모두 착용', 1, (g) => [SLOT_IDS.filter((sl) => g.s.equip[sl]).length, SLOT_IDS.length]);
[3, 5, 7].forEach((r, i) => add('gear', 'fullr_' + r, '✨', `온몸이 ${RARITY_A[r - 1].n}`, `장비 12칸 모두 ${RARITY_A[r - 1].n} 등급 이상`, 2 + i * 2, (g) => [SLOT_IDS.filter((sl) => (ITEMS[g.s.equip[sl]]?.r || 0) >= r).length, SLOT_IDS.length]));
ladder('gear', 'pow', '💪', ['힘이 솟는다', '강자', '강호', '절대 강자', '무적', '초월자'], (n) => `전투력 ${fmt(n)} 달성`, [100, 500, 1000, 3000, 10000, 30000], (g) => g.power());
ladder('gear', 'sf', '⭐', ['첫 별', '반짝반짝', '별빛 장인', '스타', '슈퍼스타', '은하수', '별 그 자체'], (n) => `한 부위 ${n}성 달성`, [5, 10, 15, 20, 22, 25, 30], (g) => Math.max(0, ...SLOT_IDS.map((sl) => g.sfStars?.(sl) || 0)));
ladder('gear', 'sfall', '🌌', ['고르게 반짝', '빈틈없는 별', '별자리 완성', '온몸이 별'], (n) => `모든 부위 ${n}성 이상`, [5, 10, 15, 20], (g) => Math.min(...SLOT_IDS.map((sl) => g.sfStars?.(sl) || 0)), 1);
ladder('gear', 'brk', '💥', ['펑!', '불꽃놀이', '파괴의 신', '아무도 나를 막을 수 없다'], (n) => `강화 파괴 ${fmt(n)}번 (눈물…)`, [1, 10, 100, 1000], (g) => g.s.sf?.breaks || 0);
ladder('gear', 'sftry', '🔨', ['망치질', '두드리고 또 두드리고', '대장장이의 집념'], (n) => `강화 ${fmt(n)}번 시도`, [100, 1000, 10000], (g) => g.s.sf?.tries || 0);
// 🐾 펫
ladder('pet', 'pets', '🐾', ['첫 친구', '작은 동물원', '펫 부자', '동물의 왕국', '노아의 방주'], (n) => `펫 ${n}마리 모으기`, [1, 5, 15, 35, PETS.length], (g) => g.s.pets.length);
ladder('pet', 'plv', '🍖', ['무럭무럭', '든든한 동료', '전설의 펫'], (n) => `펫 하나를 Lv ${n}까지`, [3, 5, 10], (g) => Math.max(0, ...g.s.pets.map((id) => g.petLv(id))), 1);
ladder('pet', 'plv10', '👑', ['최강 콤비', '최강 군단', '펫 마스터'], (n) => `Lv 10 펫 ${n}마리`, [1, 5, 20], (g) => g.s.pets.filter((id) => g.petLv(id) >= PET_MAX).length, 3);
add('pet', 'zpets', '🐲', '보스의 아기들', '지역 보스 펫 모두 모으기', 6, (g) => { const l = PETS.filter((x) => x.src.startsWith('boss:')); return [l.filter((x) => g.s.pets.includes(x.id)).length, l.length]; });
// 🗼 도전
ladder('chal', 'tw', '🗼', ['탑 오르기', '높은 곳', '구름 위', '하늘 끝', '성층권', '별에 닿다', '탑의 주인'], (n) => `별의 탑 ${n}층 돌파`, [10, 20, 30, 50, 75, 100, 150], (g) => g.s.tw?.best || 0);
ladder('chal', 'wb', '🐋', ['고래 사냥', '고래잡이', '고래의 천적', '바다의 지배자'], (n) => `세계 보스 ${n}번 도전`, [1, 10, 50, 200], (g) => g.s.wb?.runs || 0);
ladder('chal', 'sb', '🌳', ['스킬 보스 격파', '스킬 보스 사냥꾼', '스킬 보스의 재앙'], (n) => `스킬 보스 ${n}번 격파`, [1, 10, 100], (g) => Object.values(g.s.sbWins || {}).reduce((a, b) => a + b, 0), 1);
ladder('chal', 'rq', '📜', ['심부름꾼', '해결사', '마을의 영웅', '의뢰의 전설'], (n) => `의뢰 ${fmt(n)}개 완료`, [10, 100, 1000, 10000], (g) => g.s.rq?.done || 0);
// 🌱 생활
ladder('life', 'act', '⚙️', ['부지런한 손', '일벌레', '멈추지 않는 기계'], (n) => `스킬 행동 ${fmt(n)}번`, [1000, 100000, 1000000], (g) => g.s.stats.actions || 0);
ladder('life', 'tool', '🧰', ['도구 장만', '좋은 도구', '명품 도구', '전설의 도구'], (n) => `모든 도구 ${n}단계 이상`, [3, 7, 14, 21], (g) => Math.min(...Object.keys(TOOLS).map((sk) => (ITEMS[g.s.tools?.[sk]]?.t ?? -1) + 1)), 1);
ladder('life', 'pray', '🙏', ['기도의 시작', '경건한 자', '성자', '신의 대리인'], (n) => `기도 ${n}개 열기`, [5, 12, 20, PRAYERS.length], (g) => g.openPrayers().length);
ladder('life', 'coin', '💰', ['용돈', '부자', '재벌', '황금 산', '화폐 그 자체'], (n) => `골드 ${fmt(n)} 모으기 (가진 골드)`, [10000, 1000000, 100000000, 10000000000, 1000000000000], (g) => g.s.coins || 0);
ladder('life', 'time', '⏳', ['한 시간의 여행', '하루 종일', '진정한 개척자', '시간의 방랑자'], (n) => `게임 시간 ${fmt(n)}시간`, [1, 24, 100, 1000], (g) => (g.s.log.time || 0) / 3600);
// 🎲 재미
ladder('fun', 'cp', '🎟', ['쿠폰 맛보기', '쿠폰 수집가', '쿠폰의 노예'], (n) => `쿠폰 ${fmt(n)}번 사용`, [1, 10, 100], (g) => g.s.cpUsed || 0);
add('fun', 'broke', '🪙', '빈털터리', '골드가 100 미만이 되기 (강화를 너무 했나?)', 0, (g) => [(g.s.coins || 0) < 100 ? 1 : 0, 1]);
add('fun', 'nofood', '🥲', '배고픈 모험가', '음식 없이 전투하기 (가방에 음식 0개)', 0, (g) => [g.s.hunt && !Object.keys(g.s.bank).some((id) => ITEMS[id]?.kind === 'food') ? 1 : 0, 1]);
add('fun', 'naked', '🩲', '맨몸의 용사', '장비 하나도 없이 전투하기', 0, (g) => [g.s.hunt && !SLOT_IDS.some((sl) => g.s.equip[sl]) ? 1 : 0, 1]);
add('fun', 'chance', '🎯', '찬스 타임!', '강화 찬스 타임 성공', 1, (g) => [g.s.sf?.log?.some((x) => x.res === 'chance') || g.s.achFlags?.chance ? 1 : 0, 1]);
add('fun', 'all3', '🔀', '삼위일체', '근접 · 원거리 · 마법 모두 레벨 50', 2, (g) => [[Math.min(g.lvl('atk'), g.lvl('str')), g.lvl('rng'), g.lvl('mag')].filter((x) => x >= 50).length, 3]);
add('fun', 'ach50', '🏅', '업적 사냥꾼', '업적 50개 달성', 2, (g) => [Object.keys(g.s.ach || {}).length, 50]);
add('fun', 'ach150', '🎖️', '업적 수집광', '업적 150개 달성', 4, (g) => [Object.keys(g.s.ach || {}).length, 150]);
add('fun', 'ach300', '🏆', '완벽주의자', '업적 300개 달성', 6, (g) => [Object.keys(g.s.ach || {}).length, 300]);
// 보상: 공격 → 힘 → 방어 → 원거리 → 마법 순서로 고정 수치 (방어는 1.5배)
ACHS.forEach((a, i) => { const k = ACH_ST[i % 5]; a.rw = { k: k + 'Flat', v: Math.round(ACH_V[a.grade] * (k === 'def' ? 1.5 : 1)) }; a.pts = (a.grade + 1) * 10; });
const ACH_BY = Object.fromEntries(ACHS.map((a) => [a.id, a]));

P.achBonus = function () {
  const done = this.s.ach || {};
  const n = Object.keys(done).length;
  if (this._achB?.n === n) return this._achB.v;
  const v = {};
  for (const id of Object.keys(done)) { const a = ACH_BY[id]; if (a) v[a.rw.k] = (v[a.rw.k] || 0) + a.rw.v; }
  this._achB = { n, v };
  return v;
};
const _extraACH = P.extraSources;
P.extraSources = function () { return [..._extraACH.call(this), this.achBonus()]; };
P.achProg = function (a) { try { const [c, n] = a.fn(this); return { c: Number.isFinite(c) ? c : 0, n }; } catch (e) { return { c: 0, n: 1 }; } };
P.achCheck = function () {
  const s = this.s;
  s.ach ||= {};
  let got = 0;
  for (const a of ACHS) {
    if (s.ach[a.id]) continue;
    const { c, n } = this.achProg(a);
    if (c >= n) {
      s.ach[a.id] = Date.now();
      got++;
      if (got <= 3) this.toast(`🏆 업적 달성! ${a.icon} ${a.name} · ${SPN_A[a.rw.k]} +${a.rw.v}`, 'pet');
      if (a.grade >= 4 && this.s.cele !== false) this.celebrate(`🏆 ${a.name}`);
    }
  }
  if (got > 3) this.toast(`🏆 업적 ${got}개 달성!`, 'pet');
  if (got) this.dirty();
  return got;
};
// 1.5초마다 (실제 시간) 확인
const _updACH = P.update;
P.update = function (dt) {
  _updACH.call(this, dt);
  const now = performance.now();
  if (now - (this._achT || 0) > 1500) { this._achT = now; this.achCheck(); }
};
const _sfTryA = P.sfTry;
P.sfTry = function (...a) { const r = _sfTryA.apply(this, a); if (r === 'chance') this.s.achFlags = { ...(this.s.achFlags || {}), chance: 1 }; return r; };

// ---- 화면 ----
function townAch(ui, p, g, s) {
  s.ach ||= {};
  const cat = ui.achCat || 'near';
  const doneN = Object.keys(s.ach).length;
  const pts = ACHS.filter((a) => s.ach[a.id]).reduce((x, a) => x + a.pts, 0);
  const b = g.achBonus();
  const bt = ACH_ST.filter((k) => b[k + 'Flat']).map((k) => `${STATS[k].name} +${fmt(b[k + 'Flat'])}`).join(', ');
  p.appendChild(h('div', 'card', `<b>🏆 업적</b> <span class="mut">${doneN} / ${ACHS.length} 달성 · 업적 점수 ${fmt(pts)}</span>
    <div class="bar" style="margin:6px 0"><div style="width:${pct(doneN / ACHS.length)}"></div></div>
    <div>업적 보너스 (영구): <span class="sp">${bt || '없음'}</span></div>
    <div class="mut">달성하면 바로 고정 능력치를 받습니다 (공격 → 힘 → 방어 → 원거리 → 마법 순서 · 어려운 업적일수록 큼)</div>`));
  const seg = h('div', 'seg achcat');
  for (const [k, n] of [['near', '🔥 거의 다'], ...Object.entries(ACH_CATS), ['done', '✅ 달성']]) {
    const tot = k === 'near' || k === 'done' ? '' : ` ${ACHS.filter((a) => a.cat === k && s.ach[a.id]).length}/${ACHS.filter((a) => a.cat === k).length}`;
    const bb = h('button', k === cat ? 'on' : '', `${n}<small>${tot}</small>`);
    bb.addEventListener('click', () => { ui.achCat = k; ui.render(true); });
    seg.appendChild(bb);
  }
  p.appendChild(seg);
  let list;
  if (cat === 'near') list = ACHS.filter((a) => !s.ach[a.id]).map((a) => ({ a, pr: g.achProg(a) })).map((x) => ({ ...x, f: Math.min(1, x.pr.c / x.pr.n) })).sort((x, y) => y.f - x.f || x.a.grade - y.a.grade).slice(0, 25);
  else if (cat === 'done') list = ACHS.filter((a) => s.ach[a.id]).sort((x, y) => s.ach[y.id] - s.ach[x.id]).map((a) => ({ a, pr: g.achProg(a), f: 1 }));
  else list = ACHS.filter((a) => a.cat === cat).map((a) => ({ a, pr: g.achProg(a) })).map((x) => ({ ...x, f: s.ach[x.a.id] ? 1 : Math.min(1, x.pr.c / x.pr.n) })).sort((x, y) => !!s.ach[x.a.id] - !!s.ach[y.a.id] || y.f - x.f);
  if (!list.length) p.appendChild(h('div', 'card mut', '아직 없습니다'));
  for (const { a, pr, f } of list) {
    const ok = !!s.ach[a.id];
    const prog = ok ? '✅ 달성' : `${fmt(Math.min(pr.c, pr.n))} / ${fmt(pr.n)}`;
    const r = h('div', 'row ach' + (ok ? ' on' : ''), `<div class="ic">${a.icon}</div><div class="info"><div class="nm">${a.name} <span class="grade g${a.grade}">${'★'.repeat(a.grade + 1)}</span></div><div class="mut">${a.desc}</div>
      <div class="bar sm"><div style="width:${pct(f)}"></div></div><div class="mut">${prog} · 보상 <span class="sp">${SPN_A[a.rw.k]} +${a.rw.v}</span></div></div>`);
    p.appendChild(r);
  }
  if (cat === 'done' && list.length > 60) while (p.children.length > 63) p.lastElementChild.remove();
}
U.townExtra = [...U.townExtra, ['ach', '🏆 업적']];
U.townFns.ach = townAch;
const _sigACH = U.sigX;
U.sigX = function () { const s = this.g.s; return [..._sigACH.call(this), Object.keys(s.ach || {}).length, this.tab === 'town' && this.town === 'ach' ? Math.floor(performance.now() / 5000) : 0]; }; // 업적 화면 진행도는 5초마다

// ====================== 렉 줄이기 ======================
// 능력치 묶음(profile)은 장비 · 보너스가 바뀌지 않으면 30번까지 다시 씀 (전투 틱마다 새로 계산하지 않음)
const _profL = P.profile;
P.profile = function () {
  const c = this.rt.cache;
  if (c && this._pfC === c && this._pfN < 30) { this._pfN++; return this._pf; }
  const p = _profL.call(this);
  this._pf = p; this._pfC = this.rt.cache; this._pfN = 0;
  return p;
};
// 게임 진행 중에 돌아가는 자동 기능은 실제 시간으로 간격을 둠 (빠른 배속에서도 초당 수십 번 돌지 않게)
const _updL = P.update;
P.update = function (dt) { this._inUpd = true; try { return _updL.call(this, dt); } finally { this._inUpd = false; } };
const throttleReal = (name, ms) => {
  const o = P[name];
  if (!o) return;
  P[name] = function (...a) {
    if (!this._inUpd) return o.apply(this, a); // 버튼으로 부른 건 바로
    const now = performance.now(), k = '_thr_' + name;
    if (now - (this[k] || 0) < ms) return undefined;
    this[k] = now;
    return o.apply(this, a);
  };
};
throttleReal('autoDonate', 3000);
throttleReal('autoQuest', 1000);
throttleReal('autoBest', 5000);
throttleReal('combineAll', 3000);
// 자동 조합 확인용 목록도 진행 중에는 3초 동안 재사용
const _combinableL = P.combinable;
P.combinable = function () {
  if (!this._inUpd) return _combinableL.call(this);
  const now = performance.now();
  if (!this._cbL || now - this._cbT > 3000) { this._cbL = _combinableL.call(this); this._cbT = now; }
  return this._cbL;
};
// 화면을 누르면 가방 변화도 바로 다시 그림
if (typeof document !== 'undefined') document.addEventListener('click', (e) => { if (e.target.closest?.('#panel') && window.ui) window.ui._bkT = 0; }, true);
// 장비를 바꿔 볼 때마다 다시 계산하던 보너스들 기억해 두기 (장비와 상관없는 것들)
const sumKey = (o) => { let n = 0, t = 0; for (const k in o || {}) { n++; t += +o[k] || 0; } return n + ':' + t; };
const _openPrL = P.openPrayers;
P.openPrayers = function () {
  const k = this.lvl('div') + '|' + (this.s.tomes || []).length;
  if (this._opK !== k) { this._opK = k; this._opV = _openPrL.call(this); }
  return this._opV;
};
const _musBL = P.museumBonus;
P.museumBonus = function (style) {
  const st = style ?? this.museumStyle();
  const k = st + '|' + sumKey(this.s.museum);
  this._mbC ||= new Map();
  if (this._mbK !== sumKey(this.s.museum)) { this._mbK = sumKey(this.s.museum); this._mbC.clear(); }
  if (!this._mbC.has(k)) this._mbC.set(k, _musBL.call(this, st));
  return this._mbC.get(k);
};
const _mlbL = P.museumLootBonus;
P.museumLootBonus = function () {
  const k = sumKey(this.s.museumLoot);
  if (this._mlK !== k) { this._mlK = k; this._mlV = _mlbL.call(this); }
  return this._mlV;
};
const _talBL = P.talentBonus;
if (_talBL) P.talentBonus = function () {
  const k = sumKey(this.s.talents);
  if (this._tbK !== k) { this._tbK = k; this._tbV = _talBL.call(this); }
  return this._tbV;
};
// 떠오르는 피해 숫자: 배속이 높아도 한쪽당 0.2초에 하나만 (화면에 숫자가 쏟아져 폰이 느려지는 것 방지)
const _fxL = P.fx;
P.fx = function (at, text, kind) {
  if (this.quiet) return;
  const now = performance.now(), k = at === 'hero' ? '_fxH' : '_fxM';
  if (kind !== 'loot' && now - (this[k] || 0) < 200) return;
  this[k] = now;
  return _fxL.call(this, at, text, kind);
};

// ====================== 렉 줄이기 3: 최적 장비 찾기 가볍게 ======================
// 펫 효과 합계는 펫 · 펫 레벨이 바뀔 때만 다시 계산
P.petsFxSum = function () {
  const k = this.s.pets.length + '|' + sumKey(this.s.petLv);
  if (this._pfsK === k) return this._pfsV;
  const o = {};
  for (const id of this.s.pets) for (const [kk, v] of Object.entries(this.petFx(id))) o[kk] = (o[kk] || 0) + v;
  this._pfsK = k; this._pfsV = o;
  return o;
};
// 전투 방식별 대략 점수 (후보를 고르는 데만 사용 · 실제 비교는 전투력으로)
const roughScore = (it, style) => {
  const st = it.st || {};
  const off = style === 'melee' ? (st.atk || 0) + (st.str || 0) : style === 'ranged' ? 2 * (st.rng || 0) : 2 * (st.mag || 0);
  const v = off + 0.8 * (st.def || 0) + 3000 * ((st.ls || 0) + (st.dr || 0));
  return it.slot === 'weapon' ? v / (it.speed || 2.4) : v;
};
const LO_TOP = 5; // 부위마다 대략 점수 상위 5개만 실제로 껴 봄
P.bestLoadout = function (style) {
  const s = this.s, eq0 = { ...s.equip };
  const pool = {};
  for (const id of new Set([...Object.keys(s.bank), ...Object.values(eq0)])) {
    const it = ITEMS[id];
    if (it?.kind !== 'gear' || !this.canEquip(id)) continue;
    if (it.slot === 'weapon' && it.style !== style) continue;
    (pool[it.slot] ||= []).push(id);
  }
  for (const sl of Object.keys(pool)) {
    const l = pool[sl].sort((a, b) => roughScore(ITEMS[b], style) - roughScore(ITEMS[a], style)).slice(0, LO_TOP);
    if (eq0[sl] && !l.includes(eq0[sl]) && (sl !== 'weapon' || ITEMS[eq0[sl]]?.style === style)) l.push(eq0[sl]);
    pool[sl] = l;
  }
  const weapons = pool.weapon || [];
  if (!weapons.length) return null;
  const ev = (eq) => { s.equip = eq; this.dirty(); return this.powerRaw(); };
  const eq = { ...eq0 };
  let bw = null, bp = -1;
  try {
    for (const w of weapons) { const pw = ev({ ...eq, weapon: w }); if (pw > bp) { bp = pw; bw = w; } }
    eq.weapon = bw;
    for (const sl of SLOT_IDS) {
      if (sl === 'weapon') continue;
      let cur = ev(eq), pk = eq[sl];
      for (const id of pool[sl] || []) { const pw = ev({ ...eq, [sl]: id }); if (pw > cur) { cur = pw; pk = id; } }
      if (pk) eq[sl] = pk;
    }
    return { eq, power: ev(eq) };
  } finally { s.equip = eq0; this.dirty(); }
};
// 모든 방식에서 약한지: 대략 점수로 확실히 약하면 바로 판정 (전투력 계산 생략)
const _wfaL = P.weakForAll;
P.weakForAll = function (id) {
  const it = ITEMS[id];
  if (!it || it.kind !== 'gear') return false;
  const lo = this.loadoutPowers();
  let clear = true;
  for (const st of ['melee', 'ranged', 'magic']) {
    const L = lo[st];
    if (!L) continue;
    if (it.slot === 'weapon' && it.style !== st) continue;
    const cur = ITEMS[L.eq[it.slot]];
    if (!cur || Object.values(L.eq).includes(id) || roughScore(it, st) >= 0.8 * roughScore(cur, st)) { clear = false; break; }
  }
  return clear ? true : _wfaL.call(this, id);
};

// ====================== ⭐ 강화창: 강화 · 자동 강화를 누르면 따로 뜨는 전용 창 ======================
// 결과 기록 (창이 열려 있는 동안의 이번 기록)
const _sfTryW = P.sfTry;
P.sfTry = function (sl, quiet) {
  const c0 = this.s.coins;
  const r = _sfTryW.call(this, sl, quiet);
  const S = this._sfSess;
  if (r && S) {
    S.n++; S.cost += c0 - this.s.coins;
    S[r === 'chance' ? 'ok' : r] = (S[r === 'chance' ? 'ok' : r] || 0) + 1;
    S.last = { ...this.s.sf.log[0], at: performance.now() };
  }
  return r;
};
const _sfStopW = P.sfAutoStop;
P.sfAutoStop = function (why, kind) { if (this._sfSess) this._sfSess.stop = why; return _sfStopW.call(this, why, kind); };
const SF_RES = { ok: ['성공!', 'ok'], chance: ['찬스 타임 성공!', 'ok'], keep: ['실패 (유지)', 'keep'], down: ['실패 (하락)', 'down'], break: ['💥 파괴', 'brk'] };
const sfNextTxt = (sl, k) => {
  if (k >= SF_MAX) return '최대 강화';
  const v = sfGain(k + 1), m = sfMix(sl), o = [];
  if (m.off) o.push(`공격·힘·원거리·마법 +${Math.round(v * m.off)}`);
  if (m.def) o.push(`방어 +${Math.round(v * m.def)}`);
  return o.join(' · ');
};
U.sfOpen = function (sl, auto = false) {
  const ui = this, g = this.g, f = g.sfInit();
  document.getElementById('sfWin')?.remove();
  clearInterval(this._sfWinT);
  g._sfSess = { n: 0, cost: 0, ok: 0, keep: 0, down: 0, break: 0, stop: null, coins0: g.s.coins };
  const st = { sl: sl || g.sfAutoPick() || 'weapon', auto, key: '' };
  const wrap = h('div', '', '');
  wrap.id = 'sfWin';
  wrap.innerHTML = '<div class="sfbox"></div>';
  document.body.appendChild(wrap);
  const box = wrap.querySelector('.sfbox');
  const close = () => { clearInterval(ui._sfWinT); wrap.remove(); g._sfSess = null; ui._rT = 0; ui.render(true); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  const draw = () => {
    const S = g._sfSess;
    if (!S) return;
    const A = st.auto;
    const sl2 = A ? (f.auto ? g.sfAutoPick() || st.sl : st.sl) : st.sl;
    st.sl = sl2;
    const k = g.sfStars(sl2), it = ITEMS[g.s.equip[sl2]];
    const r = sfRate(k), prot = f.prot && sfCanProt(k), cost = sfCost(k, prot);
    const ch = (f.chance[sl2] || 0) >= 2;
    const L = S.last && performance.now() - S.last.at < 1500 ? S.last : null;
    const res = L ? SF_RES[L.res] : null;
    // 같은 내용이면 다시 그리지 않음 (버튼 누르는 중 깜빡임 방지)
    const key = JSON.stringify([A, f.auto, sl2, k, g.s.coins, f.prot, f.target, f.slot, S.n, S.stop, !!L, ch]);
    if (key === st.key) return;
    st.key = key;
    const rate = k >= SF_MAX ? '<span class="sp">최대 강화!</span>' : ch ? '<span class="sp">🎯 찬스 타임: 이번 강화 100% 성공</span>'
      : `<div class="sfrt"><span class="ok">성공 ${pct(r.ok, 1)}</span><span>${sfDrops(k) ? '하락' : '유지'} ${pct(1 - r.ok - (prot ? 0 : r.brk), 1)}</span>${r.brk ? `<span class="brk">파괴 ${prot ? '방지됨' : pct(r.brk, 1)}</span>` : ''}</div>`;
    const slotSel = A ? '' : `<select class="sfsl">${SLOT_IDS_SF.map((x) => `<option value="${x}"${x === sl2 ? ' selected' : ''}>${SLOTS_SF[x].icon} ${SLOTS_SF[x].name} ${g.sfStars(x)}성</option>`).join('')}</select>`;
    const grid = SLOT_IDS_SF.map((x) => `<div class="${x === sl2 ? 'on' : ''}">${SLOTS_SF[x].icon}<b>${g.sfStars(x)}</b></div>`).join('');
    const sess = S.n ? `이번에 ${fmt(S.n)}번 · 성공 ${S.ok} · 유지 ${S.keep} · 하락 ${S.down} · 파괴 ${S.break} · 💰 -${fmt(S.cost)}` : '아직 강화하지 않음';
    box.innerHTML = `<div class="sfhd"><b>${A ? '🤖 자동 강화' : '⭐ 강화'}</b><button class="btn sm sfx">✕ 닫기</button></div>
      ${slotSel}
      <div class="sfmain">
        <div class="sfic">${SLOTS_SF[sl2].icon}</div>
        <div class="sfnm">${SLOTS_SF[sl2].name} <span class="mut">${it ? it.name : '비어 있음'}</span></div>
        <div class="sfk">${k}성 ${k < SF_MAX ? `<span class="mut">→</span> ${k + 1}성` : ''}</div>
        <div class="sfstars">${starBar(k)}</div>
        <div class="sfres ${res ? res[1] : ''}">${res ? `${L.k}성 → ${L.nk}성 · ${res[0]}` : '&nbsp;'}</div>
      </div>
      ${rate}
      <div class="mut" style="text-align:center">다음 별: ${sfNextTxt(sl2, k)}</div>
      <div class="mut" style="text-align:center">비용 💰${fmt(cost)} · 보유 💰${fmt(g.s.coins)}</div>
      <label class="tg" style="justify-content:center"><input type="checkbox" class="sfp"${f.prot ? ' checked' : ''}> 🛡 파괴 방지 (15~21성 · 비용 2배)</label>
      ${A ? `<div class="sfgrid">${grid}</div><div class="mut" style="text-align:center">목표 ${f.target}성 · ${f.slot === 'all' ? '모든 부위 (낮은 것부터)' : SLOTS_SF[f.slot].name}${S.stop ? ` · <b>멈춤: ${S.stop}</b>` : ''}</div>` : ''}
      <div class="mut" style="text-align:center">${sess}</div>
      <div class="sfbtns">${A
        ? `<button class="btn ${f.auto ? '' : 'pri'} big sfa">${f.auto ? '■ 자동 강화 멈춤' : '▶ 자동 강화 다시 시작'}</button>`
        : `<button class="btn pri big sfgo"${k >= SF_MAX || g.s.coins < cost || f.auto ? ' disabled' : ''}>⭐ 강화하기</button>`}</div>
      ${f.auto && !A ? '<div class="mut" style="text-align:center">자동 강화 중에는 직접 강화할 수 없습니다</div>' : ''}`;
    box.querySelector('.sfx').addEventListener('click', close);
    box.querySelector('.sfsl')?.addEventListener('change', (e) => { st.sl = e.target.value; st.key = ''; draw(); });
    box.querySelector('.sfp').addEventListener('change', (e) => { f.prot = e.target.checked; st.key = ''; draw(); });
    box.querySelector('.sfgo')?.addEventListener('click', () => { g.sfTry(st.sl, true); st.key = ''; draw(); });
    box.querySelector('.sfa')?.addEventListener('click', () => { if (f.auto) g.sfAutoStop('직접 멈춤'); else { S.stop = null; g.sfAutoStart(); } st.key = ''; draw(); });
    ui.noWrapSeg?.(box);
  };
  draw();
  this._sfWinT = setInterval(() => { if (!document.getElementById('sfWin')) return clearInterval(ui._sfWinT); draw(); }, 150);
};
// 강화 화면의 버튼: 바로 강화하지 않고 강화창을 띄움
const _townStarW = U.townFns.star;
U.townFns.star = function (ui, p, g, s) {
  _townStarW(ui, p, g, s);
  const f = g.sfInit();
  const sa = p.querySelector('.sfa');
  if (sa) {
    const nb = sa.cloneNode(true); sa.replaceWith(nb);
    nb.addEventListener('click', () => {
      if (f.auto) { ui.sfOpen(null, true); return; }
      if (g.sfAutoStart()) ui.sfOpen(null, true);
      ui._rT = 0;
    });
    if (f.auto) nb.textContent = '🤖 자동 강화 창 열기';
  }
  [...p.querySelectorAll('.row')].filter((r) => r.querySelector('button')?.textContent.includes('⭐ 강화')).forEach((row, i) => {
    const sl = SLOT_IDS_SF[i], b = row.querySelector('button');
    if (!sl || !b) return;
    const nb = b.cloneNode(true); nb.disabled = false; b.replaceWith(nb);
    nb.addEventListener('click', () => ui.sfOpen(sl, !!g.s.sf?.auto));
  });
};

// ====================== 화면 흔들림 막기 ======================
// 1) 상단 진행 패널: 같은 진행(같은 몬스터 · 같은 스킬)인 동안은 높이가 줄어들지 않음 (전리품 · 숫자 길이에 따라 위아래로 왔다갔다 하지 않게)
const _frameStab = U.frame;
U.frame = function () {
  _frameStab.call(this);
  const act = document.getElementById('act');
  if (!act) return;
  if (act._lockK !== act._k) { act._lockK = act._k; act._lockH = 0; act.style.minHeight = ''; }
  const hgt = act.offsetHeight;
  if (hgt > (act._lockH || 0)) { act._lockH = hgt; act.style.minHeight = hgt + 'px'; }
};
// 2) 아래 화면을 다시 그릴 때: 보고 있던 칸이 같은 자리에 오도록 스크롤을 맞춤
const anchorKey = (e) => e.tagName + '.' + e.className + ':' + (e.textContent || '').replace(/[\d,.%+\-]+/g, '#').replace(/\s+/g, ' ').slice(0, 40);
const _renderStab = U.render;
U.render = function (force = false) {
  const p = document.getElementById('panel');
  const view = [this.tab, this.zone, this.skillSel, this.town, this.codex].join('|');
  let anc = null;
  if (p && !force && view === this._view && p.scrollTop > 0) {
    const pt = p.getBoundingClientRect().top;
    const el = [...p.querySelectorAll('.card, .row, details, summary, .h, .slot')].find((e) => e.getBoundingClientRect().bottom > pt + 4);
    if (el) anc = { k: anchorKey(el), off: el.getBoundingClientRect().top - pt };
  }
  const t0 = this._rT;
  _renderStab.call(this, force);
  if (!anc || this._rT === t0) return; // 다시 그리지 않았으면 그대로
  const pt = p.getBoundingClientRect().top;
  const el = [...p.querySelectorAll('.card, .row, details, summary, .h, .slot')].find((e) => anchorKey(e) === anc.k);
  if (el) p.scrollTop += el.getBoundingClientRect().top - pt - anc.off;
};

// ====================== 🔮 잠재능력: 부위마다 21단계 · 큐브 1개 = 후보 1개 · 한 번에 3개 후보 중 고르기 · 자동 돌리기 ======================
// 잠재능력도 별처럼 '부위'에 붙음 → 장비를 바꿔 껴도 그대로
import { refDef as refDefP } from './data.js';
ITEMS.cube = { name: '잠재 큐브', icon: '🧊', kind: 'cube', value: 50 };
export const POT_GRADES = [
  ['평범', '#b5b9c4'], ['견고', '#9ca3af'], ['정교', '#86efac'], ['희귀', '#4ade80'], ['영롱', '#38bdf8'], ['고귀', '#60a5fa'], ['에픽', '#a78bfa'],
  ['영웅', '#c084fc'], ['전설', '#fb923c'], ['신화', '#facc15'], ['고대', '#22d3ee'], ['태초', '#2dd4bf'], ['성운', '#f472b6'], ['항성', '#fb7185'],
  ['은하', '#818cf8'], ['성좌', '#e879f9'], ['차원', '#f43f5e'], ['초월', '#fde047'], ['천상', '#a5f3fc'], ['절대', '#fca5a5'], ['무한', '#fff7ae'],
];
const POT_MAX = POT_GRADES.length; // 21
const potName = (g) => POT_GRADES[g - 1]?.[0] || '없음';
const potCol = (g) => POT_GRADES[g - 1]?.[1] || 'var(--mut)';
// 다음 단계로 오를 확률 (후보 1개마다) · 단계가 높을수록 낮아짐
export const potUp = (g) => (g >= POT_MAX ? 0 : 0.12 * 0.82 ** (g - 1));
// 한 줄 수치: % 는 단계에 따라 (21단계 한 줄 약 12%), 고정 수치는 돌린 때의 전투 레벨 기준
const potPct = (g) => 0.004 + 0.0035 * g ** 1.15;
const POT_KINDS = [
  // [키, 뽑힐 비중, 종류]
  ['atkPct', 10, 'pct'], ['strPct', 10, 'pct'], ['defPct', 10, 'pct'], ['rngPct', 10, 'pct'], ['magPct', 10, 'pct'],
  ['atkFlat', 6, 'flat'], ['strFlat', 6, 'flat'], ['defFlat', 6, 'flat'], ['rngFlat', 6, 'flat'], ['magFlat', 6, 'flat'],
  ['ls', 4, 'ls'], ['drop', 4, 'drop'], ['bossDmg', 4, 'boss'],
];
const POT_W = POT_KINDS.reduce((a, k) => a + k[1], 0);
function potLine(g, L) {
  let x = Math.random() * POT_W, kd = POT_KINDS[0];
  for (const k of POT_KINDS) { x -= k[1]; if (x < 0) { kd = k; break; } }
  const [k, , t] = kd;
  const r = 0.85 + Math.random() * 0.3; // 같은 단계 안에서도 조금씩 다름
  let v;
  if (t === 'pct') v = potPct(g) * r;
  else if (t === 'flat') v = Math.max(1, Math.round(0.004 * refDefP(Math.max(10, L)) * (0.3 + 0.07 * g ** 1.1) * r * (k === 'defFlat' ? 1.5 : 1)));
  else if (t === 'ls') v = potPct(g) * 0.12 * r;
  else if (t === 'drop') v = potPct(g) * 1.5 * r;
  else v = potPct(g) * 1.2 * r;
  if (t !== 'flat') v = Math.round(v * 10000) / 10000;
  return { k, v };
}
// 줄 3개: 첫 줄은 그 단계, 둘째 · 셋째 줄은 25% 확률로 그 단계 · 아니면 한 단계 아래
function potRoll(g, L) {
  return [g, ...[0, 1].map(() => (Math.random() < 0.25 || g === 1 ? g : g - 1))].map((gg) => potLine(gg, L));
}
const potLineTxt = (l) => {
  const n = SPN_A[l.k] || l.k;
  return /Flat$/.test(l.k) ? `${n} +${fmt(l.v)}` : `${n} +${(l.v * 100).toFixed(l.v < 0.01 ? 2 : 1)}%`;
};
P.potInit = function () {
  this.s.pot ||= { sl: {}, auto: false, target: 5, slot: 'all', autoUp: true, keepBetter: true, tries: 0, ups: 0, cand: null, candSl: null };
  const f = this.s.pot;
  f.sl ||= {};
  return f;
};
P.potOf = function (sl) { return this.s.pot?.sl?.[sl] || null; };
P.potGrade = function (sl) { return this.potOf(sl)?.g || 0; };
P.potBonus = function () {
  const S = this.s.pot?.sl || {};
  const key = JSON.stringify(S);
  if (this._potB?.key === key) return this._potB.v;
  const v = {};
  for (const sl of Object.keys(S)) for (const l of S[sl].lines || []) v[l.k] = (v[l.k] || 0) + l.v;
  this._potB = { key, v };
  return v;
};
const _extraPot = P.extraSources;
P.extraSources = function () { return [..._extraPot.call(this), this.potBonus()]; };
// 후보 점수 (자동 선택용 · 가벼운 계산): 지금 전투 방식의 주 능력 · 방어 위주
P.potScore = function (lines) {
  const st = this.style(), L = this.combatLevel();
  const main = st === 'melee' ? ['atk', 'str'] : st === 'ranged' ? ['rng'] : ['mag'];
  const unitFlat = Math.max(1, 0.01 * refDefP(Math.max(10, L)));
  let sc = 0;
  for (const l of lines || []) {
    const base = l.k.replace(/Pct$|Flat$/, '');
    const w = main.includes(base) ? (main.length === 2 ? 0.6 : 1) : base === 'def' ? 0.7 : ['atk', 'str', 'rng', 'mag'].includes(base) ? 0.08 : l.k === 'ls' ? 2 : 0.15;
    const val = /Flat$/.test(l.k) ? (l.v / unitFlat) * 0.01 : l.v;
    sc += val * w;
  }
  return sc;
};
// 큐브 3개로 후보 3개 만들기 (큐브가 모자라면 있는 만큼)
P.potRoll3 = function (sl) {
  const f = this.potInit();
  if (!SLOTS_SF[sl]) return null;
  const n = Math.min(3, this.have('cube'));
  if (n <= 0) return null;
  this.give('cube', -n);
  const cur = this.potOf(sl), g0 = cur?.g || 1, L = this.combatLevel();
  const cand = [];
  for (let i = 0; i < n; i++) {
    const up = cur && Math.random() < potUp(g0);
    const g = cur ? (up ? g0 + 1 : g0) : 1;
    cand.push({ g, up: !!up, lines: potRoll(g, L) });
  }
  f.tries += n;
  f.cand = cand; f.candSl = sl;
  return cand;
};
// 후보 고르기 (i = -1 이면 지금 것 유지)
P.potPick = function (i) {
  const f = this.potInit(), c = f.cand?.[i], sl = f.candSl;
  if (c && sl) {
    const old = this.potGrade(sl);
    f.sl = { ...f.sl, [sl]: { g: c.g, lines: c.lines } };
    if (c.g > old && old) { f.ups++; this.toast(`🔮 ${SLOTS_SF[sl].name} 잠재능력 등업! ${potName(old)} → ${potName(c.g)}`, 'pet'); if (c.g >= 12 && this.s.cele !== false) this.celebrate?.(`🔮 ${SLOTS_SF[sl].name} ${potName(c.g)} 등급!`); }
    this.dirty();
  }
  f.cand = null; f.candSl = null;
};
// 자동으로 고를 후보: 등업 우선 (설정) → 아니면 지금보다 좋은 것 (설정) → 아니면 유지
P.potAutoChoice = function () {
  const f = this.potInit(), C = f.cand;
  if (!C) return -1;
  const cur = this.potOf(f.candSl);
  if (!cur) { let b = 0; C.forEach((c, i) => { if (this.potScore(c.lines) > this.potScore(C[b].lines)) b = i; }); return b; }
  let best = -1, bs = -Infinity;
  if (f.autoUp) C.forEach((c, i) => { if (c.g > cur.g && this.potScore(c.lines) > bs) { bs = this.potScore(c.lines); best = i; } });
  if (best >= 0) return best;
  if (f.keepBetter) { bs = this.potScore(cur.lines); C.forEach((c, i) => { const v = this.potScore(c.lines); if (v > bs) { bs = v; best = i; } }); }
  return best;
};
// 자동 돌리기: 목표 단계까지 (모든 부위면 단계가 가장 낮은 부위부터)
P.potAutoPick = function () {
  const f = this.potInit();
  const list = f.slot === 'all' ? SLOT_IDS_SF : [f.slot];
  let best = null;
  for (const sl of list) { const g = this.potGrade(sl); if (g < f.target && (best == null || g < this.potGrade(best))) best = sl; }
  return best;
};
P.potAutoStop = function (why, kind = 'info') { const f = this.potInit(); f.auto = false; this._potT = 0; f.stop = why; this.toast(`🔮 자동 큐브 멈춤 · ${why}`, kind); };
P.potAutoStart = function () {
  const f = this.potInit();
  if (!this.potAutoPick()) { this.toast(`이미 목표 ${potName(f.target)} 등급입니다`, 'bad'); return false; }
  if (this.have('cube') <= 0) { this.toast('🧊 큐브가 없습니다 (몬스터 전리품 · 쿠폰)', 'bad'); return false; }
  f.cand = null; f.auto = true; f.stop = null; this._potT = 0;
  return true;
};
P.potAutoTick = function (dt) {
  const f = this.s.pot;
  if (!f?.auto) return;
  this._potT = (this._potT || 0) + dt;
  let n = 0;
  while (this._potT >= 0.3 && n < 4) {
    this._potT -= 0.3; n++;
    const sl = this.potAutoPick();
    if (!sl) return this.potAutoStop(`목표 ${potName(f.target)} 달성!`, 'pet');
    if (this.have('cube') <= 0) return this.potAutoStop('큐브를 다 썼습니다', 'bad');
    this.potRoll3(sl);
    const i = this.potAutoChoice();
    const c = f.cand?.[i];
    f.last = { sl, cand: f.cand, pick: i, at: performance.now() };
    if (i >= 0) this.potPick(i); else { f.cand = null; f.candSl = null; }
    if (c && !this.quiet) f.lastPick = { sl, g: c.g, lines: c.lines };
  }
};
const _updPot = P.update;
P.update = function (dt) { _updPot.call(this, dt); this.potAutoTick(dt); };

// ---- 큐브 드롭: 모든 몬스터 (보스는 더 많이) ----
const _killPot = P.kill;
P.kill = function (m) {
  const r = _killPot.call(this, m);
  const mul = 1 + (this.sp('drop') || 0);
  const p = (m.boss ? 0.3 : 0.04) * mul;
  if (Math.random() < p) {
    const n = m.boss ? 1 + Math.floor(Math.random() * 3) : 1;
    this.gain('cube', n);
  }
  return r;
};
// ---- 쿠폰으로 큐브 ----
COUPONS.CUBE = { cube: 300, text: '🧊 잠재 큐브 300개' };
COUPONS.큐브 = { cube: 1000, text: '🧊 잠재 큐브 1,000개' };
COUPONS.STAR2026.cube = 100; COUPONS.STAR2026.text += ' · 🧊 큐브 100개';
const _redeemPot = P.redeemCoupon;
P.redeemCoupon = function (code) {
  const r = _redeemPot.call(this, code);
  if (r.ok) {
    const key = Object.keys(COUPONS).find((x) => cpNorm(x) === cpNorm(code));
    const c = COUPONS[key];
    if (c?.cube) this.give('cube', c.cube);
  }
  return r;
};

// ---- 화면: 마을 '🔮 잠재' 탭 + 큐브 창 ----
const potBadge = (g) => (g ? `<span class="potb" style="color:${potCol(g)};border-color:${potCol(g)}">🔮${potName(g)}</span>` : '');
P.potBadgeHtml = function (sl) { return potBadge(this.potGrade(sl)); };
function townPot(ui, p, g, s) {
  const f = g.potInit();
  const b = g.potBonus();
  const bt = Object.entries(b).map(([k, v]) => potLineTxt({ k, v })).join(', ');
  p.appendChild(h('div', 'card', `<b>🔮 잠재능력</b> <span class="mut">🧊 큐브 ${fmt(g.have('cube'))}개 · 돌린 횟수 ${fmt(f.tries)} · 등업 ${fmt(f.ups)}</span>
    <div class="mut">부위마다 <b>${POT_MAX}단계</b> (${potName(1)} → ${potName(POT_MAX)}) · 큐브 1개 = 후보 1개 · <b>한 번에 3개</b>를 돌려서 마음에 드는 것을 고릅니다 · 잠재능력은 부위에 붙어서 장비를 바꿔도 그대로</div>
    <div class="mut">🧊 큐브: 모든 몬스터 전리품 (보스는 더 자주 · 여러 개) · 쿠폰</div>
    <div style="margin-top:6px">잠재능력 합계: <span class="sp">${bt || '없음'}</span></div>`));
  // 자동
  const a = h('div', 'card', `<b>🤖 자동 큐브</b> ${f.auto ? '<span class="sp">진행 중…</span>' : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px">
      <label class="tg">목표 <select class="ptt">${POT_GRADES.map((x, i) => `<option value="${i + 1}"${f.target === i + 1 ? ' selected' : ''}>${i + 1}단계 ${x[0]}</option>`).join('')}</select></label>
      <label class="tg">부위 <select class="pts"><option value="all"${f.slot === 'all' ? ' selected' : ''}>모든 부위 (낮은 것부터)</option>${SLOT_IDS_SF.map((sl) => `<option value="${sl}"${f.slot === sl ? ' selected' : ''}>${SLOTS_SF[sl].icon} ${SLOTS_SF[sl].name}</option>`).join('')}</select></label>
      <label class="tg"><input type="checkbox" class="ptu"${f.autoUp ? ' checked' : ''}> ⬆ 등업이 나오면 자동으로 선택</label>
      <label class="tg"><input type="checkbox" class="ptk"${f.keepBetter ? ' checked' : ''}> ✨ 지금보다 좋은 옵션이면 자동으로 선택</label>
    </div>
    <div style="margin-top:6px"><button class="btn ${f.auto ? '' : 'pri'} pta">${f.auto ? '🤖 자동 큐브 창 열기' : '▶ 자동 큐브 시작'}</button></div>
    <div class="mut">한 번에 큐브 3개 · 목표 단계에 닿거나 큐브를 다 쓰면 멈춤 · 좋은 옵션은 지금 전투 방식(${STYLES[g.style()].name}) 기준</div>`);
  a.querySelector('.ptt').addEventListener('change', (e) => { f.target = +e.target.value; });
  a.querySelector('.pts').addEventListener('change', (e) => { f.slot = e.target.value; });
  a.querySelector('.ptu').addEventListener('change', (e) => { f.autoUp = e.target.checked; });
  a.querySelector('.ptk').addEventListener('change', (e) => { f.keepBetter = e.target.checked; });
  a.querySelector('.pta').addEventListener('click', () => { if (f.auto || g.potAutoStart()) ui.potOpen(null, true); ui._rT = 0; });
  p.appendChild(a);
  // 부위 목록
  for (const sl of SLOT_IDS_SF) {
    const cur = g.potOf(sl), it = ITEMS[s.equip[sl]];
    const row = h('div', 'row', `<div class="ic">${SLOTS_SF[sl].icon}</div><div class="info"><div class="nm">${SLOTS_SF[sl].name} ${cur ? potBadge(cur.g) : '<span class="mut">잠재능력 없음</span>'} <span class="mut">${it ? it.name : ''}</span></div>
      <div class="sp">${cur ? cur.lines.map(potLineTxt).join(' · ') : ''}</div><div class="mut">${cur && cur.g < POT_MAX ? `다음 단계 확률 ${pct(potUp(cur.g), 2)} (후보 1개마다)` : cur ? '최고 단계!' : '큐브를 쓰면 1단계부터 시작'}</div></div>
      <button class="btn sm pri">🧊 큐브</button>`);
    row.querySelector('button').addEventListener('click', () => ui.potOpen(sl, !!f.auto));
    p.appendChild(row);
  }
  const rows = [];
  for (let k = 1; k <= POT_MAX; k++) rows.push(`<span style="color:${potCol(k)}">${k}단계 ${potName(k)}</span> · 한 줄 약 ${(potPct(k) * 100).toFixed(1)}%${k < POT_MAX ? ` · 등업 ${pct(potUp(k), 2)}` : ''}`);
  p.appendChild(h('details', 'card mut', `<summary>📋 단계 · 확률표</summary>${rows.join('<br>')}`));
}
U.townExtra = [...U.townExtra, ['pot', '🔮 잠재']];
U.townFns.pot = townPot;
const _sigPot = U.sigX;
U.sigX = function () { const f = this.g.s.pot; const on = this.tab === 'town' && this.town === 'pot'; return [..._sigPot.call(this), f ? JSON.stringify(Object.values(f.sl).map((x) => x.g)) : '', f?.auto, on ? this.g.have('cube') : 0, f?.target, f?.slot]; };

// 큐브 창 (강화 창처럼 따로 뜸): 후보 3개 중 고르기 · 자동이면 진행 상황
U.potOpen = function (sl, auto = false) {
  const ui = this, g = this.g, f = g.potInit();
  document.getElementById('sfWin')?.remove();
  clearInterval(this._sfWinT);
  const st = { sl: sl || g.potAutoPick() || 'weapon', auto, key: '', tries0: f.tries, ups0: f.ups, cubes0: g.have('cube') };
  if (!auto && f.cand && f.candSl) st.sl = f.candSl; // 고르다 만 후보가 있으면 이어서
  const wrap = h('div', '', '<div class="sfbox potbox"></div>');
  wrap.id = 'sfWin';
  document.body.appendChild(wrap);
  const box = wrap.querySelector('.sfbox');
  const close = () => { clearInterval(ui._sfWinT); wrap.remove(); ui._rT = 0; ui.render(true); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  const linesHtml = (lines) => lines.map((l) => `<div>${potLineTxt(l)}</div>`).join('');
  const draw = () => {
    const A = st.auto;
    if (A && f.auto) st.sl = g.potAutoPick() || st.sl;
    const sl2 = st.sl, cur = g.potOf(sl2), it = ITEMS[g.s.equip[sl2]];
    const C = !A && f.cand && f.candSl === sl2 ? f.cand : null;
    const L = A ? f.last : null;
    const key = JSON.stringify([A, f.auto, sl2, cur, g.have('cube'), !!C, f.tries, f.stop, f.autoUp, f.keepBetter]);
    if (key === st.key) return;
    st.key = key;
    const slotSel = A ? '' : `<select class="sfsl">${SLOT_IDS_SF.map((x) => `<option value="${x}"${x === sl2 ? ' selected' : ''}>${SLOTS_SF[x].icon} ${SLOTS_SF[x].name} · ${g.potGrade(x) ? potName(g.potGrade(x)) : '없음'}</option>`).join('')}</select>`;
    const curHtml = `<div class="potcur" style="border-color:${potCol(cur?.g)}"><div class="potg" style="color:${potCol(cur?.g)}">${cur ? `${cur.g}단계 ${potName(cur.g)}` : '잠재능력 없음'}</div>${cur ? linesHtml(cur.lines) : '<div class="mut">큐브를 쓰면 1단계부터 시작</div>'}</div>`;
    let candHtml = '';
    const showC = C || (L && L.sl === sl2 && performance.now() - L.at < 2000 ? L.cand : null);
    if (showC) {
      candHtml = `<div class="potcands">${showC.map((c, i) => `<div class="potc${c.up ? ' up' : ''}${A && L?.pick === i ? ' pick' : ''}" data-i="${i}" style="border-color:${potCol(c.g)}">
        <div class="potg" style="color:${potCol(c.g)}">${c.up ? '⬆ 등업! ' : ''}${potName(c.g)}</div>${linesHtml(c.lines)}${C ? '<button class="btn sm pri pk">이걸로</button>' : ''}</div>`).join('')}</div>`;
    }
    const sess = `이번에 큐브 ${fmt(f.tries - st.tries0)}개 · 등업 ${fmt(f.ups - st.ups0)}번`;
    const g0 = cur?.g || 0;
    box.innerHTML = `<div class="sfhd"><b>${A ? '🤖 자동 큐브' : '🔮 잠재능력'}</b><button class="btn sm sfx">✕ 닫기</button></div>
      ${slotSel}
      <div class="sfmain"><div class="sfic">${SLOTS_SF[sl2].icon}</div><div class="sfnm">${SLOTS_SF[sl2].name} <span class="mut">${it ? it.name : '비어 있음'}</span></div>${curHtml}</div>
      ${candHtml}
      <div class="mut" style="text-align:center">${g0 && g0 < POT_MAX ? `다음 단계 ${potName(g0 + 1)} 확률 ${pct(potUp(g0), 2)} (후보마다) · ` : ''}🧊 큐브 ${fmt(g.have('cube'))}개</div>
      ${A ? `<div class="sfgrid">${SLOT_IDS_SF.map((x) => `<div class="${x === sl2 ? 'on' : ''}">${SLOTS_SF[x].icon}<b style="color:${potCol(g.potGrade(x))}">${g.potGrade(x) || '-'}</b></div>`).join('')}</div>
        <div class="mut" style="text-align:center">목표 ${f.target}단계 ${potName(f.target)} · ${f.slot === 'all' ? '모든 부위 (낮은 것부터)' : SLOTS_SF[f.slot].name}${f.stop && !f.auto ? ` · <b>멈춤: ${f.stop}</b>` : ''}</div>` : ''}
      <div class="mut" style="text-align:center">${sess}</div>
      <label class="tg" style="justify-content:center"><input type="checkbox" class="ptu"${f.autoUp ? ' checked' : ''}> ⬆ 등업은 자동 선택</label>
      <div class="sfbtns">${A
        ? `<button class="btn ${f.auto ? '' : 'pri'} big pta">${f.auto ? '■ 자동 큐브 멈춤' : '▶ 자동 큐브 다시 시작'}</button>`
        : C ? '<button class="btn big pkeep">지금 것 유지</button>'
          : `<button class="btn pri big pgo"${g.have('cube') <= 0 || f.auto ? ' disabled' : ''}>🧊 큐브 ${Math.min(3, g.have('cube')) || 3}개 돌리기</button>`}</div>
      ${f.auto && !A ? '<div class="mut" style="text-align:center">자동 큐브 중에는 직접 돌릴 수 없습니다</div>' : ''}`;
    box.querySelector('.sfx').addEventListener('click', close);
    box.querySelector('.sfsl')?.addEventListener('change', (e) => { if (f.cand) g.potPick(-1); st.sl = e.target.value; st.key = ''; draw(); });
    box.querySelector('.ptu').addEventListener('change', (e) => { f.autoUp = e.target.checked; st.key = ''; draw(); });
    box.querySelector('.pgo')?.addEventListener('click', () => {
      const c = g.potRoll3(st.sl);
      if (!c) { g.toast('🧊 큐브가 없습니다', 'bad'); return; }
      // 처음 잠재능력이면 가장 좋은 것 / 등업 자동 선택이 켜져 있으면 등업 후보를 바로 고름
      const cur2 = g.potOf(st.sl);
      if (!cur2) { g.potPick(g.potAutoChoice()); }
      else if (f.autoUp && c.some((x) => x.g > cur2.g)) {
        let bi = -1, bs = -Infinity;
        c.forEach((x, i) => { if (x.g > cur2.g && g.potScore(x.lines) > bs) { bs = g.potScore(x.lines); bi = i; } });
        g.potPick(bi);
      }
      st.key = ''; draw();
    });
    box.querySelectorAll('.potc .pk').forEach((b) => b.addEventListener('click', () => { g.potPick(+b.closest('.potc').dataset.i); st.key = ''; draw(); }));
    box.querySelector('.pkeep')?.addEventListener('click', () => { g.potPick(-1); st.key = ''; draw(); });
    box.querySelector('.pta')?.addEventListener('click', () => { if (f.auto) g.potAutoStop('직접 멈춤'); else g.potAutoStart(); st.key = ''; draw(); });
    ui.noWrapSeg?.(box);
  };
  draw();
  this._sfWinT = setInterval(() => { if (!document.getElementById('sfWin')) return clearInterval(ui._sfWinT); draw(); }, 150);
};

// ---- 몬스터 밸런스: 잠재능력이 붙는 만큼 높은 레벨 몬스터를 조금 더 강하게 (30레벨부터 서서히 · 200레벨 이상 체력 +25% · 피해 +20%) ----
for (const m of Object.values(MONSTER)) {
  if (m._potBal) continue;
  const k = Math.max(0, Math.min(1, (m.lvl - 30) / 170));
  m.hp = Math.round(m.hp * (1 + 0.25 * k));
  m.str = Math.round(m.str * (1 + 0.2 * k));
  m.atk = Math.round(m.atk * (1 + 0.1 * k));
  m.def = Math.round(m.def * (1 + 0.1 * k));
  m._potBal = true;
}

// ====================== 🎨 화면 테마: 모험 (기본) · 별밤 (이전) ======================
const applyTheme = (s) => {
  const th = s?.theme || 'adv';
  if (document.body.dataset.th === th) return;
  document.body.dataset.th = th;
  document.body.classList.toggle('th-adv', th === 'adv');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', th === 'adv' ? '#24315c' : '#14182b');
};
const _frameTh = U.frame;
U.frame = function () { applyTheme(this.g.s); return _frameTh.call(this); };
const _tabMoreTh = U.tabMore;
U.tabMore = function (p) {
  const s = this.g.s;
  const c = h('div', 'card', `<b>🎨 화면 테마</b> <select class="thsel"><option value="adv"${(s.theme || 'adv') === 'adv' ? ' selected' : ''}>⚔ 모험 (새 테마)</option><option value="night"${s.theme === 'night' ? ' selected' : ''}>🌙 별밤 (이전 테마)</option></select>`);
  c.querySelector('.thsel').addEventListener('change', (e) => { s.theme = e.target.value; applyTheme(s); });
  p.appendChild(c);
  return _tabMoreTh.call(this, p);
};
