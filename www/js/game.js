// 별무리 개척기 — 게임 로직
import {
  SKILLS, SKILL, ITEMS, SLOT_IDS, STAT_IDS, CAPS, MONSTER, ACTIONS, PRAYERS, PETS, PET, SPELLS, SPEEDS,
  levelOf, XP_TABLE, TIERS, RARITY, baseHp, COMBAT_TICK, HUNT_PER, huntTier, rollRarity, gearId, penChance, defEff, defEffStd, monAtkStr, MON_ROLL, monFloor, monDef, RESPAWN, DEATH_TIME, OFFLINE_CAP, SHOP,
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
    autoEquip: false,          // 더 좋은 장비를 얻으면 자동 장착
    favorDef: false,           // 자동 장착: 방어 우선
    keepFood: {},              // 자동 섭취에서 아껴 둘 음식
    eatWorst: false,           // 약한 음식부터 먹기
    eatDanger: true,           // 다음 공격에 죽을 수 있으면 미리 먹기
    stopNoFood: false,         // 음식이 떨어지고 체력이 낮으면 전투 멈춤
    log: { first: {}, got: {}, gear: {}, bossKills: 0, food: 0, time: 0 }, // 모험 일지
    goals: {},                 // 스킬 목표 레벨
    hideWeak: false,           // 약한 장비 숨기기
    favPrayer: [], favPet: [], // 즐겨찾기
    sfx: false, cb: false,     // 효과음 · 색약 모드
    tut: false,                // 처음 안내를 봤는지
    effects: {},               // 마신 물약: { 종류: { id, left } }
    autoPot: true,             // 물약이 끝나면 같은 물약 자동으로 다시 마시기
    tools: {},                 // 채집 도구 { wood: id, mine: id, fish: id }
    life: null,                // 생활 장신구 1칸
    lastSeen: Date.now(),
  };
}

// ---------- 전투 계산 (순수 함수: 능력치 묶음 p로 계산 → 추천 · 전투력에 그대로 사용) ----------
// p = { lv: {atk,str,def,rng,mag}, st: {atk,str,def,rng,mag,ls,dr}, sp: {기도 · 펫 % 보너스}, style, speed, spellMult }
// 최종 스탯 = 레벨 + 장비 스탯 (방어는 기도 % 보너스까지)
const STD_ATK = 100; // 전투력 계산용 표준 공격자
export const C = {
  // 기도 · 펫은 스탯을 %로 올림
  eff: (p, k) => {
    const b = p.lv[k] + (p.st[k] || 0);
    const pc = p.sp[k + 'Pct'] || 0, mn = p.sp[k + 'Min'] || 0; // 물약: % 와 최소 보장치 중 큰 값
    return b + (pc || mn ? Math.max(b * pc, mn) : 0);
  },
  // 피해 배율: 보스 피해 · 사냥꾼 숙련
  dmgMult: (p, m) => (1 + (m?.boss ? p.sp.bossDmg || 0 : 0)) * (1 + C.hunt(p, m).dmg),
  hunt: (p, m) => {
    const t = m ? huntTier(p.mk?.[m.id]) : 0;
    return { t, dmg: t * HUNT_PER.dmg, def: t * HUNT_PER.def, drop: t * HUNT_PER.drop };
  },
  defVs: (p, m) => C.eff(p, 'def') * (1 + C.hunt(p, m).def),
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
  avgHit: (p, mdef = 0, m = null) => {
    const cap = C.cap(p, mdef);
    return ((C.minHit(p, cap) + cap) / 2) * C.dmgMult(p, m);
  },
  // 몬스터 공격: 명중률은 방어로 낮춤 / 맞으면 피해를 방어 효율 · 피해 감소만큼 줄임
  mHit: (p, m) => penChance(m.atk, C.defVs(p, m)),
  mDmg: (p, m, r) => {
    const raw = Math.max(monFloor(m), Math.floor(m.str * r * (1 - defEff(C.defVs(p, m), m.atk))));
    return Math.max(0, Math.floor(raw * (1 - C.dr(p))));
  },
  vs: (p, m) => {
    const mdef = monDef(m, p.style);
    const dps = C.avgHit(p, mdef, m) / C.interval(p);
    const ttk = m.hp / Math.max(0.01, dps);
    const mHit = C.mHit(p, m);
    const mMax = C.mDmg(p, m, MON_ROLL[1]);
    const mAvg = (C.mDmg(p, m, MON_ROLL[0]) + mMax) / 2;
    const mdps = (mHit * mAvg) / m.interval;
    const hp = C.maxHp(p);
    const heal = dps * C.ls(p) + hp * 0.001 + (p.sp.hpTick || 0) / COMBAT_TICK;
    const net = mdps - heal;
    const lossPerKill = Math.max(0, net) * ttk;
    const killsPerLife = lossPerKill > 0 ? hp / lossPerKill : Infinity;
    const cycle = ttk + RESPAWN;
    const kpm = killsPerLife === Infinity ? 60 / cycle : (60 * killsPerLife) / (killsPerLife * cycle + DEATH_TIME + 3);
    const cap = C.cap(p, mdef);
    const dm = C.dmgMult(p, m);
    return { mdef, min: Math.floor(C.minHit(p, cap) * dm), mh: Math.floor(cap * dm), dps, ttk, mHit, mMax, mdps, heal, killsPerLife, kpm };
  },
  // 전투력: 몬스터와 상관없는 순수한 강함 = √(초당 피해 x 버티는 힘)
  power: (p) => {
    const off = C.avgHit(p, 0) / C.interval(p);
    const d = C.eff(p, 'def');
    const st = [(p.lv.atk + p.lv.str) / 2, p.lv.rng, p.lv.mag].sort((a, b) => b - a);
    const L = Math.max(1, Math.floor(p.lv.def * 0.25 + st[0] * 0.75 + st[1] * 0.3 + st[2] * 0.15));
    const ref = monAtkStr(L);
    const taken = penChance(ref.atk, d) * (1 - defEff(d, ref.atk)) * (1 - C.dr(p));
    const ehp = (C.maxHp(p) / Math.max(0.001, taken)) * (1 + C.ls(p) * 3);
    return Math.sqrt(Math.max(0, off) * ehp);
  },
};

export class Game {
  constructor(s) {
    this.s = s;
    this.rt = { hp: 0, mon: null, monHp: 0, atkT: 0, monT: 0, respawn: 0, dead: 0, prog: 0, fx: [], log: [], cache: null, regenT: 0, tickT: 0, sess: null, noFood: false };
    this.newSess();
    this.rt.hp = this.maxHp();
  }

  speed() { return SPEEDS.includes(this.s.speed) ? this.s.speed : 1; }
  cycleSpeed() { const i = SPEEDS.indexOf(this.speed()); this.s.speed = SPEEDS[(i + 1) % SPEEDS.length]; }

  // ---------- 레벨 ----------
  lvl(id) { return levelOf(this.s.xp[id] || 0); }
  addXp(id, n) {
    const before = this.lvl(id);
    this.s.xp[id] = (this.s.xp[id] || 0) + n;
    if (this.rt.sess) this.rt.sess.xp[id] = (this.rt.sess.xp[id] || 0) + n;
    const after = this.lvl(id);
    if (after > before) {
      this.toast(`${SKILL[id].icon} ${SKILL[id].name} 레벨 ${after}!`, 'lvl');
      this.dirty();
      const goal = this.s.goals?.[id];
      if (goal && after >= goal) { delete this.s.goals[id]; this.s.goals = { ...this.s.goals }; this.toast(`🎯 목표 달성! ${SKILL[id].name} ${goal}`, 'pet'); }
      this.sound('lvl');
    }
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
    for (const pr of this.openPrayers()) addSp(pr.fx);
    addSp(ITEMS[this.s.life]?.fx);
    for (const e of Object.values(this.s.effects || {})) addSp(ITEMS[e.id]?.fx);
    for (const f of this.extraSources()) addSp(f);
    for (const id of this.s.pets) addSp(PET[id]?.fx);
    this.rt.cache = b;
    return b;
  }
  sp(k) { return this.bonuses().sp[k] || 0; }
  extraSources() { return []; } // 박물관 · 재능 등 (4차)
  openPrayers() { return PRAYERS.filter((x) => (this.prayerOpen ? this.prayerOpen(x) : this.lvl('div') >= x.lvl)); }
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
      st: { ...b.st }, sp: { ...b.sp }, mk: this.s.kills, style: this.style(), speed: this.weapon()?.speed || 2.4, spellMult: this.spell().mult,
    };
  }
  maxHp() { return C.maxHp(this.profile()); }
  maxHit() { return C.maxHit(this.profile()); }
  atkInterval() { return C.interval(this.profile()); }
  vs(m) { return C.vs(this.profile(), m); }
  power() { return Math.round(C.power(this.profile())); }
  powerRaw() { return C.power(this.profile()); }

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
    const before = this.powerRaw();
    this.s.equip[it.slot] = id;
    this.dirty();
    const after = this.powerRaw();
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
    if (this.s.activity?.mon !== monId) this.newSess();
    this.s.activity = { type: 'combat', mon: monId };
    this.spawn();
    return true;
  }
  startSkill(skill, actId) {
    const a = (ACTIONS[skill] || []).find((x) => x.id === actId);
    if (!a || this.lvl(skill) < a.lvl) return false;
    if (a.in && !this.hasInputs(a)) { this.toast('재료가 부족합니다', 'bad'); return false; }
    if (this.s.activity?.act !== actId) this.newSess();
    this.s.activity = { type: 'skill', skill, act: actId };
    this.rt.prog = 0;
    this.rt.mon = null;
    return true;
  }
  startBury(boneId) {
    if (this.have(boneId) < 1) return false;
    if (this.s.activity?.bone !== boneId) this.newSess();
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
    if (ty === 'gather') sp *= 1 + this.sp('gspd') + this.toolSpeed(skill);
    // 장비 제작은 제작 속도, 요리 · 제련 · 연금 같은 가공은 생산 속도
    if (ty === 'make') sp *= 1 + (a.craft ? this.sp('cspd') : this.sp('pspd'));
    if (ty !== 'gather') sp *= 1 + this.toolSpeed(skill);
    return a.time / sp;
  }
  // 도둑질 성공률: 레벨 차이로 최대 90% + 도둑질 성공률 보너스 (최대 99%)
  stealChance(a) { return Math.min(0.99, Math.min(0.9, 0.55 + 0.012 * (this.lvl('steal') - a.lvl)) + this.sp('thief')); }
  toolSpeed(skill) { return ITEMS[this.s.tools?.[skill]]?.gspd || 0; }
  isCraft(skill, a) { return SKILL[skill].type === 'make' && !!a.craft;
  }
  actionXp(skill, a) {
    const ty = SKILL[skill].type;
    return a.xp * (1 + this.sp('sxp') + (ty === 'gather' ? this.sp('gxp') : ty === 'make' ? this.sp('mxp') : 0));
  }
  burnChance(a) {
    if (!a.burn) return 0;
    return Math.max(0, 0.4 - 0.015 * (this.lvl('cook') - a.lvl)) * (1 - this.sp('burn'));
  }

  // ---------- 전투 ----------
  spawn() {
    const A = this.s.activity;
    const m = MONSTER[A?.type === 'combat' ? A.mon : this.s.huntMon];
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
    rt.tickT += dt;
    while (rt.tickT >= COMBAT_TICK) { rt.tickT -= COMBAT_TICK; if (p.sp.hpTick) rt.hp = Math.min(C.maxHp(p), rt.hp + p.sp.hpTick); }
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
    let dmg = Math.floor((lo + Math.floor(Math.random() * (cap - lo + 1))) * C.dmgMult(p, m));
    dmg = Math.min(dmg, rt.monHp);
    rt.monHp -= dmg;
    this.fx('mon', String(dmg), 'hit');
    this.useEffects('atk');
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
      if (this.rt.sess) this.rt.sess.deaths++;
      this.toast('쓰러졌습니다… 잠시 후 다시 싸웁니다', 'bad');
    }
  }
  // 자동 섭취: 체력이 기준 아래이거나 (설정 시) 다음 공격에 죽을 수 있으면. 아껴 둔 음식은 먹지 않음
  foods() {
    const s = this.s;
    return Object.keys(s.bank).filter((id) => ITEMS[id]?.kind === 'food' && !s.keepFood?.[id])
      .sort((a, b) => (s.eatWorst ? ITEMS[a].heal - ITEMS[b].heal : ITEMS[b].heal - ITEMS[a].heal));
  }
  autoEat() {
    const s = this.s, rt = this.rt;
    const max = this.maxHp();
    const m = rt.mon;
    const danger = s.eatDanger && m ? C.mDmg(this.profile(), m, MON_ROLL[1]) : 0;
    let guard = 20;
    while ((rt.hp < max * s.autoEat || (danger && rt.hp <= danger && rt.hp < max)) && guard-- > 0) {
      const food = this.foods()[0];
      if (!food) {
        if (!rt.noFood) { rt.noFood = true; this.toast('⚠ 먹을 음식이 없습니다!', 'bad'); }
        if (s.stopNoFood && rt.hp < max * 0.3 && s.activity?.type === 'combat') { this.toast('음식이 없어 전투를 멈췄습니다', 'bad'); this.stop(); }
        return;
      }
      rt.noFood = false;
      this.give(food, -1);
      rt.hp = Math.min(max, rt.hp + ITEMS[food].heal * (1 + this.sp('heal')));
      s.log.food++;
      if (rt.sess) rt.sess.food++;
    }
  }
  dropMult(m) { return 1 + this.sp('drop') + C.hunt(this.profile(), m).drop; }
  kill(m) {
    const s = this.s;
    s.stats.kills++;
    s.kills ||= {};
    s.kills[m.id] = (s.kills[m.id] || 0) + 1;
    s.log.first[m.id] ||= Date.now();
    this.useEffects('kill');
    if (m.boss) s.log.bossKills++;
    if (this.rt.sess) this.rt.sess.kills++;
    const mul = this.dropMult(m);
    const got = [];
    for (const l of m.loot) {
      if (!l.fixed && Math.random() >= Math.min(1, l.p * mul)) continue;
      const n = l.a + Math.floor(Math.random() * (l.b - l.a + 1));
      const id = this.gain(l.id, n);
      got.push(ITEMS[id].icon);
      if (l.id.startsWith('gem')) this.toast(`💎 ${ITEMS[id].name} 획득!`, 'loot');
    }
    const c = m.coins[0] + Math.floor(Math.random() * (m.coins[1] - m.coins[0] + 1));
    s.coins += c;
    if (this.rt.sess) this.rt.sess.coins += c;
    if (m.boss) {
      const pet = PETS.find((x) => x.src === 'boss:' + m.z);
      if (pet) this.tryPet(pet, mul);
    }
    this.rt.mon = null;
    this.rt.respawn = RESPAWN;
  }
  // 아이템 획득: 장비는 등급을 굴림 · 일지 · 세션 기록 · 자동 장착
  gain(id, n = 1) {
    const s = this.s;
    let it = ITEMS[id];
    if (it?.kind === 'gear' && it.r === 1) {
      for (let k = 0; k < n; k++) {
        const gid = gearId(it.base, rollRarity());
        this.give(gid, 1);
        s.log.gear[gid] = (s.log.gear[gid] || 0) + 1;
        if (ITEMS[gid].r >= (s.gearToast ?? 1)) this.toast(`📦 ${ITEMS[gid].name} 획득!`, ITEMS[gid].r >= 4 ? 'pet' : 'loot'); // 장비 드롭 알림: 이 등급 이상만
        this.autoEquipCheck(gid);
        id = gid;
      }
    } else this.give(id, n);
    s.log.got[id] = (s.log.got[id] || 0) + n;
    if (this.rt.sess) this.rt.sess.got[id] = (this.rt.sess.got[id] || 0) + n;
    return id;
  }
  autoEquipCheck(id) {
    const s = this.s;
    if (!s.autoEquip || !this.canEquip(id) || this.have(id) < 1) return;
    const it = ITEMS[id];
    const cur = ITEMS[s.equip[it.slot]];
    if (it.slot === 'weapon' && cur && cur.style !== it.style) return; // 전투 방식은 바꾸지 않음
    const better = s.favorDef ? (it.st.def || 0) - (cur?.st.def || 0) > 0 || (!cur && this.equipDelta(id) > 0) : this.equipDelta(id) > 0;
    if (better) { this.equip(id); this.toast(`🔄 자동 장착: ${it.name}`, 'loot'); }
  }
  // ---------- 물약 ----------
  drink(id) {
    const it = ITEMS[id];
    if (it?.kind !== 'potion' || this.have(id) < 1) return false;
    this.give(id, -1);
    this.s.effects = { ...this.s.effects, [it.pk]: { id, left: it.uses } };
    this.dirty();
    this.toast(`🧪 ${it.name} (${it.uses}회)`);
    return true;
  }
  useEffects(kind) {
    const ef = this.s.effects;
    for (const [k, e] of Object.entries(ef || {})) {
      const it = ITEMS[e.id];
      if (!it) { delete ef[k]; continue; }
      if (it.use !== kind) continue;
      if (--e.left > 0) continue;
      if (this.s.autoPot && this.have(e.id) > 0) { this.give(e.id, -1); e.left = it.uses; continue; }
      delete ef[k];
      this.dirty();
      this.toast(`🧪 ${it.name} 효과가 끝났습니다`, 'bad');
    }
  }
  // ---------- 도구 · 생활 장신구 ----------
  canUse(id) { const it = ITEMS[id]; return !!it?.req && this.lvl(it.req[0]) >= it.req[1]; }
  equipTool(id) {
    const it = ITEMS[id];
    if (it?.kind !== 'tool' || this.have(id) < 1 || !this.canUse(id)) return false;
    const old = this.s.tools[it.skill];
    if (old) this.give(old, 1);
    this.give(id, -1);
    this.s.tools = { ...this.s.tools, [it.skill]: id };
    return true;
  }
  unequipTool(skill) { const old = this.s.tools[skill]; if (!old) return; this.give(old, 1); const t = { ...this.s.tools }; delete t[skill]; this.s.tools = t; }
  bestTool(skill) { return Object.keys(this.s.bank).filter((id) => ITEMS[id]?.kind === 'tool' && ITEMS[id].skill === skill && this.canUse(id)).sort((a, b) => ITEMS[b].t - ITEMS[a].t)[0]; }
  equipLife(id) {
    const it = ITEMS[id];
    if (it?.kind !== 'life' || this.have(id) < 1 || !this.canUse(id)) return false;
    if (this.s.life) this.give(this.s.life, 1);
    this.give(id, -1);
    this.s.life = id;
    this.dirty();
    return true;
  }
  unequipLife() { if (!this.s.life) return; this.give(this.s.life, 1); this.s.life = null; this.dirty(); }
  // ---------- 희귀 발견 상자 열기 ----------
  openBox(id, n = 1) {
    const it = ITEMS[id];
    if (it?.kind !== 'box') return null;
    n = Math.min(n, this.have(id));
    const got = {};
    const add = (k, c) => { if (ITEMS[k] && c > 0) { got[k] = (got[k] || 0) + c; } };
    let coins = 0;
    const t = it.t, up = Math.min(t + 1, TIERS.length - 1), R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    for (let i = 0; i < n; i++) {
      this.give(id, -1);
      if (it.box === 'nest') { add('herb' + t, R(2, 4)); if (Math.random() < 0.3) add('herb' + up, 1); if (Math.random() < 0.2) add('log' + up, R(1, 3)); }
      else if (it.box === 'gembag') { add('gem' + t, R(1, 3)); if (Math.random() < 0.2) add('gem' + up, 1); }
      else { coins += R(50, 150) * (t + 1) ** 2; add('raw' + t, R(3, 6)); if (Math.random() < 0.15) add(['sword', 'bow', 'staff', 'plate', 'hbody', 'robe', 'ring', 'amulet'][R(0, 7)] + t, 1); }
    }
    for (const [k, c] of Object.entries(got)) this.gain(k, c);
    this.s.coins += coins;
    this.toast(`${it.icon} ${n}개 열기: ${Object.entries(got).map(([k, c]) => `${ITEMS[k].icon}${c}`).join(' ')}${coins ? ` 💰${coins.toLocaleString()}` : ''}`, 'loot');
    return got;
  }

  // 세션 기록 (행동을 시작할 때마다 새로)
  newSess() { this.rt.sess = { t: 0, kills: 0, deaths: 0, coins: 0, food: 0, xp: {}, got: {} }; }

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
      // 도둑질: 실패하면 들켜서 한 번 쉼
      if (a.thief && Math.random() >= this.stealChance(a)) {
        this.rt.prog -= 1;
        this.useEffects('act');
        if (this.rt.sess) this.rt.sess.fails = (this.rt.sess.fails || 0) + 1;
        this.fx('hero', '들킴!', 'hurt');
        continue;
      }
      if (a.coins) { const c = a.coins[0] + Math.floor(Math.random() * (a.coins[1] - a.coins[0] + 1)); this.s.coins += c; if (this.rt.sess) this.rt.sess.coins += c; }
      for (const [lid, lp, la, lb] of a.loot || []) if (Math.random() < lp * (1 + this.sp('drop'))) this.gain(lid, la + Math.floor(Math.random() * (lb - la + 1)));
      if (a.burn && Math.random() < this.burnChance(a)) this.gain('burnt', 1);
      else for (const [id, n] of Object.entries(a.out || {})) this.gain(id, n);
      if (a.gem && Math.random() < 0.01) { this.gain(a.gem, 1); this.toast(`💎 ${ITEMS[a.gem].name} 발견!`, 'loot'); }
      for (const [rid, rp] of Object.entries(a.rare || {})) {
        if (Math.random() < rp * (1 + this.sp('drop'))) { this.gain(rid, 1); if (ITEMS[rid].kind === 'box') this.toast(`✨ ${ITEMS[rid].icon} ${ITEMS[rid].name} 발견!`, 'pet'); }
      }
      this.useEffects('act');
      this.addXp(A.skill, this.actionXp(A.skill, a));
      this.s.stats.actions++;
      const pet = PETS.find((p) => p.src === A.skill);
      if (pet) this.tryPet(pet);
    }
  }
  buryTick(dt) {
    const id = this.s.activity.bone;
    if (this.have(id) < 1) { this.toast('묻을 뼈가 없습니다', 'bad'); this.stop(); return; }
    this.rt.prog += (dt * (1 + this.toolSpeed('div'))) / 1.2;
    while (this.rt.prog >= 1) {
      this.rt.prog -= 1;
      if (this.have(id) < 1) { this.stop(); return; }
      this.give(id, -1);
      this.addXp('div', ITEMS[id].xp * (1 + this.sp('dxp')));
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
      if (rt.sess) rt.sess.t += dt;
      this.s.log.time = (this.s.log.time || 0) + dt;
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
    if (kind === 'hit' && this.s.numDeal === false) return;
    if (at === 'hero' && (kind === 'hurt' || kind === 'miss') && this.s.numTake === false) return;
    this.rt.fx.push({ at, text, kind, t: 0, x: Math.random() * 40 - 20 });
    if (this.rt.fx.length > 30) this.rt.fx.shift();
  }
  toast(text, kind = '') { if (!this.quiet) this.rt.log.push({ text, kind }); if (kind === 'pet') this.sound('rare'); }
  // 간단한 효과음 (설정에서 켬)
  sound(kind) {
    if (this.quiet || !this.s.sfx) return;
    try {
      this._ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const ac = this._ac, o = ac.createOscillator(), g = ac.createGain();
      const f = { lvl: [523, 784], rare: [660, 990], hit: [220, 180] }[kind] || [440, 440];
      o.frequency.setValueAtTime(f[0], ac.currentTime);
      o.frequency.linearRampToValueAtTime(f[1], ac.currentTime + 0.15);
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      o.connect(g).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.3);
    } catch (e) { /* 소리 미지원 */ }
  }
  // 목표까지: 남은 경험치 · 지금(또는 가장 좋은) 행동 기준 예상 시간
  goalEta(skill, target) {
    const need = Math.max(0, XP_TABLE[Math.min(target, XP_TABLE.length - 1)] - (this.s.xp[skill] || 0));
    const A = this.s.activity;
    let a = A?.type === 'skill' && A.skill === skill ? (ACTIONS[skill] || []).find((x) => x.id === A.act) : null;
    if (!a) a = (ACTIONS[skill] || []).filter((x) => this.lvl(skill) >= x.lvl).sort((x, y) => this.actionXp(skill, y) / this.actionTime(skill, y) - this.actionXp(skill, x) / this.actionTime(skill, x))[0];
    if (!a) return { need, sec: null, a: null };
    return { need, a, n: Math.ceil(need / this.actionXp(skill, a)), sec: (need / this.actionXp(skill, a)) * this.actionTime(skill, a) };
  }
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
  s.log = { ...base.log, ...(o.log || {}) };
  for (const k of ['first', 'got', 'gear']) s.log[k] = { ...(o.log?.[k] || {}) };
  s.goals = { ...(o.goals || {}) };
  s.effects = Object.fromEntries(Object.entries(o.effects || {}).filter(([, e]) => ITEMS[e?.id]?.kind === 'potion'));
  s.tools = Object.fromEntries(Object.entries(o.tools || {}).filter(([sk, id]) => ITEMS[id]?.kind === 'tool' && ITEMS[id].skill === sk));
  if (s.life && ITEMS[s.life]?.kind !== 'life') s.life = null;
  s.favPrayer = [...(o.favPrayer || [])]; s.favPet = [...(o.favPet || [])];
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
