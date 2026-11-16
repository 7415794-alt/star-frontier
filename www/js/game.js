// 별무리 개척기 — 게임 로직
import {
  SKILLS, SKILL, ITEMS, SLOT_IDS, STAT_IDS, CAPS, MONSTER, ACTIONS, PRAYERS, PETS, PET, SPELLS, SPEEDS,
  levelOf, baseHp, penChance, defEff, MON_ROLL, monFloor, monDef, RESPAWN, DEATH_TIME, OFFLINE_CAP, SHOP,
} from './data.js';

export const SAVE_KEY = 'star-frontier-save-v1';
export const SAVE_VERSION = 2;

export function newState() {
  const xp = {};
  for (const s of SKILLS) xp[s.id] = 0;
  return {
    v: SAVE_VERSION,
    coins: 0,
    xp,
    bank: { bread: 10 },
    equip: { weapon: 'sword0' },
    activity: null,            // { type: 'combat', mon } | { type: 'skill', skill, act } | { type: 'bury', bone }
    spell: null,               // null = 쓸 수 있는 가장 강한 주문
    prayer: null,
    pet: null,
    pets: [],
    autoEat: 0.5,
    showNums: true,
    speed: 1,
    stats: { kills: 0, deaths: 0, actions: 0 },
    kills: {},
    lastSeen: Date.now(),
  };
}

// ---------- 전투 계산 (순수 함수: 능력치 묶음 p로 계산 → 추천 · 전투력에 그대로 사용) ----------
// p = { lv: {atk,str,def,rng,mag}, st: {atk,str,def,rng,mag,ls,dr}, sp: {기도 · 펫 % 보너스}, style, speed, spellMult }
// 최종 스탯 = 레벨 + 장비 스탯 (방어는 기도 % 보너스까지)
const STD_ATK = 100; // 전투력 계산용 표준 공격자
export const C = {
  // 기도 · 펫은 스탯을 %로 올림
  eff: (p, k) => (p.lv[k] + (p.st[k] || 0)) * (1 + (p.sp[k + 'Pct'] || 0)),
  styleLv: (p) => (p.style === 'melee' ? (p.lv.atk + p.lv.str) / 2 : p.style === 'ranged' ? p.lv.rng : p.lv.mag),
  // 최대 피해: 근접 (공격 + 힘) x 0.85 / 원거리 원거리 x 0.85 / 마법 마법 x 0.70 x 주문 배율
  maxHit: (p) => {
    let mh;
    if (p.style === 'melee') mh = (C.eff(p, 'atk') + C.eff(p, 'str')) * 0.85;
    else if (p.style === 'ranged') mh = C.eff(p, 'rng') * 0.85;
    else mh = C.eff(p, 'mag') * 0.7 * p.spellMult;
    return Math.max(1, Math.floor(mh));
  },
  // 몬스터 방어가 최대 피해를 깎음 (방어 x 0.3)
  cap: (p, mdef = 0) => Math.max(1, C.maxHit(p) - Math.floor(mdef * 0.3)),
  minFrac: (p) => Math.min(0.15, C.styleLv(p) * 0.0015),
  minHit: (p, cap) => Math.max(1, Math.min(cap, Math.floor(cap * C.minFrac(p)))),
  interval: (p) => p.speed,
  maxHp: (p) => baseHp(p.lv.def),
  ls: (p) => Math.min(CAPS.ls, (p.st.ls || 0) + (p.sp.ls || 0)),
  dr: (p) => Math.min(CAPS.dr, (p.st.dr || 0) + (p.sp.dr || 0)),
  avgHit: (p, mdef = 0) => {
    const cap = C.cap(p, mdef);
    return (C.minHit(p, cap) + cap) / 2;
  },
  // 몬스터 공격: 명중률은 방어로 낮춤 / 맞으면 피해를 방어 효율 · 피해 감소만큼 줄임
  mHit: (p, m) => penChance(m.atk, C.eff(p, 'def')),
  mDmg: (p, m, r) => {
    const raw = Math.max(monFloor(m), Math.floor(m.str * r * (1 - defEff(C.eff(p, 'def'), m.str))));
    return Math.max(0, Math.floor(raw * (1 - C.dr(p))));
  },
  vs: (p, m) => {
    const mdef = monDef(m, p.style);
    const dps = C.avgHit(p, mdef) / C.interval(p);
    const ttk = m.hp / Math.max(0.01, dps);
    const mHit = C.mHit(p, m);
    const mMax = C.mDmg(p, m, MON_ROLL[1]);
    const mAvg = (C.mDmg(p, m, MON_ROLL[0]) + mMax) / 2;
    const mdps = (mHit * mAvg) / m.interval;
    const hp = C.maxHp(p);
    const heal = dps * C.ls(p) + hp * 0.001;
    const net = mdps - heal;
    const lossPerKill = Math.max(0, net) * ttk;
    const killsPerLife = lossPerKill > 0 ? hp / lossPerKill : Infinity;
    const cycle = ttk + RESPAWN;
    const kpm = killsPerLife === Infinity ? 60 / cycle : (60 * killsPerLife) / (killsPerLife * cycle + DEATH_TIME + 3);
    const cap = C.cap(p, mdef);
    return { mdef, min: C.minHit(p, cap), mh: cap, dps, ttk, mHit, mMax, mdps, heal, killsPerLife, kpm };
  },
  // 전투력: 몬스터와 상관없는 순수한 강함 = √(초당 피해 x 버티는 힘)
  power: (p) => {
    const off = C.avgHit(p, 0) / C.interval(p);
    const d = C.eff(p, 'def');
    const taken = penChance(STD_ATK, d) * (1 - defEff(d, STD_ATK)) * (1 - C.dr(p));
    const ehp = (C.maxHp(p) / Math.max(0.02, taken)) * (1 + C.ls(p) * 3);
    return Math.round(Math.sqrt(Math.max(0, off) * ehp));
  },
};

export class Game {
  constructor(s) {
    this.s = s;
    this.rt = { hp: 0, mon: null, monHp: 0, atkT: 0, monT: 0, respawn: 0, dead: 0, prog: 0, fx: [], log: [], cache: null, regenT: 0 };
    this.rt.hp = this.maxHp();
  }

  speed() { return SPEEDS.includes(this.s.speed) ? this.s.speed : 1; }
  cycleSpeed() { const i = SPEEDS.indexOf(this.speed()); this.s.speed = SPEEDS[(i + 1) % SPEEDS.length]; }

  // ---------- 레벨 ----------
  lvl(id) { return levelOf(this.s.xp[id] || 0); }
  addXp(id, n) {
    const before = this.lvl(id);
    this.s.xp[id] = (this.s.xp[id] || 0) + n;
    const after = this.lvl(id);
    if (after > before) { this.toast(`${SKILL[id].icon} ${SKILL[id].name} 레벨 ${after}!`, 'lvl'); this.dirty(); }
  }
  combatLevel() {
    const L = (k) => this.lvl(k);
    const st = [(L('atk') + L('str')) / 2, L('rng'), L('mag')].sort((a, b) => b - a);
    return Math.floor(L('def') * 0.25 + st[0] * 0.75 + st[1] * 0.3 + st[2] * 0.15);
  }

  have(id) { return this.s.bank[id] || 0; }
  give(id, n = 1) {
    this.s.bank[id] = (this.s.bank[id] || 0) + n;
    if (this.s.bank[id] <= 0) delete this.s.bank[id];
  }

  // ---------- 능력치 ----------
  dirty() { this.rt.cache = null; }
  bonuses() {
    if (this.rt.cache) return this.rt.cache;
    const b = { st: Object.fromEntries(STAT_IDS.map((k) => [k, 0])), sp: {} };
    const addSp = (o) => { for (const [k, v] of Object.entries(o || {})) b.sp[k] = (b.sp[k] || 0) + v; };
    for (const sl of SLOT_IDS) {
      const it = ITEMS[this.s.equip[sl]];
      if (!it) continue;
      for (const [k, v] of Object.entries(it.st)) b.st[k] += v;
      addSp(it.sp);
    }
    addSp(this.prayer()?.fx);
    const pet = this.s.pet && this.s.pets.includes(this.s.pet) ? PET[this.s.pet] : null;
    addSp(pet?.fx);
    this.rt.cache = b;
    return b;
  }
  sp(k) { return this.bonuses().sp[k] || 0; }
  prayer() { const p = PRAYERS.find((x) => x.id === this.s.prayer); return p && this.lvl('div') >= p.lvl ? p : null; }
  weapon() { return ITEMS[this.s.equip.weapon] || null; }
  style() { return this.weapon()?.style || 'melee'; }
  spell() {
    const ok = SPELLS.filter((x) => this.lvl('mag') >= x.lvl);
    return ok.find((x) => x.id === this.s.spell) || ok[ok.length - 1];
  }
  profile() {
    const b = this.bonuses();
    return {
      lv: { atk: this.lvl('atk'), str: this.lvl('str'), def: this.lvl('def'), rng: this.lvl('rng'), mag: this.lvl('mag') },
      st: { ...b.st }, sp: { ...b.sp }, style: this.style(), speed: this.weapon()?.speed || 2.4, spellMult: this.spell().mult,
    };
  }
  maxHp() { return C.maxHp(this.profile()); }
  maxHit() { return C.maxHit(this.profile()); }
  atkInterval() { return C.interval(this.profile()); }
  vs(m) { return C.vs(this.profile(), m); }
  power() { return C.power(this.profile()); }

  // 스탯 추천: 레벨 +1 / 장비 스탯 +10 (흡수 · 피해 감소 +1%p) 했을 때
  // real = 지금(또는 고른) 몬스터와 실제 전투의 분당 처치 증가 · power = 전투력 증가
  analyze(m) {
    const p0 = this.profile();
    const now = m ? C.vs(p0, m) : null;
    const pw0 = C.power(p0);
    const st = p0.style;
    const tests = [
      ...(st === 'melee' ? [['lv', 'atk', '🗡️ 공격 Lv +1'], ['lv', 'str', '💪 힘 Lv +1']] : st === 'ranged' ? [['lv', 'rng', '🏹 원거리 Lv +1']] : [['lv', 'mag', '🔮 마법 Lv +1']]),
      ['lv', 'def', '🛡️ 방어 Lv +1'],
      ...(st === 'melee' ? [['st', 'atk', '장비 🗡️ 공격 +10', 10], ['st', 'str', '장비 💪 힘 +10', 10]] : st === 'ranged' ? [['st', 'rng', '장비 🏹 원거리 +10', 10]] : [['st', 'mag', '장비 🔮 마법 +10', 10]]),
      ['st', 'def', '장비 🛡️ 방어 +10', 10], ['st', 'ls', '장비 🩸 생명력 흡수 +1%p', 0.01], ['st', 'dr', '장비 🧱 피해 감소 +1%p', 0.01],
    ];
    const rows = tests.map(([kind, k, label, d = 1]) => {
      const p = { ...p0, lv: { ...p0.lv }, st: { ...p0.st } };
      p[kind][k] += d;
      const full = (k === 'ls' && C.ls(p0) >= CAPS.ls) || (k === 'dr' && C.dr(p0) >= CAPS.dr) || (kind === 'lv' && p0.lv[k] >= 100);
      return { label, full, real: now ? C.vs(p, m).kpm / Math.max(1e-9, now.kpm) - 1 : 0, power: C.power(p) / Math.max(1, pw0) - 1 };
    }).filter((r) => !r.full);
    return { now, power: pw0, real: [...rows].sort((a, b) => b.real - a.real), pow: [...rows].sort((a, b) => b.power - a.power) };
  }

  // ---------- 장비 ----------
  canEquip(id) {
    const it = ITEMS[id];
    if (!it || it.kind !== 'gear') return false;
    return this.lvl(it.req[0]) >= it.req[1];
  }
  equip(id) {
    const it = ITEMS[id];
    if (!this.canEquip(id) || this.have(id) < 1) return false;
    this.unequip(it.slot);
    if (it.twoHand) this.unequip('shield');
    if (it.slot === 'shield' && this.weapon()?.twoHand) this.unequip('weapon');
    this.give(id, -1);
    this.s.equip[it.slot] = id;
    this.dirty();
    this.rt.hp = Math.min(this.rt.hp, this.maxHp());
    return true;
  }
  unequip(slot) {
    const id = this.s.equip[slot];
    if (!id) return false;
    this.give(id, 1);
    delete this.s.equip[slot];
    this.dirty();
    this.rt.hp = Math.min(this.rt.hp, this.maxHp());
    return true;
  }
  // 장비를 끼면 전투력이 얼마나 바뀌는지
  equipDelta(id) {
    const it = ITEMS[id];
    if (!it) return 0;
    const eq = { ...this.s.equip };
    const before = this.power();
    this.s.equip[it.slot] = id;
    if (it.twoHand) delete this.s.equip.shield;
    if (it.slot === 'shield' && ITEMS[eq.weapon]?.twoHand) delete this.s.equip.weapon;
    this.dirty();
    const after = this.power();
    this.s.equip = eq;
    this.dirty();
    return after - before;
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

  // ---------- 행동 ----------
  startCombat(monId) {
    if (!MONSTER[monId]) return false;
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
    let sp = 1 + Math.min(1, 0.01 * Math.max(0, this.lvl(skill) - a.lvl));
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
    if (!rt.mon) { rt.respawn -= dt; if (rt.respawn <= 0) this.spawn(); return; }
    const m = rt.mon;
    const p = this.profile();
    rt.atkT += dt;
    const iv = C.interval(p);
    while (rt.atkT >= iv && rt.mon) { rt.atkT -= iv; this.playerAttack(m, p); }
    if (!rt.mon) return;
    rt.monT += dt;
    while (rt.monT >= m.interval && rt.mon && rt.dead <= 0) { rt.monT -= m.interval; this.monsterAttack(m, p); }
  }
  playerAttack(m, p) {
    const rt = this.rt;
    const cap = C.cap(p, monDef(m, p.style));
    const lo = C.minHit(p, cap);
    let dmg = lo + Math.floor(Math.random() * (cap - lo + 1));
    dmg = Math.min(dmg, rt.monHp);
    rt.monHp -= dmg;
    this.fx('mon', String(dmg), 'hit');
    if (dmg > 0) {
      const ls = C.ls(p);
      if (ls > 0 && rt.hp < C.maxHp(p)) rt.hp = Math.min(C.maxHp(p), rt.hp + Math.max(1, Math.ceil(dmg * ls)));
      this.combatXp(dmg, p.style);
    }
    if (rt.monHp <= 0) this.kill(m);
  }
  // 전투 경험치: 근접은 공격 · 힘 모두, 원거리 · 마법은 자기 스킬 / 방어는 항상 70%
  combatXp(dmg, st) {
    const x = dmg * 0.45;
    if (st === 'ranged') this.addXp('rng', x);
    else if (st === 'magic') this.addXp('mag', x);
    else { this.addXp('atk', x); this.addXp('str', x); }
    this.addXp('def', x * 0.7);
  }
  monsterAttack(m, p) {
    const rt = this.rt;
    let dmg = 0;
    const hits = Math.random() < C.mHit(p, m);
    if (hits) dmg = C.mDmg(p, m, MON_ROLL[0] + Math.random() * (MON_ROLL[1] - MON_ROLL[0]));
    rt.hp -= dmg;
    this.fx('hero', !hits ? '빗나감' : dmg ? '-' + dmg : '0', dmg ? 'hurt' : 'miss');
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
  dropMult() { return 1; }
  kill(m) {
    const s = this.s;
    s.stats.kills++;
    s.kills ||= {};
    s.kills[m.id] = (s.kills[m.id] || 0) + 1;
    const mul = this.dropMult();
    const got = [];
    for (const l of m.loot) {
      if (!l.fixed && Math.random() >= Math.min(1, l.p * mul)) continue;
      const n = l.a + Math.floor(Math.random() * (l.b - l.a + 1));
      this.give(l.id, n);
      got.push(ITEMS[l.id].icon);
      const it = ITEMS[l.id];
      if (it.kind === 'gear' || it.id === 'gem') this.toast(`📦 ${it.name} 획득!`, 'loot');
      else if (l.id.startsWith('gem')) this.toast(`💎 ${it.name} 획득!`, 'loot');
    }
    s.coins += m.coins[0] + Math.floor(Math.random() * (m.coins[1] - m.coins[0] + 1));
    if (m.boss) {
      const pet = PETS.find((x) => x.src === 'boss:' + m.z);
      if (pet) this.tryPet(pet, mul);
    }
    this.fx('mon', got.slice(0, 5).join(''), 'loot');
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
    this.rt.prog += dt / this.actionTime(A.skill, a);
    while (this.rt.prog >= 1) {
      this.rt.prog -= 1;
      if (a.in && !this.hasInputs(a)) { this.stop(); return; }
      for (const [id, n] of Object.entries(a.in || {})) this.give(id, -n);
      if (a.burn && Math.random() < this.burnChance(a)) this.give('burnt', 1);
      else for (const [id, n] of Object.entries(a.out || {})) this.give(id, n);
      if (a.gem && Math.random() < 0.01) { this.give(a.gem, 1); this.toast(`💎 ${ITEMS[a.gem].name} 발견!`, 'loot'); }
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
    rt.regenT += dt;
    while (rt.regenT >= 1) {
      rt.regenT -= 1;
      if (rt.dead <= 0) rt.hp = Math.min(this.maxHp(), rt.hp + this.maxHp() * 0.001);
    }
    const A = this.s.activity;
    if (A) {
      if (A.type === 'combat') this.combatTick(dt);
      else if (A.type === 'skill') this.skillTick(dt);
      else if (A.type === 'bury') this.buryTick(dt);
    }
  }
  // 오프라인: 1초 단위로 진행 (최대 12시간, 배속 미적용)
  offline(sec) {
    sec = Math.min(sec, OFFLINE_CAP);
    if (sec < 30 || !this.s.activity) return null;
    const xp0 = { ...this.s.xp }, bank0 = { ...this.s.bank }, c0 = this.s.coins, k0 = this.s.stats.kills;
    this.quiet = true;
    for (let t = 0; t < sec; t += 1) this.update(1);
    this.quiet = false;
    const xp = Object.fromEntries(Object.keys(this.s.xp).map((k) => [k, this.s.xp[k] - (xp0[k] || 0)]).filter(([, v]) => v > 0));
    const items = Object.fromEntries(Object.keys(this.s.bank).map((k) => [k, this.s.bank[k] - (bank0[k] || 0)]).filter(([, v]) => v > 0));
    return { sec, xp, items, coins: this.s.coins - c0, kills: this.s.stats.kills - k0 };
  }

  fx(at, text, kind) {
    if (this.quiet) return;
    if (!this.s.showNums && kind !== 'loot') return;
    this.rt.fx.push({ at, text, kind, t: 0, x: Math.random() * 40 - 20 });
    if (this.rt.fx.length > 30) this.rt.fx.shift();
  }
  toast(text, kind = '') { if (!this.quiet) this.rt.log.push({ text, kind }); }
}

// ---------- 저장 ----------
export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? hydrate(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}
export function hydrate(o) {
  const base = newState();
  if (!o || typeof o !== 'object') return base;
  const s = { ...base, ...o, xp: { ...base.xp, ...(o.xp || {}) }, stats: { ...base.stats, ...(o.stats || {}) }, v: SAVE_VERSION };
  s.bank = Object.fromEntries(Object.entries(o.bank || {}).filter(([id, n]) => ITEMS[id] && n > 0));
  s.equip = Object.fromEntries(Object.entries(o.equip || base.equip).filter(([sl, id]) => ITEMS[id]?.slot === sl));
  s.pets = (o.pets || []).filter((p) => PET[p]);
  if (!SPEEDS.includes(s.speed)) s.speed = 1;
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
