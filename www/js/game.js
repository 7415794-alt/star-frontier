// 별무리 개척기 — 게임 로직
import {
  SKILLS, SKILL, ITEMS, GEAR, SLOT_IDS, STYLE_IDS, MONSTER, ZONES, ACTIONS, PRAYERS, PETS, PET, TIERS,
  levelOf, XP_TABLE, roll, hitChance, maxHitOf, monMaxHit, CRIT_MULT, RESPAWN, DEATH_TIME, OFFLINE_CAP, SHOP,
} from './data.js';

export const SAVE_KEY = 'star-frontier-save-v1';
export const SAVE_VERSION = 1;

export function newState() {
  const xp = {};
  for (const s of SKILLS) xp[s.id] = 0;
  xp.hp = XP_TABLE[10]; // 체력 Lv 10으로 시작
  return {
    v: SAVE_VERSION,
    coins: 0,
    xp,
    bank: { sword0: 1, bread: 10 },
    equip: {},
    activity: null,            // { type: 'combat', mon } | { type: 'skill', skill, act }
    meleeMode: 'atk',          // 근접 경험치: atk · str · def · shared
    prayer: null,
    pet: null,
    pets: [],
    autoEat: 0.5,              // 체력이 이 비율 아래면 음식 섭취
    showNums: true,
    stats: { kills: 0, deaths: 0, actions: 0 },
    lastSeen: Date.now(),
  };
}

export class Game {
  constructor(s) {
    this.s = s;
    this.rt = { hp: 0, mon: null, monHp: 0, atkT: 0, monT: 0, respawn: 0, dead: 0, prog: 0, fx: [], log: [], cache: null, regenT: 0 };
    this.listeners = [];
    this.rt.hp = this.maxHp();
  }

  // ---------- 레벨 ----------
  lvl(id) { return levelOf(this.s.xp[id] || 0); }
  addXp(id, n) {
    const before = this.lvl(id);
    this.s.xp[id] = (this.s.xp[id] || 0) + n;
    const after = this.lvl(id);
    if (after > before) {
      this.toast(`${SKILL[id].icon} ${SKILL[id].name} 레벨 ${after}!`, 'lvl');
      this.dirty();
    }
  }
  combatLevel() {
    const L = (k) => this.lvl(k);
    return Math.floor((L('def') + L('hp') + Math.floor(L('div') / 2)) / 4 + Math.max(L('atk') + L('str'), 1.5 * L('rng'), 1.5 * L('mag')) * 0.325);
  }

  // ---------- 보유 ----------
  have(id) { return this.s.bank[id] || 0; }
  give(id, n = 1) {
    this.s.bank[id] = (this.s.bank[id] || 0) + n;
    if (this.s.bank[id] <= 0) delete this.s.bank[id];
  }

  // ---------- 특수 옵션 · 능력치 ----------
  dirty() { this.rt.cache = null; }
  bonuses() {
    if (this.rt.cache) return this.rt.cache;
    const z = () => ({ melee: 0, ranged: 0, magic: 0 });
    const b = { acc: z(), pow: z(), def: z(), sp: {} };
    const addSp = (o) => { for (const [k, v] of Object.entries(o || {})) b.sp[k] = (b.sp[k] || 0) + v; };
    for (const sl of SLOT_IDS) {
      const it = ITEMS[this.s.equip[sl]];
      if (!it) continue;
      for (const k of ['acc', 'pow', 'def']) for (const st of STYLE_IDS) b[k][st] += it.stats[k][st];
      addSp(it.stats.sp);
    }
    const pr = this.prayer();
    if (pr) addSp(pr.fx);
    const pet = this.s.pet && this.s.pets.includes(this.s.pet) ? PET[this.s.pet] : null;
    if (pet) addSp(pet.fx);
    this.rt.cache = b;
    return b;
  }
  sp(k) { return this.bonuses().sp[k] || 0; }
  prayer() {
    const p = PRAYERS.find((x) => x.id === this.s.prayer);
    return p && this.lvl('div') >= p.lvl ? p : null;
  }
  weapon() { return ITEMS[this.s.equip.weapon] || null; }
  style() { return this.weapon()?.style || 'melee'; }
  atkInterval() { return (this.weapon()?.speed || 2.4) / (1 + this.sp('speed')); }
  maxHp() { return Math.floor(this.lvl('hp') * 10 * (1 + this.sp('hpPct'))); }
  accLvl(st = this.style()) { return st === 'melee' ? this.lvl('atk') : st === 'ranged' ? this.lvl('rng') : this.lvl('mag'); }
  powLvl(st = this.style()) { return st === 'melee' ? this.lvl('str') : st === 'ranged' ? this.lvl('rng') : this.lvl('mag'); }
  atkRoll(st = this.style()) { return roll(this.accLvl(st), this.bonuses().acc[st]) * (1 + this.sp('acc')); }
  maxHit(st = this.style()) { return Math.max(1, Math.floor(maxHitOf(this.powLvl(st), this.bonuses().pow[st]) * (1 + this.sp('dmg')))); }
  // 받는 공격 방어 굴림: 마법은 방어 30% + 마법 70%
  defRoll(mStyle) {
    const d = this.lvl('def'), m = this.lvl('mag');
    const L = mStyle === 'magic' ? Math.floor(d * 0.3 + m * 0.7) : d;
    return roll(L, this.bonuses().def[mStyle]) * (1 + this.sp('defPct'));
  }
  monDefRoll(m, st = this.style()) { return roll(m.defLvl, m.defB[st]); }
  monAtkRoll(m) { return roll(m.atkLvl, m.accB) * Math.max(0.1, 1 - this.sp('evade')); }
  protectOf(style) { return style === 'melee' ? this.sp('pm') : style === 'ranged' ? this.sp('pr') : this.sp('pg'); }
  // 몬스터 상대 예상 수치
  vs(m) {
    const st = this.style();
    const hit = hitChance(this.atkRoll(st), this.monDefRoll(m, st));
    const mh = this.maxHit(st);
    const crit = Math.min(0.5, this.sp('crit'));
    const avg = ((1 + mh) / 2) * (1 + crit * (CRIT_MULT - 1));
    const dps = (hit * avg) / this.atkInterval();
    const mHit = hitChance(this.monAtkRoll(m), this.defRoll(m.style));
    const mMax = monMaxHit(m);
    const red = (1 - Math.min(0.8, this.sp('dr'))) * (1 - this.protectOf(m.style));
    const mdps = (mHit * ((1 + mMax) / 2) * red) / m.interval;
    return { hit, mh, dps, ttk: m.hp / Math.max(0.01, dps), mHit, mMax, mdps };
  }

  // ---------- 장비 ----------
  canEquip(id) {
    const it = ITEMS[id];
    if (!it || it.kind !== 'gear') return false;
    const [sk, L] = it.req;
    return this.lvl(sk) >= L;
  }
  equip(id) {
    const it = ITEMS[id];
    if (!this.canEquip(id) || this.have(id) < 1) return false;
    this.unequip(it.slot, true);
    if (it.twoHand) this.unequip('shield', true);
    if (it.slot === 'shield' && this.weapon()?.twoHand) this.unequip('weapon', true);
    this.give(id, -1);
    this.s.equip[it.slot] = id;
    this.dirty();
    this.rt.hp = Math.min(this.rt.hp, this.maxHp());
    return true;
  }
  unequip(slot, quiet = false) {
    const id = this.s.equip[slot];
    if (!id) return false;
    this.give(id, 1);
    delete this.s.equip[slot];
    this.dirty();
    this.rt.hp = Math.min(this.rt.hp, this.maxHp());
    return true;
  }
  sell(id, n = 1) {
    n = Math.min(n, this.have(id));
    if (n <= 0) return 0;
    this.give(id, -n);
    const c = (ITEMS[id].value || 1) * n;
    this.s.coins += c;
    return c;
  }
  buy(id) {
    const sh = SHOP.find((x) => x.id === id);
    if (!sh || this.s.coins < sh.price) return false;
    this.s.coins -= sh.price;
    this.give(id, 1);
    return true;
  }

  // ---------- 행동 선택 ----------
  startCombat(monId) {
    const m = MONSTER[monId];
    if (!m) return false;
    this.s.activity = { type: 'combat', mon: monId };
    this.spawn();
    return true;
  }
  startSkill(skill, actId) {
    const a = (ACTIONS[skill] || []).find((x) => x.id === actId);
    if (!a || this.lvl(skill) < a.lvl) return false;
    if (a.in && !this.hasInputs(a)) { this.toast('재료가 부족합니다', 'bad'); return false; }
    this.s.activity = { type: 'skill', skill, act: actId };
    this.rt.prog = 0;
    this.rt.mon = null;
    return true;
  }
  startBury(boneId) {
    if (this.have(boneId) < 1) return false;
    this.s.activity = { type: 'bury', bone: boneId };
    this.rt.prog = 0;
    this.rt.mon = null;
    return true;
  }
  stop() { this.s.activity = null; this.rt.mon = null; }
  hasInputs(a) { return Object.entries(a.in || {}).every(([id, n]) => this.have(id) >= n); }
  actionTime(skill, a) {
    const lv = this.lvl(skill);
    let sp = 1 + Math.min(1, 0.01 * Math.max(0, lv - a.lvl));
    const ty = SKILL[skill].type;
    if (ty === 'gather') sp *= 1 + this.sp('gspd');
    if (ty === 'make') sp *= 1 + this.sp('mspd');
    return a.time / sp;
  }
  actionXp(skill, a) {
    const ty = SKILL[skill].type;
    return a.xp * (1 + (ty === 'gather' ? this.sp('gxp') : ty === 'make' ? this.sp('mxp') : 0));
  }
  burnChance(a) {
    if (!a.burn) return 0;
    return Math.max(0, 0.4 - 0.015 * (this.lvl('cook') - a.lvl)) * (1 - this.sp('burn'));
  }

  // ---------- 전투 ----------
  spawn() {
    const m = MONSTER[this.s.activity?.mon];
    if (!m) { this.rt.mon = null; return; }
    this.rt.mon = m;
    this.rt.monHp = m.hp;
    this.rt.atkT = 0;
    this.rt.monT = 0;
  }
  combatTick(dt) {
    const rt = this.rt;
    if (rt.dead > 0) {
      rt.dead -= dt;
      if (rt.dead <= 0) { rt.hp = this.maxHp(); this.spawn(); }
      return;
    }
    if (!rt.mon) {
      rt.respawn -= dt;
      if (rt.respawn <= 0) this.spawn();
      return;
    }
    const m = rt.mon;
    rt.atkT += dt;
    const iv = this.atkInterval();
    while (rt.atkT >= iv && rt.mon) {
      rt.atkT -= iv;
      this.playerAttack(m);
    }
    if (!rt.mon) return;
    rt.monT += dt;
    while (rt.monT >= m.interval && rt.mon && rt.dead <= 0) {
      rt.monT -= m.interval;
      this.monsterAttack(m);
    }
  }
  playerAttack(m) {
    const rt = this.rt;
    const st = this.style();
    let dmg = 0;
    let crit = false;
    if (Math.random() < hitChance(this.atkRoll(st), this.monDefRoll(m, st))) {
      dmg = 1 + Math.floor(Math.random() * this.maxHit(st));
      if (Math.random() < Math.min(0.5, this.sp('crit'))) { dmg = Math.floor(dmg * CRIT_MULT); crit = true; }
    }
    dmg = Math.min(dmg, rt.monHp);
    rt.monHp -= dmg;
    this.fx('mon', dmg ? (crit ? '치명 ' : '') + dmg : '빗나감', crit ? 'crit' : dmg ? 'hit' : 'miss');
    if (dmg > 0) {
      if (this.sp('ls') > 0) rt.hp = Math.min(this.maxHp(), rt.hp + dmg * this.sp('ls'));
      this.combatXp(dmg);
    }
    if (rt.monHp <= 0) this.kill(m);
  }
  combatXp(dmg) {
    const x = dmg * 4 * (1 + this.sp('xp'));
    const st = this.style();
    if (st === 'ranged') this.addXp('rng', x);
    else if (st === 'magic') this.addXp('mag', x);
    else if (this.s.meleeMode === 'shared') { this.addXp('atk', x / 3); this.addXp('str', x / 3); this.addXp('def', x / 3); }
    else this.addXp(this.s.meleeMode, x);
    this.addXp('hp', x / 3);
  }
  monsterAttack(m) {
    const rt = this.rt;
    let dmg = 0;
    if (Math.random() < hitChance(this.monAtkRoll(m), this.defRoll(m.style))) {
      dmg = 1 + Math.floor(Math.random() * monMaxHit(m));
      dmg = Math.max(0, Math.round(dmg * (1 - Math.min(0.8, this.sp('dr'))) * (1 - this.protectOf(m.style))));
    }
    rt.hp -= dmg;
    this.fx('hero', dmg ? '-' + dmg : '막음', dmg ? 'hurt' : 'miss');
    if (dmg > 0 && this.sp('reflect') > 0 && rt.mon) {
      const r = Math.min(rt.monHp, Math.max(1, Math.round(dmg * this.sp('reflect'))));
      rt.monHp -= r;
      if (rt.monHp <= 0) { this.kill(m); return; }
    }
    this.autoEat();
    if (rt.hp <= 0) {
      rt.hp = 0;
      rt.dead = DEATH_TIME;
      rt.mon = null;
      this.s.stats.deaths++;
      this.toast('쓰러졌습니다… 잠시 후 다시 싸웁니다', 'bad');
    }
  }
  autoEat() {
    const max = this.maxHp();
    let guard = 20;
    while (this.rt.hp < max * this.s.autoEat && guard-- > 0) {
      const food = Object.keys(this.s.bank).filter((id) => ITEMS[id]?.kind === 'food').sort((a, b) => ITEMS[b].heal - ITEMS[a].heal)[0];
      if (!food) return;
      this.give(food, -1);
      this.rt.hp = Math.min(max, this.rt.hp + ITEMS[food].heal * (1 + this.sp('heal')));
    }
  }
  kill(m) {
    const s = this.s;
    s.stats.kills++;
    s.kills ||= {};
    s.kills[m.id] = (s.kills[m.id] || 0) + 1;
    const t = m.z;
    const lootMul = 1 + this.sp('drop');
    const got = [];
    const add = (id, n = 1) => { this.give(id, n); got.push(ITEMS[id].icon); };
    add('bone' + t, m.boss ? 3 : 1);
    s.coins += Math.round((m.lvl * 2 + 3) * (0.5 + Math.random()) * (m.boss ? 6 : 1));
    if (Math.random() < 0.18 * lootMul) add((Math.random() < 0.5 ? 'hide' : 'cloth') + t, m.boss ? 3 : 1);
    if (Math.random() < 0.08 * lootMul) add('raw' + t);
    // 장비: 일반 2.5% · 보스 30% (장신구 · 망토는 드롭 전용)
    if (Math.random() < (m.boss ? 0.3 : 0.025) * lootMul) {
      const types = Object.keys(GEAR);
      const ty = types[Math.floor(Math.random() * types.length)];
      add(ty + t);
      this.toast(`📦 ${ITEMS[ty + t].name} 획득!`, 'loot');
    }
    if (m.boss) {
      const pet = PETS.find((p) => p.src === 'boss:' + m.z);
      if (pet) this.tryPet(pet, lootMul);
    }
    this.fx('mon', got.join(''), 'loot');
    this.rt.mon = null;
    this.rt.respawn = RESPAWN;
  }
  tryPet(pet, mul = 1) {
    if (this.s.pets.includes(pet.id) || Math.random() >= pet.p * mul) return;
    this.s.pets.push(pet.id);
    if (!this.s.pet) this.s.pet = pet.id;
    this.dirty();
    this.toast(`🐾 펫 획득! ${pet.icon} ${pet.name}`, 'pet');
  }

  // ---------- 생활 스킬 ----------
  skillTick(dt) {
    const A = this.s.activity;
    const a = (ACTIONS[A.skill] || []).find((x) => x.id === A.act);
    if (!a) { this.stop(); return; }
    if (a.in && !this.hasInputs(a)) { this.toast('재료가 떨어져 멈췄습니다', 'bad'); this.stop(); return; }
    const t = this.actionTime(A.skill, a);
    this.rt.prog += dt / t;
    while (this.rt.prog >= 1) {
      this.rt.prog -= 1;
      if (a.in && !this.hasInputs(a)) { this.stop(); return; }
      for (const [id, n] of Object.entries(a.in || {})) this.give(id, -n);
      if (a.burn && Math.random() < this.burnChance(a)) this.give('burnt', 1);
      else for (const [id, n] of Object.entries(a.out || {})) this.give(id, n);
      this.addXp(A.skill, this.actionXp(A.skill, a));
      this.s.stats.actions++;
      const pet = PETS.find((p) => p.src === A.skill);
      if (pet) this.tryPet(pet);
    }
  }
  buryTick(dt) {
    const id = this.s.activity.bone;
    if (this.have(id) < 1) { this.toast('묻을 뼈가 없습니다', 'bad'); this.stop(); return; }
    this.rt.prog += dt / 1.2;
    while (this.rt.prog >= 1) {
      this.rt.prog -= 1;
      if (this.have(id) < 1) { this.stop(); return; }
      this.give(id, -1);
      this.addXp('div', ITEMS[id].xp);
    }
  }

  // ---------- 진행 ----------
  update(dt) {
    const rt = this.rt;
    // 자연 회복: 10초마다 최대 체력 1% + 기도 · 펫 회복
    rt.regenT += dt;
    if (rt.regenT >= 1) {
      rt.regenT -= 1;
      if (rt.dead <= 0) rt.hp = Math.min(this.maxHp(), rt.hp + this.maxHp() * (0.01 / 10 + this.sp('regen')));
    }
    const A = this.s.activity;
    if (!A) return;
    if (A.type === 'combat') this.combatTick(dt);
    else if (A.type === 'skill') this.skillTick(dt);
    else if (A.type === 'bury') this.buryTick(dt);
    for (const f of rt.fx) f.t += dt;
    rt.fx = rt.fx.filter((f) => f.t < 1);
  }
  // 오프라인: 1초 단위로 그대로 진행 (최대 12시간)
  offline(sec) {
    sec = Math.min(sec, OFFLINE_CAP);
    if (sec < 30 || !this.s.activity) return null;
    const xp0 = { ...this.s.xp };
    const bank0 = { ...this.s.bank };
    const c0 = this.s.coins;
    const k0 = this.s.stats.kills;
    this.quiet = true;
    for (let t = 0; t < sec; t += 1) this.update(1);
    this.quiet = false;
    const xp = Object.fromEntries(Object.keys(this.s.xp).map((k) => [k, this.s.xp[k] - (xp0[k] || 0)]).filter(([, v]) => v > 0));
    const items = Object.fromEntries(Object.keys(this.s.bank).map((k) => [k, this.s.bank[k] - (bank0[k] || 0)]).filter(([, v]) => v > 0));
    return { sec, xp, items, coins: this.s.coins - c0, kills: this.s.stats.kills - k0 };
  }

  // ---------- 화면 효과 ----------
  fx(at, text, kind) {
    if (this.quiet) return;
    if (!this.s.showNums && kind !== 'loot') return;
    this.rt.fx.push({ at, text, kind, t: 0, x: Math.random() * 40 - 20 });
    if (this.rt.fx.length > 30) this.rt.fx.shift();
  }
  toast(text, kind = '') {
    if (this.quiet) return;
    this.rt.log.push({ text, kind });
  }
}

// ---------- 저장 ----------
export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return hydrate(JSON.parse(raw));
  } catch (e) { return null; }
}
export function hydrate(o) {
  const base = newState();
  if (!o || typeof o !== 'object') return base;
  const s = { ...base, ...o, xp: { ...base.xp, ...(o.xp || {}) }, stats: { ...base.stats, ...(o.stats || {}) } };
  s.bank = Object.fromEntries(Object.entries(o.bank || {}).filter(([id, n]) => ITEMS[id] && n > 0));
  s.equip = Object.fromEntries(Object.entries(o.equip || {}).filter(([sl, id]) => ITEMS[id]?.slot === sl));
  s.pets = (o.pets || []).filter((p) => PET[p]);
  return s;
}
export function saveState(s) {
  s.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* 저장 공간 부족 */ }
}
export const exportSave = (s) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
export function importSave(txt) {
  const t = String(txt || '').trim();
  const json = t.startsWith('{') ? t : decodeURIComponent(escape(atob(t.replace(/[^A-Za-z0-9+/=]/g, ''))));
  return hydrate(JSON.parse(json));
}
export { TIERS, ZONES };
