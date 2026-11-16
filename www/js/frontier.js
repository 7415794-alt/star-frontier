// 별무리 개척기 — 5차: 탄약(화살 · 룬) · 스킬 보스 · 세계 보스 · 초희귀 드롭 · 기도서 · 펫 호루라기 · 보스 축하 · 처치 효과
import { ITEMS, TIERS, SKILL, ACTIONS, PETS, PRAYERS, TOMES, GEAR, STYLES, STATS, gearId, rollRarity, monDef, penChance, defEff, MON_ROLL, monFloor, COMBAT_TICK } from './data.js';
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
    atk: Math.round((2 + 0.058 * L ** 1.92) * b), str: Math.round((2 + 0.137 * L ** 1.71) * b), def: Math.round((1 + 0.176 * L ** 1.45) * b),
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
  if (rt.cele) {
    const c = h('div', 'cele', rt.cele.text);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1900);
    rt.cele = null;
  }
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
  return JSON.stringify([s.equip, s.prayer, s.pet, Object.keys(s.effects || {}), ['atk', 'str', 'def', 'rng', 'mag'].map((k) => this.lvl(k)), this.ammoId(), s.tomes?.length, Object.keys(s.museum || {}).length, s.talents]);
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
    for (const w of weapons) { const e = { ...eq, weapon: w }; if (ITEMS[w].twoHand) delete e.shield; const pw = ev(e); if (pw > bp) { bp = pw; bw = w; } }
    eq.weapon = bw;
    if (ITEMS[bw].twoHand) delete eq.shield;
    for (const sl of SLOT_IDS) {
      if (sl === 'weapon' || (sl === 'shield' && ITEMS[bw].twoHand)) continue;
      let cur = ev(eq), pk = eq[sl];
      for (const id of pool[sl] || []) { const pw = ev({ ...eq, [sl]: id }); if (pw > cur) { cur = pw; pk = id; } }
      if (pk) eq[sl] = pk;
    }
    return { eq, power: ev(eq) };
  } finally { s.equip = eq0; this.dirty(); }
};
P.loadoutPowers = function () {
  const k = JSON.stringify([Object.keys(this.s.bank).filter((id) => ITEMS[id]?.kind === 'gear'), this.stateKey()]);
  if (this._loKey !== k) {
    this._lo = Object.fromEntries(['melee', 'ranged', 'magic'].map((st) => [st, this.bestLoadout(st)]));
    this._loKey = k;
  }
  return this._lo;
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
  const mon = this.s.activity?.type === 'combat' ? this.s.activity.mon : this.s.huntMon;
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
  if (!g.bgHunting()) { d.textContent = ''; return; }
  const m = MONSTER[g.s.huntMon], mx = g.maxHp();
  d.textContent = `⚔ 함께 사냥: ${m.icon} ${m.name} ${rt.mon ? `${fmt(rt.monHp)}/${fmt(m.hp)}` : rt.dead > 0 ? `· 부활까지 ${rt.dead.toFixed(0)}초` : '· 다음 몬스터…'} · 내 체력 ${fmt(Math.max(0, rt.hp))}/${fmt(mx)} · 처치 ${fmt(g.s.kills?.[m.id] || 0)}`;
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
