// 별무리 개척기 — 화면
import {
  VERSION, SKILLS, SKILL, ITEMS, SLOTS, SLOT_IDS, SLOT_CATS, STYLES, ZONES, ACTIONS, PRAYERS, PETS, TIERS, STATS, STAT_IDS, SPELLS, CAPS,
  XP_TABLE, MAX_LVL, SPECIAL_NAMES, SHOP, FLAT_SP, HUNT_NAMES, HUNT_TIERS, HUNT_PER, huntTier, USE_NAMES, TOOLS,
} from './data.js';
import { exportSave, importSave, C } from './game.js';
import { tabCodex } from './codex.js';
import { tabTown } from './town.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const spText = (sp) => Object.entries(sp || {}).filter(([k]) => SPECIAL_NAMES[k]).map(([k, v]) => `${SPECIAL_NAMES[k]} +${FLAT_SP.has(k) ? fmt(v) : pct(v, v < 0.1 ? 1 : 0)}`).join(', ');
const spOr = (sp) => (Object.keys(sp || {}).length ? `<span class="sp">★ ${spText(sp)}</span>` : '');
// 물약 효과 글: % 와 최소 보장치
const potText = (it) => {
  const mins = Object.entries(it.fx).filter(([k]) => k.endsWith('Min')).map(([k, v]) => `최소 +${v}`);
  return `${spText(it.fx)}${mins.length ? ` (${mins.join(', ')})` : ''} · ${it.uses}${USE_NAMES[it.use] === '처치' ? '마리 처치' : '번 ' + USE_NAMES[it.use]}`;
};
const itemInfo = (it) => (it.kind === 'ammo' ? `${STATS[Object.keys(it.st)[0]].name} +${Object.values(it.st)[0]} · 공격마다 1개 · 요구 ${SKILL[it.req[0]].name} ${it.req[1]}`
  : it.kind === 'whistle' ? '보스 펫 확률 +15% · 30분 (게임 시간)'
    : it.kind === 'tome' ? `기도 배우기: ${PRAYERS.find((x) => x.id === it.pr)?.name}`
      : it.kind === 'potion' ? potText(it) : it.kind === 'tool' ? `${SKILL[it.skill].name} 채집 속도 +${pct(it.gspd)} · 요구 ${SKILL[it.req[0]].name} ${it.req[1]}` : it.kind === 'life' ? `${spText(it.fx)} · 요구 공예 ${it.req[1]}` : '');
const icol = (it) => (it.r > 1 ? it.rc : TIERS[it.t]?.c || 'inherit');
const stVal = (k, v) => (STATS[k].pct ? pct(v, 1) : fmt(v));
const stText = (st) => Object.entries(st || {}).filter(([, v]) => v).map(([k, v]) => `${STATS[k].icon}${STATS[k].name} +${stVal(k, v)}`).join(' ');
const sign = (v, d = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
const time = (sec) => sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : sec >= 60 ? `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초` : `${sec.toFixed(1)}초`;

const sumFx = (list) => { const o = {}; for (const f of list) for (const [k, v] of Object.entries(f || {})) o[k] = Math.round(((o[k] || 0) + v) * 10000) / 10000; return o; };
export class UI {
  constructor(game, hooks) {
    this.g = game;
    this.hooks = hooks;
    this.tab = 'combat';
    this.zone = Math.max(0, ZONES.findIndex((z) => z.mons.some((m) => m.id === (game.s.activity?.mon || game.s.huntMon))));
    this.skillSel = 'wood';
    this.sig = '';
    this.recMode = 'real';
    document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') setTimeout(() => e.target.blur(), 0); });
    $('#spdBtn').addEventListener('click', () => { this.g.cycleSpeed(); this.g.toast(`⏩ 게임 속도 x${this.g.speed()}`); });
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(true); }));
    $('#act').addEventListener('click', (e) => { if (e.target.id !== 'stopBtn') return; const d = this.dispAct?.(); if (d?.type === 'combat' && this.g.stopCombat) { this.g.stopCombat(); this.g.toast('전투를 멈췄습니다 (스킬은 그대로)'); } else { this.g.stop(); if (this.g.s.hunt) this.g.toast('스킬을 멈췄습니다 (전투는 그대로)'); } });
    this.render(true);
    if (!game.s.tut) {
      game.s.tut = true;
      this.modal('🌠 별무리 개척기에 오신 것을 환영합니다', `<ul style="padding-left:18px;margin:0;line-height:1.6">
        <li>⚔️ <b>전투</b>: 몬스터 옆 '싸우기'. 몬스터를 누르면 전리품 표</li>
        <li>🌲 <b>스킬</b>: 벌목 · 채광 · 낚시로 재료 → 대장 · 공예 · 요리로 장비와 음식</li>
        <li>🛡️ <b>장비</b>: 장비는 등급(일반~유물)이 무작위. 자동 장착을 켜 두면 편해요</li>
        <li>📈 전투 탭의 '올리면 좋은 스탯'으로 무엇을 키울지 확인</li>
        <li>⏩ 상단 x1 버튼으로 배속 (최대 x32)</li>
        <li>📖 <b>도감</b>: 몬스터 · 일지 · 아이템 백과 · 경험치 계산기</li></ul>`, [{ label: '시작하기', pri: true }]);
    }
  }

  // 바뀐 게 있을 때만 패널을 다시 그림 (스크롤 유지)
  signature() {
    const s = this.g.s;
    return JSON.stringify([this.tab, this.zone, this.skillSel, this.bankSig(), s.equip, s.activity, s.prayer, s.pet, s.pets, s.spell, this.recMode, s.autoEat, s.showNums, s.keepFood, s.autoEquip, s.favorDef, s.eatWorst, s.eatDanger, s.stopNoFood, s.goals, s.hideWeak, s.gearToast, s.favPrayer, s.favPet, s.sfx, s.cb, Object.values(s.effects || {}).map((e) => e.id), s.tools, s.life, s.autoPot, s.quests, s.talents, s.museum, s.trader, this.tab === 'town' && this.town === 'fest' ? s.candy : 0, this.town, this.codex, this.codexQ, this.calcSkill, this.calcTarget, SKILLS.map((k) => this.g.lvl(k.id)), 0, this.sigX ? this.sigX() : 0]);
  }
  // 전리품이 계속 들어와도 가방 때문에 다시 그리는 건 4초에 한 번 (화면을 누르면 바로)
  bankSig() {
    const now = performance.now();
    const iv = ['bank', 'gear', 'skills', 'town'].includes(this.tab) ? 4000 : 15000; // 가방을 안 보는 탭은 15초에 한 번
    if (this._bkS == null || now - (this._bkT || 0) > iv) { this._bkT = now; this._bkS = JSON.stringify(this.g.s.bank); }
    return this._bkS;
  }

  render(force = false) {
    const ae = document.activeElement;
    if (!force && ae?.closest?.('#panel') && (ae.tagName === 'SELECT' || (ae.tagName === 'INPUT' && /^(text|search|number)$/.test(ae.type)))) return;
    const view = [this.tab, this.zone, this.skillSel, this.town, this.codex].join('|');
    if (!force && view === this._view && performance.now() - (this._rT || 0) < 1200) return; // 같은 화면은 1.2초에 한 번만 다시 그림 (잔렉 줄이기 · 누르면 바로 반영)
    if (!force && view === this._view && performance.now() < (this._busy || 0)) return;
    const sig = this.signature();
    if (!force && sig === this.sig) return;
    const keep = this.saveScroll ? this.saveScroll() : null;
    this.sig = sig;
    this._view = view;
    this._rT = performance.now();
    const p = $('#panel');
    const top = p.scrollTop;
    p.innerHTML = '';
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    document.body.classList.toggle('cb', !!this.g.s.cb);
    this._seg = true;
    ({ combat: this.tabCombat, skills: this.tabSkills, gear: this.tabGear, bank: this.tabBank, codex: (el) => tabCodex(this, el), town: (el) => tabTown(this, el), more: this.tabMore })[this.tab].call(this, p);
    this.noWrapSeg?.(p);
    if (!force) p.scrollTop = top;
    if (keep) this.loadScroll(keep);
  }

  // 매 프레임: 상단 행동 패널 · 재화 · 알림
  frame() {
    const g = this.g, s = g.s, rt = g.rt;
    this.panelBusy?.();
    $('#coins').textContent = '💰 ' + fmt(s.coins);
    $('#cbLvl').innerHTML = `⚔ Lv ${g.combatLevel()} · 전투력 <span class="pw">${fmt(g.power())}</span>`;
    $('#spdBtn').textContent = 'x' + g.speed();
    const act = $('#act');
    const A = this.dispAct ? this.dispAct() : s.activity;
    const key = A ? A.type + (A.mon || A.act || A.bone || A.id) : 'idle';
    if (act._k !== key) { act._k = key; act.innerHTML = this.actHtml(); act._fl = new Set(); }
    if (A?.type === 'combat') {
      const m = rt.mon;
      const mx = g.maxHp();
      $('.hpP > div', act).style.width = pct(Math.max(0, rt.hp) / mx, 1);
      $('.hpP span', act).textContent = `${fmt(Math.max(0, rt.hp))} / ${fmt(mx)}`;
      $('.tmP > div', act).style.width = pct(Math.min(1, rt.atkT / g.atkInterval()), 1);
      const mm = MONSTER_OF(A.mon);
      $('.hpM > div', act).style.width = m ? pct(Math.max(0, rt.monHp) / m.hp, 1) : '0%';
      $('.hpM span', act).textContent = m ? `${fmt(rt.monHp)} / ${fmt(m.hp)}` : rt.dead > 0 ? `부활까지 ${rt.dead.toFixed(1)}초` : '다음 몬스터…';
      $('.tmM > div', act).style.width = m ? pct(Math.min(1, rt.monT / m.interval), 1) : '0%';
      $('.monIc', act).style.opacity = m ? 1 : 0.3;
      $('.heroIc', act).style.opacity = rt.dead > 0 ? 0.3 : 1;
      const food = Object.keys(s.bank).filter((id) => ITEMS[id]?.kind === 'food').reduce((a, id) => a + s.bank[id], 0);
      const v = g.vs(mm);
      $('.info', act).innerHTML = `처치 ${fmt(s.kills?.[A.mon] || 0)} · 음식 ${food ? fmt(food) + '개' : '<b style="color:#f87171">없음!</b>'} · 피해 ${v.min}~${v.mh}`;
      // 떠오르는 숫자
      const fl = $('.floats', act);
      for (const f of rt.fx) {
        if (act._fl.has(f)) continue;
        act._fl.add(f);
        const e = h('div', 'fl ' + f.kind, f.text);
        e.style.left = `calc(${f.at === 'hero' ? 20 : 80}% + ${f.x}px)`;
        fl.appendChild(e);
        setTimeout(() => e.remove(), 1000);
      }
      if (act._fl.size > 200) act._fl = new Set(rt.fx);
    } else if (A?.type === 'skill' || A?.type === 'bury') {
      $('.bar > div', act).style.width = pct(Math.min(1, rt.prog), 1);
      const sk = A.type === 'bury' ? 'div' : A.skill;
      const aa = A.type === 'skill' ? ACTIONS[A.skill].find((x) => x.id === A.act) : null;
      const left = aa?.in ? Math.min(...Object.entries(aa.in).map(([id, n]) => Math.floor(g.have(id) / n))) : null;
      $('.info', act).textContent = `${SKILL[sk].name} Lv ${g.lvl(sk)} · ${this.xpText(sk)}` + (A.type === 'bury' ? ` · 남은 뼈 ${fmt(g.have(A.bone))}` : '') + (left != null ? ` · 남은 횟수 ${fmt(left)}` : '');
    }
    this.frameX?.(act, A);
    // 물약 남은 횟수 (다시 그리지 않고 숫자만)
    document.querySelectorAll('.efl').forEach((e) => { const x = Object.values(s.effects || {}).find((y) => y.id === e.dataset.id); if (x) e.textContent = x.left; });
    // 이번 세션 기록 (0.5초마다)
    const se = $('.sess', act);
    if (se && rt.sess && (!this._sessT || performance.now() - this._sessT > 500)) {
      this._sessT = performance.now();
      const S = rt.sess, hr = Math.max(S.t, 1) / 3600;
      const xp = Object.values(S.xp).reduce((a, b) => a + b, 0);
      const got = Object.entries(S.got).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${ITEMS[id].icon}${fmt(n)}`).join(' ');
      se.innerHTML = `⏱ ${time(S.t)}${S.kills ? ` · 처치 ${fmt(S.kills)} (${fmt(S.kills / hr)}/시)` : ''} · XP ${fmt(xp / hr)}/시${S.coins ? ` · 💰 ${fmt(S.coins / hr)}/시` : ''}${S.food ? ` · 음식 ${fmt(S.food)}` : ''}${S.deaths ? ` · 사망 ${S.deaths}` : ''}${got ? `<br>획득 ${got}` : ''}`;
      this.noWrapSeg?.(se);
    }
    // 알림
    while (rt.log.length) {
      const l = rt.log.shift();
      if (this.popOk && !this.popOk(l.kind)) continue;
      const t = h('div', 'toast ' + l.kind, l.text);
      $('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 2600);
      while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
    }
    this.render();
  }
  actHtml() {
    const g = this.g, A = this.dispAct ? this.dispAct() : g.s.activity;
    if (!A) return '<div class="idle">쉬는 중 · 전투 또는 스킬을 골라 시작하세요</div>';
    const xh = this.actHtmlX?.(A);
    if (xh) return xh;
    if (A.type === 'combat') {
      const m = MONSTER_OF(A.mon);
      return `<div class="duel">
        <div class="fighter"><div class="ic heroIc">🧝</div><div class="nm">나 (${STYLES[g.style()].icon} ${STYLES[g.style()].name})</div><div class="bar hpP"><div></div><span></span></div><div class="bar tm tmP"><div></div></div></div>
        <div class="vs">VS</div>
        <div class="fighter"><div class="ic monIc">${m.icon}</div><div class="nm">${m.boss ? '👑 ' : ''}${m.name} Lv ${m.lvl} · ${STYLES[m.style].icon}</div><div class="bar mon hpM"><div></div><span></span></div><div class="bar tm tmM"><div></div></div></div>
      </div><div class="floats"></div><div class="actinfo"><span class="info"></span><button class="btn sm" id="stopBtn">■ 멈춤</button></div><div class="sess mut"></div>`;
    }
    const a = A.type === 'bury' ? { icon: ITEMS[A.bone].icon, name: ITEMS[A.bone].name + ' 묻기' } : ACTIONS[A.skill].find((x) => x.id === A.act);
    return `<div class="skillact"><div class="ic">${a.icon}</div><div class="grow"><b>${a.name}</b><div class="bar"><div></div></div><div class="actinfo"><span class="info"></span></div><div class="sess mut"></div></div><button class="btn sm" id="stopBtn">■ 멈춤</button></div>`;
  }
  xpText(id) {
    const g = this.g;
    const L = g.lvl(id), xp = g.s.xp[id] || 0;
    if (L >= MAX_LVL) return `최고 레벨 · ${fmt(xp)} XP`;
    return `${fmt(xp - XP_TABLE[L])} / ${fmt(XP_TABLE[L + 1] - XP_TABLE[L])} XP`;
  }
  lvBar(id) {
    const g = this.g, L = g.lvl(id), xp = g.s.xp[id] || 0;
    const p = L >= MAX_LVL ? 1 : (xp - XP_TABLE[L]) / (XP_TABLE[L + 1] - XP_TABLE[L]);
    return `<div class="lvbar"><div style="width:${pct(p, 1)}"></div></div>`;
  }

  // ---------- 전투 ----------
  tabCombat(p) {
    const g = this.g, s = g.s;
    const st = g.style();
    const pr = g.profile();
    const eff = (k) => fmt(C.eff(pr, k));
    const mainStat = st === 'melee' ? `<div>🗡️ 공격 <b>${eff('atk')}</b></div><div>💪 힘 <b>${eff('str')}</b></div>`
      : st === 'ranged' ? `<div>🏹 원거리 <b>${eff('rng')}</b></div><div>⏱ 공격 주기 <b>${g.atkInterval().toFixed(2)}초</b></div>`
        : `<div>🔮 마법 <b>${eff('mag')}</b></div><div>${g.spell().icon} 주문 배율 <b>x${g.spell().mult}</b></div>`;
    const card = h('div', 'card', `<b>${STYLES[st].icon} ${STYLES[st].name} 전투</b> <span class="mut">(무기로 결정)</span> · 전투력 <span class="pw">${fmt(g.power())}</span>
      <div class="stats" style="margin-top:6px">
        ${mainStat}
        <div>최대 피해 <b>${g.maxHit()}</b></div><div>🛡️ 방어 <b>${eff('def')}</b></div>
        <div>최대 체력 <b>${fmt(g.maxHp())}</b></div>${st === 'ranged' ? '' : `<div>공격 주기 <b>${g.atkInterval().toFixed(2)}초</b></div>`}
        <div>🩸 흡수 <b>${pct(C.ls(pr), 1)}</b></div><div>🧱 피해 감소 <b>${pct(C.dr(pr), 1)}</b></div>
      </div>
      <div class="mut" style="margin-top:4px">최종 스탯 = 레벨 + 장비 · 경험치: ${st === 'melee' ? '공격 · 힘' : STYLES[st].name} 100% + 방어 70%</div>`);
    p.appendChild(card);
    this.styleCard?.(p);
    this.swapStrip(p);
    this.effCard(p);
    this.ammoCard?.(p);
    if (st === 'magic') {
      const sp = h('div', 'seg');
      for (const x of SPELLS) {
        const lock = g.lvl('mag') < x.lvl;
        const b = h('button', g.spell().id === x.id ? 'on' : '', `${x.icon} ${x.name}<br><small>${lock ? '🔒 Lv ' + x.lvl : 'x' + x.mult}</small>`);
        if (lock) b.disabled = true;
        b.addEventListener('click', () => { s.spell = x.id; });
        sp.appendChild(b);
      }
      p.appendChild(sp);
    }

    const curT = ZONES[this.zone].t, cl = g.combatLevel();
    const zs = h('div', 'card zpick', `<div class="tstrip">${TIERS.map((T, t) => {
      const far = T.lvl > cl + 25;
      return `<button class="tc${t === curT ? ' on' : ''}${far ? ' far' : ''}" data-t="${t}" style="--tc:${T.c}"><b>${T.n}${this.qMark?.(ZONES.filter((z) => z.t === t).flatMap((z) => z.mons.map((m) => m.id)), true) || ''}</b><small>Lv ${T.lvl}+</small></button>`;
    }).join('')}</div>
      <div class="zbtns">${ZONES.map((z, i) => [z, i]).filter(([z]) => z.t === curT).map(([z, i]) => {
      const hn = z.mons.reduce((a, m) => a + huntTier(s.kills?.[m.id]), 0);
      return `<button class="zb${i === this.zone ? ' on' : ''}" data-i="${i}"><b>${z.n}${this.qMark?.(z.mons.map((m) => m.id)) || ''}</b><small>Lv ${z.mons[0].lvl}~${z.mons[3].lvl}${hn ? ` · 🏹${hn}/${z.mons.length * HUNT_TIERS.length}` : ''}</small></button>`;
    }).join('')}</div>`);
    zs.querySelectorAll('.tc').forEach((b) => b.addEventListener('click', () => { this.zone = ZONES.findIndex((z) => z.t === +b.dataset.t); }));
    zs.querySelectorAll('.zb').forEach((b) => b.addEventListener('click', () => { this.zone = +b.dataset.i; }));
    p.appendChild(zs);
    const on = zs.querySelector('.tc.on');
    if (on) zs.querySelector('.tstrip').scrollLeft = on.offsetLeft - zs.querySelector('.tstrip').clientWidth / 2 + on.offsetWidth / 2;
    this.lootSearch?.(p);
    const zn = ZONES[this.zone];
    for (const m of zn.mons) {
      const v = g.vs(m);
      const on = s.hunt === m.id;
      const danger = v.killsPerLife < 3;
      const r = h('div', 'row' + (on ? ' on' : ''), `
        <div class="ic">${m.icon}</div>
        <div class="info"><div class="nm">${m.boss ? '👑 ' : ''}${m.name}${this.qMark?.([m.id]) || ''} <span class="mut">Lv ${m.lvl} · 체력 ${fmt(m.hp)} · 🔍 전리품${huntTier(s.kills?.[m.id]) ? ` · 🏹${huntTier(s.kills?.[m.id])}` : ''}</span></div>
        <div class="mut">${STYLES[m.style].icon}${STYLES[m.style].name} · 공격 ${m.atk} · 힘 ${m.str} · 방어 ${v.mdef} · ${m.interval}초 · 약점 ${STYLES[m.weak].icon}</div>
        <div class="mut sp">${this.huntLine(m)}</div>
        <div class="mut">내 피해 ${v.min}~${v.mh} · 처치 약 ${time(v.ttk)} · 적 명중 ${pct(v.mHit)} · 최대 ${v.mMax}${danger ? ' <span style="color:#f87171">⚠ 위험</span>' : ''} · 처치 ${fmt(s.kills?.[m.id] || 0)}</div></div>
        <button class="btn ${on ? '' : 'pri'}">${on ? '■' : '⚔ 싸우기'}</button>`);
      $('button', r).addEventListener('click', (e) => { e.stopPropagation(); if (on) g.stopCombat(); else g.startCombat(m.id); });
      $('.info', r).addEventListener('click', () => this.lootModal(m));
      $('.ic', r).addEventListener('click', () => this.lootModal(m));
      p.appendChild(r);
    }
    this.recCard(p, zn);
    p.appendChild(h('div', 'card mut', '공식 · 최대 피해: 근접 (공격+힘)×0.85, 원거리 원거리×0.85, 마법 마법×0.70×주문 배율 → 몬스터 방어×0.3만큼 깎임 · 내 공격은 항상 맞고 최소~최대 사이 피해 · 적 명중률 = 적 공격 ÷ (적 공격 + 내 방어×0.43) · 맞으면 적 힘×0.42~0.58 피해를 방어 효율만큼 줄이고 피해 감소 %를 한 번 더 뺌 · 약점 방식으로 때리면 적 방어 절반'));
  }

  // 몬스터 도감(사냥꾼 숙련)으로 이 몬스터에게 받고 있는 보너스
  huntLine(m) {
    const k = this.g.s.kills?.[m.id] || 0, t = huntTier(k), next = HUNT_TIERS[t];
    const fx = t ? `드롭 +${pct(t * HUNT_PER.drop, 0)} · 피해 +${pct(t * HUNT_PER.dmg, 0)} · 방어 +${pct(t * HUNT_PER.def, 1)}` : '보너스 없음';
    return `🏹 ${HUNT_NAMES[t]} (${t}/${HUNT_TIERS.length}) · ${fx}${next ? ` · 다음 단계까지 ${fmt(next - k)}마리` : ' · 최고 단계'}`;
  }

  // 지금 어떤 스탯을 올리는 게 좋은지: 실제 전투(분당 처치) / 전투력 두 기준
  recCard(p, zn) {
    const g = this.g, s = g.s;
    const A = s.activity;
    void A;
    const m = s.hunt ? MONSTER_OF(s.hunt) : zn.mons[0];
    const r = g.analyze(m);
    const list = this.recMode === 'real' ? r.real : r.pow;
    const key = this.recMode === 'real' ? 'real' : 'power';
    const rows = list.slice(0, 6).map((x, i) => `<div class="${i === 0 ? 'best' : ''}">${i === 0 ? '👍 ' : ''}${x.label}</div><div class="up">${sign(x[key], 2)}</div>`).join('');
    const c = h('div', 'card', `<b>📈 지금 올리면 좋은 스탯</b>
      <div class="seg" style="margin-top:6px"><button data-m="real" class="${this.recMode === 'real' ? 'on' : ''}">⚔ 실제 전투</button><button data-m="pow" class="${this.recMode === 'pow' ? 'on' : ''}">💪 전투력</button></div>
      <div class="mut">${this.recMode === 'real' ? `${m.icon} ${m.name} 상대로 분당 처치 수 증가 (지금 ${r.now.kpm.toFixed(1)}마리/분)` : `몬스터와 상관없는 순수 강함 증가 (지금 ${fmt(r.power)})`}</div>
      <div class="rec">${rows || '<div class="mut">올릴 수 있는 스탯이 없습니다</div>'}</div>
      <div class="mut" style="margin-top:4px">레벨 +1 / 장비 스탯 +10 (흡수 · 피해 감소는 +1%p) 했을 때 기준 · 흡수 최대 ${pct(CAPS.ls)} · 피해 감소 최대 ${pct(CAPS.dr)}</div>`);
    c.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { this.recMode = b.dataset.m; }));
    p.appendChild(c);
  }

  // 몬스터를 누르면 전리품 표
  lootModal(m) {
    const g = this.g;
    const mul = g.dropMult();
    const rows = m.loot.map((l) => {
      const it = ITEMS[l.id];
      const pr = l.fixed ? 1 : Math.min(1, l.p * mul);
      const n = l.a === l.b ? `${l.a}` : `${l.a}~${l.b}`;
      const col = it.kind === 'gear' ? `color:${icol(it)}` : '';
      return `<div class="lr"><span class="li">${it.icon}</span><span class="ln" style="${col}">${it.name}</span><span class="lq">x${n}</span><span class="lp${pr >= 1 ? ' all' : ''}">${pr >= 1 ? '항상' : pct(pr, pr < 0.01 ? 2 : 1)}</span></div>`;
    }).join('');
    const pet = m.boss ? PETS.find((x) => x.src === 'boss:' + m.z) : null;
    this.modal(`${m.icon} ${m.name} 전리품`, `<div class="mut">Lv ${m.lvl} · 💰 ${fmt(m.coins[0])}~${fmt(m.coins[1])} · 드롭률 보너스 ${sign(mul - 1, 0)} 적용</div>
      <div class="mut">장비는 등급(일반~유물)이 무작위로 붙습니다</div>
      <div class="ltbl">${rows}${pet ? `<div class="lr"><span class="li">${pet.icon}</span><span class="ln" style="color:#f0abfc">펫 ${pet.name}</span><span class="lq">x1</span><span class="lp">${pct(Math.min(1, pet.p * mul), 2)}</span></div>` : ''}</div>`, [{ label: '닫기' }]);
  }

  // ---------- 스킬 ----------
  tabSkills(p) {
    const g = this.g, s = g.s;
    this.swapStrip(p);
    this.bgHuntCard?.(p);
    for (const [ty, nm] of [['gather', '⛏️ 채집'], ['make', '🔨 가공 · 제작'], ['support', '✨ 기타']]) {
      p.appendChild(h('div', 'mut', nm));
      const list = h('div', 'grid2');
      for (const k of SKILLS.filter((x) => x.type === ty)) {
        const goal = s.goals?.[k.id];
        const c = h('div', 'slot', `<div class="n">${k.icon} ${k.name} <span class="mut">Lv ${g.lvl(k.id)}${goal ? ` → 🎯${goal}` : ''}</span></div><div class="t">${k.desc}</div>${this.lvBar(k.id)}`);
        c.style.cursor = 'pointer';
        c.addEventListener('click', () => { this.skillSel = k.id; });
        if (k.id === this.skillSel) c.style.borderColor = 'var(--acc)';
        list.appendChild(c);
      }
      p.appendChild(list);
    }
    if (this.toolShop) {
      const tc = h('div', 'slot', `<div class="n">🛠️ 도구 제작 <span class="mut">${Object.keys(TOOLS).map((sk) => `${TOOLS[sk].icon}${g.toolTier(sk) + 1}`).join(' ')}</span></div><div class="t">스킬마다 도구 1개 · 재료와 골드로 21단계까지 업그레이드</div>`);
      tc.style.cursor = 'pointer';
      if (this.skillSel === 'tools') tc.style.borderColor = 'var(--acc)';
      tc.addEventListener('click', () => { this.skillSel = 'tools'; });
      p.appendChild(tc);
      if (this.skillSel === 'tools') { this.toolShop(p); return; }
    }
    if (!SKILL[this.skillSel] || (!ACTIONS[this.skillSel] && this.skillSel !== 'div')) this.skillSel = 'wood';
    const k = SKILL[this.skillSel];
    p.appendChild(h('div', 'h', `${k.icon} ${k.name} Lv ${g.lvl(k.id)} <span class="mut">${this.xpText(k.id)}</span>`));
    const goal = s.goals?.[k.id];
    if (goal) {
      const e = g.goalEta(k.id, goal);
      p.appendChild(h('div', 'card mut', `🎯 목표 Lv ${goal} · 남은 ${fmt(e.need)} XP${e.a ? ` · ${e.a.name} ${fmt(e.n)}회 · 약 ${time(e.sec / g.speed())} (x${g.speed()})` : ''} <span class="mut">(📖 도감 → 계산기에서 변경)</span>`));
    }
    if (k.id === 'div') { this.tabDiv(p); return; }
    if (TOOLS[k.id]) {
      const cur = ITEMS[s.tools?.[k.id]];
      const tc = h('div', 'card', `${TOOLS[k.id].icon} 도구: <b>${cur ? `${cur.name} (${cur.t + 1}단계 · ${TOOLS[k.id].fx} +${pct(cur.gspd)})` : '없음'}</b> <button class="btn sm tb">🛠️ 도구 제작</button>`);
      $('.tb', tc).addEventListener('click', () => { this.skillSel = 'tools'; });
      p.appendChild(tc);
    }
    if (k.type === 'make' || k.type === 'gather') this.effCard(p);
    this.bestActCard?.(p, k);
    let group = '';
    const hiL = g.lvl(k.id) + 15;
    const hidden = ACTIONS[k.id].filter((a) => a.lvl > hiL).length;
    for (const a of ACTIONS[k.id].filter((x) => x.lvl <= hiL)) {
      if (a.group && a.group !== group) { group = a.group; p.appendChild(h('div', 'mut', group)); }
      const lock = g.lvl(k.id) < a.lvl;
      const on = s.activity?.type === 'skill' && s.activity.act === a.id && s.activity.skill === k.id;
      const io = a.thief ? `성공률 <b>${pct(g.stealChance(a))}</b> · 💰${fmt(a.coins[0])}~${fmt(a.coins[1])} · ${a.loot.map((l) => ITEMS[l[0]].icon).join('')} · 들키면 한 번 쉼` : [a.in ? '필요 ' + Object.entries(a.in).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} ${n} (보유 ${fmt(g.have(id))})`).join(', ') : '', '획득 ' + Object.entries(a.out).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} ${n}`).join(', ')].filter(Boolean).join(' · ');
      const burn = g.burnChance(a);
      const it = ITEMS[Object.keys(a.out)[0]] || {};
      const gearInfo = it.kind === 'gear' ? `<div class="mut">${this.gearLine(it)} · 등급 무작위</div>` : itemInfo(it) ? `<div class="mut sp">${itemInfo(it)}</div>` : '';
      const r = h('div', 'row' + (lock ? ' lock' : '') + (on ? ' on' : ''), `<div class="ic">${a.icon}</div>
        <div class="info"><div class="nm">${a.name}${this.qMark?.(Object.keys(a.out || {})) || ''} <span class="mut">Lv ${a.lvl}</span></div><div class="mut">${io}</div>${gearInfo}
        <div class="mut">XP ${g.actionXp(k.id, a).toFixed(0)} · ${g.actionTime(k.id, a).toFixed(1)}초${burn ? ` · 태울 확률 ${pct(burn)}` : ''}</div></div>
        ${!lock && a.in && !g.hasInputs(a) && g.canFill?.(a.in) ? '<button class="btn sm dcp">🔽 분해</button>' : ''}<button class="btn go ${on ? '' : 'pri'}"${lock ? ' disabled' : ''}>${lock ? '🔒' : on ? '■' : '▶'}</button>`);
      $('.go', r).addEventListener('click', () => { if (on) g.stop(); else g.startSkill(k.id, a.id); });
      $('.dcp', r)?.addEventListener('click', () => g.fillFor(a.in));
      p.appendChild(r);
    }
    if (hidden) p.appendChild(h('div', 'mut', `더 높은 행동 ${hidden}개는 레벨이 오르면 보입니다`));
    const pet = PETS.find((x) => x.src === k.id);
    if (pet) p.appendChild(h('div', 'card mut', `행동마다 펫 ${pet.icon} ${pet.name} 확률 1/${Math.round(1 / pet.p)} · 레벨이 요구 레벨보다 높을수록 빨라짐 (1레벨당 +1%, 최대 2배)`));
  }

  gearLine(it) {
    return [stText(it.st), it.speed ? `주기 ${it.speed}초` : '', it.twoHand ? '양손' : '', `요구 ${SKILL[it.req[0]].name} ${it.req[1]}`].filter(Boolean).join(' · ');
  }

  // ---------- 장비 (소분류: 전체 · 무기 · 방어구 · 장신구 · 기타) ----------
  tabGear(p) {
    const g = this.g, s = g.s;
    const cat = this.gearCat || 'all';
    const inCat = (sl) => cat === 'all' || SLOTS[sl]?.cat === cat;
    // 요약: 전투력 · 장비 스탯
    const b = g.bonuses();
    const sum = h('div', 'card gsum', `<div class="gpow">⚔ 전투력 <b>${fmt(g.power())}</b> <span class="mut">· ${STYLES[g.style()].icon} ${STYLES[g.style()].name}</span></div>
      <div class="stats">${STAT_IDS.map((k) => `<div>${STATS[k].icon} ${STATS[k].name} <b>+${stVal(k, b.st[k])}</b></div>`).join('')}</div>`);
    p.appendChild(sum);
    // 소분류 버튼
    const tabs = [['all', '📋 전체'], ...Object.entries(SLOT_CATS).map(([k, c]) => [k, `${c.icon} ${c.name}`]), ['etc', '🧰 기타']];
    const seg = h('div', 'seg gcat');
    for (const [k, n] of tabs) {
      const bt = h('button', k === cat ? 'on' : '', n);
      bt.addEventListener('click', () => { this.gearCat = k; this._rT = 0; this.render(true); });
      seg.appendChild(bt);
    }
    p.appendChild(seg);

    if (cat === 'etc') {
      const lf = ITEMS[s.life];
      const lc = h('div', 'card', `<b>🌿 생활 장신구</b> ${lf ? `${lf.icon} ${lf.name} <span class="sp">${spText(lf.fx)}</span> <button class="btn sm lu">해제</button>` : '<span class="mut">없음 (대장에서 제작 · 가방에서 장착)</span>'}
        <div class="mut" style="margin-top:4px">🧰 도구: ${Object.entries(TOOLS).map(([sk, t]) => `${t.icon} ${ITEMS[s.tools?.[sk]]?.name || '없음'}`).join(' · ')}</div>
        <div style="margin-top:6px"><b>기도 · 펫 · 기타 보너스</b><div class="sp">${spText(b.sp) || '없음'}</div></div>`);
      $('.lu', lc)?.addEventListener('click', () => g.unequipLife());
      p.appendChild(lc);
      this.gearSettings(p);
      this.gearToolsCard?.(p);
      p.appendChild(h('div', 'h', '🐾 펫'));
      this.tabPets(p);
      return;
    }

    // 착용 중 (부위 칸)
    const slots = SLOT_IDS.filter(inCat);
    p.appendChild(h('div', 'h', `착용 중 <span class="mut">${slots.filter((sl) => s.equip[sl]).length} / ${slots.length}칸 · 칸을 누르면 해제</span>`));
    const grid = h('div', 'grid2');
    for (const sl of slots) {
      const it = ITEMS[s.equip[sl]];
      const star = g.sfStars ? g.sfStars(sl) : 0;
      const c = h('div', 'slot' + (it ? '' : ' empty'), `<div class="t">${SLOTS[sl].icon} ${SLOTS[sl].name}${star ? ` <span class="star">★${star}</span>` : ''}</div>
        <div class="n" style="color:${it ? icol(it) : 'var(--mut)'}">${it ? it.icon + ' ' + it.name : '비어 있음'}</div>${it ? `<div class="t">${stText(it.st)}</div>` : ''}`);
      if (it) { c.style.cursor = 'pointer'; c.addEventListener('click', () => g.unequip(sl)); }
      grid.appendChild(c);
    }
    p.appendChild(grid);

    // 가방의 장비: 부위별로 묶고, 전투력이 오르는 것부터
    const all = Object.keys(s.bank).filter((id) => ITEMS[id]?.kind === 'gear' && inCat(ITEMS[id].slot));
    const bySlot = {};
    for (const id of all) {
      const it = ITEMS[id], ok = g.canEquip(id), d = g.equipDelta(id);
      if (s.hideWeak && ok && d < -0.05) continue;
      (bySlot[it.slot] ||= []).push({ id, it, ok, d });
    }
    const tot = Object.values(bySlot).reduce((a, l) => a + l.length, 0);
    p.appendChild(h('div', 'h', `가방의 장비 <span class="mut">${tot}종${s.hideWeak ? ' · 약한 장비 숨김' : ''}</span>`));
    if (!tot) p.appendChild(h('div', 'card mut', '이 분류의 장비가 없습니다 · 몬스터 드롭 · 대장 제작으로 얻습니다'));
    this._gOpen ||= new Set();
    for (const sl of slots) {
      const list = bySlot[sl];
      if (!list?.length) continue;
      list.sort((a, c) => (c.ok - a.ok) || (c.d - a.d) || (c.it.t - a.it.t) || (c.it.r - a.it.r));
      const up = list.filter((x) => x.ok && x.d >= 0.05).length;
      const det = h('details', 'gslot');
      // 열림/닫힘은 처음 한 번만 정하고 그 뒤로는 그대로 (전리품이 들어올 때마다 열렸다 닫혔다 하지 않게)
      this._gSt ||= {};
      const sk = cat + '|' + sl;
      if (!(sk in this._gSt)) this._gSt[sk] = this._gOpen.has(sl) || !!up || cat !== 'all';
      det.open = this._gSt[sk];
      det.addEventListener('toggle', () => { this._gSt[sk] = det.open; if (det.open) this._gOpen.add(sl); else this._gOpen.delete(sl); });
      det.appendChild(h('summary', '', `${SLOTS[sl].icon} <b>${SLOTS[sl].name}</b> <span class="mut">${list.length}종</span>${up ? ` <span class="up">▲ 더 좋은 장비 ${up}</span>` : ''}`));
      // 펼친 부위만 줄을 만듦 (렉 줄이기) · 처음 15개만, 나머지는 더 보기
      const fill = () => {
        if (det._filled) return;
        det._filled = true;
        const more = this._gMore?.has(sl);
        const shown = more ? list : list.slice(0, cat === 'all' ? 8 : 15);
        for (const x of shown) det.appendChild(this.gearRow(x));
        if (!more && list.length > shown.length) {
          const mb = h('button', 'btn sm', `더 보기 (${list.length - shown.length}개)`);
          mb.style.margin = '6px 4px 8px';
          mb.addEventListener('click', () => { (this._gMore ||= new Set()).add(sl); this.render(true); });
          det.appendChild(mb);
        }
      };
      if (det.open) fill();
      det.addEventListener('toggle', () => { if (det.open) fill(); });
      p.appendChild(det);
    }
    if (cat === 'all') { this.gearSettings(p); this.gearToolsCard?.(p); }
  }

  gearRow({ id, it, ok, d }) {
    const g = this.g;
    {
        const dt = Math.abs(d) >= 0.05 ? `<span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d) < 10 ? Math.abs(d).toFixed(1) : fmt(Math.abs(d))}</span>` : '<span class="mut">＝</span>';
        const r = h('div', 'row grow' + (ok ? '' : ' lock'), `<div class="ic">${it.icon}</div><div class="info"><div class="nm" style="color:${icol(it)}">${it.name} <span class="mut">x${g.have(id)}</span></div>
          <div class="gst">${stText(it.st)}</div><div class="mut">${dt} · ${it.style ? STYLES[it.style].icon + ' ' : ''}요구 ${SKILL[it.req[0]].name} ${it.req[1]}${it.speed ? ` · 주기 ${it.speed}초` : ''}</div></div>
          <div class="gbtn"><button class="btn sm pri eq"${ok ? '' : ' disabled'}>장착</button><button class="btn sm sl">💰${fmt(it.value)}</button></div>`);
        $('.eq', r).addEventListener('click', () => g.equip(id));
        $('.sl', r).addEventListener('click', () => g.sell(id, 1));
        return r;
    }
  }

  // 장비 설정 (접어 둠)
  gearSettings(p) {
    const g = this.g, s = g.s;
    const ae = h('details', 'card', `<summary><b>⚙ 장비 설정</b> <span class="mut">자동 장착 ${s.autoEquip ? '켜짐' : '꺼짐'}</span></summary>
      <label class="tg"><input type="checkbox" class="ae"${s.autoEquip ? ' checked' : ''}> 🔄 더 좋은 장비 자동 장착</label>
      <label class="tg"><input type="checkbox" class="fd"${s.favorDef ? ' checked' : ''}> 🛡️ 자동 장착은 방어 우선</label>
      <label class="tg"><input type="checkbox" class="hw"${s.hideWeak ? ' checked' : ''}> 🙈 지금보다 약한 장비 숨기기</label>
      <label class="tg">📦 장비 드롭 알림 <select class="gt">${[[1, '모두 보기'], [3, '희귀 이상만'], [4, '영웅 이상만'], [5, '전설 이상만'], [99, '끄기']].map(([v, n]) => `<option value="${v}"${(s.gearToast ?? 1) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="mut">장비는 등급(일반~유물)이 무작위로 붙고 등급이 높을수록 스탯이 큽니다 · ▲▼는 끼었을 때 전투력 변화</div>`);
    if (this._gSetOpen) ae.open = true;
    ae.addEventListener('toggle', () => { this._gSetOpen = ae.open; });
    $('.ae', ae).addEventListener('change', (e) => { s.autoEquip = e.target.checked; if (s.autoEquip) Object.keys(s.bank).filter((id) => ITEMS[id].kind === 'gear').forEach((id) => g.autoEquipCheck(id)); });
    $('.fd', ae).addEventListener('change', (e) => { s.favorDef = e.target.checked; });
    $('.hw', ae).addEventListener('change', (e) => { s.hideWeak = e.target.checked; this.render(true); });
    $('.gt', ae).addEventListener('change', (e) => { s.gearToast = +e.target.value; });
    p.appendChild(ae);
  }

  // 마신 물약 (남은 횟수는 상단 행동 패널에서도 보임)
  effCard(p) {
    const g = this.g, s = g.s;
    const ef = Object.values(s.effects || {});
    const c = h('div', 'card', `<b>🧪 물약 효과</b> <label class="tg" style="display:inline-flex;margin-left:8px"><input type="checkbox" class="ap"${s.autoPot ? ' checked' : ''}> 끝나면 자동으로 다시 마시기</label>
      ${ef.length ? ef.map((e) => `<div class="sp">${ITEMS[e.id].sub} ${ITEMS[e.id].name} · ${spText(ITEMS[e.id].fx)} · <span class="efl" data-id="${e.id}">${e.left}</span>회 남음 (보유 ${fmt(g.have(e.id))})</div>`).join('') : '<div class="mut">마신 물약 없음 · 가방에서 마시기 (연금술로 제작)</div>'}`);
    $('.ap', c).addEventListener('change', (e) => { s.autoPot = e.target.checked; });
    p.appendChild(c);
  }

  // 스킬 화면에서 바로 펫 · 기도 바꾸기
  swapStrip(p) {
    const g = this.g, s = g.s;
    const prs = PRAYERS.filter((x) => (g.prayerOpen ? g.prayerOpen(x) : g.lvl('div') >= x.lvl));
    const pets = PETS.filter((x) => s.pets.includes(x.id));
    const fav = (list, favs) => [...list].sort((a, b) => favs.includes(b.id) - favs.includes(a.id));
    void fav;
    const c = h('div', 'card mut', `✅ 상시 적용 중: 🙏 기도 ${prs.length}개 · 🐾 펫 ${pets.length}마리 <span class="nw">(얻으면 바로 모두 적용)</span>`);
    p.appendChild(c);
  }

  // ---------- 가방 · 상점 ----------
  tabBank(p) {
    const g = this.g, s = g.s;
    const allIds = Object.keys(s.bank).filter((id) => ITEMS[id] && ITEMS[id].kind !== 'gear');
    const BC = [['mat', '🪵 재료', (k) => k === 'mat'], ['food', '🍲 음식', (k) => k === 'food' || k === 'raw'], ['bone', '🦴 뼈', (k) => k === 'bone'], ['pot', '🧪 물약', (k) => k === 'potion'], ['box', '🎁 상자', (k) => k === 'box'], ['etc', '🧰 기타', (k) => !['mat', 'food', 'raw', 'bone', 'potion', 'box'].includes(k)]];
    const bc = this.bankCat || 'mat';
    const seg = h('div', 'seg gcat');
    for (const [k, n, f] of BC) {
      const c = allIds.filter((id) => f(ITEMS[id].kind)).length;
      const bt = h('button', k === bc ? 'on' : '', `${n}<small style="display:block;color:var(--mut);font-size:10px">${c}</small>`);
      bt.addEventListener('click', () => { this.bankCat = k; this._bkMore = false; this.render(true); });
      seg.appendChild(bt);
    }
    const fn = BC.find((x) => x[0] === bc)[2];
    const ids0 = allIds.filter((id) => fn(ITEMS[id].kind)).sort((a, b) => (ITEMS[a].kind + String(ITEMS[a].t ?? 0).padStart(2, '0')).localeCompare(ITEMS[b].kind + String(ITEMS[b].t ?? 0).padStart(2, '0')) || ITEMS[a].name.localeCompare(ITEMS[b].name));
    const ids = this._bkMore ? ids0 : ids0.slice(0, 60);
    p.appendChild(h('div', 'h', `🎒 가방 (${allIds.length}종) · 💰 ${fmt(s.coins)}`));
    p.appendChild(seg);
    if (!ids.length) p.appendChild(h('div', 'card mut', '이 분류에는 아이템이 없습니다'));
    for (const id of ids) {
      const it = ITEMS[id];
      const extra = it.kind === 'food' ? ` · 회복 ${it.heal}` : it.kind === 'bone' ? ` · 신성 XP ${it.xp}` : itemInfo(it) ? `<br><span class="sp">${itemInfo(it)}</span>` : '';
      const keep = it.kind === 'food' ? `<button class="btn sm kp">${s.keepFood[id] ? '🔒 아껴 둠' : '🍽 먹음'}</button>`
        : it.kind === 'potion' ? '<button class="btn sm pri use">마시기</button>'
          : it.kind === 'box' ? '<button class="btn sm pri use">열기</button><button class="btn sm useA">모두 열기</button>'
            : it.kind === 'tool' || it.kind === 'life' ? `<button class="btn sm pri use"${g.canUse(id) ? '' : ' disabled'}>장착</button>`
              : it.kind === 'whistle' || it.kind === 'tome' ? '<button class="btn sm pri use">사용</button>' : '';
      const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name} <span class="mut">x${fmt(g.have(id))}</span></div><div class="mut">개당 💰${fmt(it.value)}${extra}</div></div>
        ${keep}<button class="btn sm s1">1개 판매</button><button class="btn sm sa">모두</button>`);
      $('.use', r)?.addEventListener('click', () => (it.kind === 'potion' ? g.drink(id) : it.kind === 'box' ? g.openBox(id, 1) : it.kind === 'tool' ? g.equipTool(id) : it.kind === 'life' ? g.equipLife(id) : g.useItem(id)));
      $('.useA', r)?.addEventListener('click', () => g.openBox(id, g.have(id)));
      if (it.kind === 'food') $('.kp', r).addEventListener('click', () => { if (s.keepFood[id]) delete s.keepFood[id]; else s.keepFood[id] = true; s.keepFood = { ...s.keepFood }; });
      $('.s1', r).addEventListener('click', () => g.sell(id, 1));
      $('.sa', r).addEventListener('click', () => g.sell(id, g.have(id)));
      p.appendChild(r);
    }
    if (ids.length < ids0.length) {
      const mb = h('button', 'btn', `더 보기 (${ids0.length - ids.length}개)`);
      mb.addEventListener('click', () => { this._bkMore = true; this.render(true); });
      p.appendChild(mb);
    }
    p.appendChild(h('div', 'h', '🏪 상점'));
    for (const sh of SHOP) {
      const it = ITEMS[sh.id];
      const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name}</div><div class="mut">${it.kind === 'gear' ? this.gearLine(it) : `회복 ${it.heal}`}</div></div><button class="btn sm pri b1"${s.coins >= sh.price ? '' : ' disabled'}>💰 ${fmt(sh.price)}</button><button class="btn sm b10"${s.coins >= sh.price * 10 ? '' : ' disabled'}>x10</button>`);
      $('.b1', r).addEventListener('click', () => g.buy(sh.id));
      $('.b10', r).addEventListener('click', () => { for (let i = 0; i < 10; i++) g.buy(sh.id); });
      p.appendChild(r);
    }
  }

  // ---------- 신성 ----------
  tabDiv(p) {
    const g = this.g, s = g.s;
    p.appendChild(h('div', 'card', `<b>✨ 신성 Lv ${g.lvl('div')}</b> <span class="mut">${this.xpText('div')}</span>${this.lvBar('div')}<div class="mut">몬스터 뼈를 묻어 수련 · 해금한 기도는 모두 상시 적용됩니다</div>`));
    p.appendChild(h('div', 'h', '🦴 뼈 묻기'));
    const bones = Object.keys(s.bank).filter((id) => ITEMS[id].kind === 'bone');
    if (!bones.length) p.appendChild(h('div', 'mut', '뼈가 없습니다. 몬스터를 처치하면 얻습니다.'));
    for (const id of bones) {
      const on = s.activity?.type === 'bury' && s.activity.bone === id;
      const r = h('div', 'row' + (on ? ' on' : ''), `<div class="ic">🦴</div><div class="info"><div class="nm">${ITEMS[id].name} <span class="mut">x${fmt(g.have(id))}</span></div><div class="mut">XP ${ITEMS[id].xp} · 1.2초</div></div><button class="btn ${on ? '' : 'pri'}">${on ? '■' : '▶ 묻기'}</button>`);
      $('button', r).addEventListener('click', () => (on ? g.stop() : g.startBury(id)));
      p.appendChild(r);
    }
    p.appendChild(h('div', 'h', '🙏 기도'));
    p.appendChild(h('div', 'card', `<b>합계</b> <span class="sp">${spText(sumFx(g.openPrayers().map((x) => x.fx))) || '없음'}</span>`));
    for (const pr of [...PRAYERS].sort((a, b) => s.favPrayer.includes(b.id) - s.favPrayer.includes(a.id))) {
      const lock = g.prayerOpen ? !g.prayerOpen(pr) : g.lvl('div') < pr.lvl;
      const r = h('div', 'row' + (lock ? ' lock' : ' on'), `<div class="ic">${pr.icon}</div><div class="info"><div class="nm">${pr.name} <span class="mut">Lv ${pr.lvl}${pr.tome ? (s.tomes || []).includes(pr.id) ? ' · 📕 배움' : ' · 📕 기도서 필요' : ''}</span></div><div class="mut sp">★ ${spText(pr.fx)}</div></div><span class="${lock ? 'mut' : 'ok'} nw">${lock ? '🔒 잠김' : '✅ 적용 중'}</span>`);
      p.appendChild(r);
    }
  }

  // ---------- 펫 ----------
  tabPets(p) {
    const g = this.g, s = g.s;
    p.appendChild(h('div', 'card', `펫 ${s.pets.length} / ${PETS.length} · <span class="mut">가진 펫은 모두 상시 적용 · 같은 펫을 또 얻으면 레벨 업 (최대 Lv ${g.PET_MAX || 10} · 레벨마다 효과 +12%)</span><div><b>합계</b> <span class="sp">${spText(sumFx(s.pets.map((id) => (g.petFx ? g.petFx(id) : PETS.find((x) => x.id === id)?.fx)))) || '없음'}</span></div>`));
    for (const pet of [...PETS].sort((a, b) => s.favPet.includes(b.id) - s.favPet.includes(a.id))) {
      const own = s.pets.includes(pet.id);
      const src = pet.srcText ? pet.srcText : pet.src.startsWith('boss:') ? `${MONSTER_OF('m' + pet.src.slice(5) + '_3')?.name} 처치 · 확률 1/${Math.round(1 / pet.p)}` : pet.src === 'event' ? '🎉 별빛 축제 상점' : `${SKILL[pet.src].name} 행동 · 확률 1/${Math.round(1 / pet.p)}`;
      const r = h('div', 'row' + (own ? ' on' : ' lock'), `<div class="ic">${own ? pet.icon : '❔'}</div><div class="info"><div class="nm">${own ? `${pet.name} <span class="plv">Lv ${g.petLv(pet.id)}</span>` : '???'}</div><div class="mut">${src}</div><div class="mut sp">★ ${spText(own ? g.petFx(pet.id) : pet.fx)}</div></div><span class="${own ? 'ok' : 'mut'} nw">${own ? (g.petLv(pet.id) >= (g.PET_MAX || 10) ? '👑 최대' : '✅ 적용 중') : '미획득'}</span>`);
      if (own) { r.style.cursor = 'pointer'; r.title = '눌러서 화면에 함께 다니는 펫으로'; r.addEventListener('click', () => { s.pet = pet.id; }); }
      p.appendChild(r);
    }
  }

  // ---------- 설정 ----------
  tabMore(p) {
    const g = this.g, s = g.s;
    this.popCard?.(p);
    const c = h('div', 'card', `<b>설정</b>
      <label class="tg"><input type="checkbox" id="optNums"${s.showNums ? ' checked' : ''}> 피해 숫자 표시</label>
      <label class="tg"><input type="checkbox" id="optDeal"${s.numDeal !== false ? ' checked' : ''}> 💥 주는 피해 표시</label>
      <label class="tg"><input type="checkbox" id="optTake"${s.numTake !== false ? ' checked' : ''}> 🩸 받는 피해 표시</label>
      <label class="tg">자동 섭취: 체력 <select id="optEat">${[0, 0.3, 0.4, 0.5, 0.6, 0.7].map((v) => `<option value="${v}"${s.autoEat === v ? ' selected' : ''}>${v ? pct(v) + ' 이하' : '끄기'}</option>`).join('')}</select></label>`);
    p.appendChild(c);
    $('#optNums', c).addEventListener('change', (e) => { s.showNums = e.target.checked; });
    $('#optDeal', c).addEventListener('change', (e) => { s.numDeal = e.target.checked; });
    $('#optTake', c).addEventListener('change', (e) => { s.numTake = e.target.checked; });
    const ex = h('div', 'card', `<b>화면 · 소리</b>
      <label class="tg"><input type="checkbox" data-k="sfx"${s.sfx ? ' checked' : ''}> 🔊 효과음 (레벨 업 · 희귀 획득)</label>
      <label class="tg"><input type="checkbox" data-k="cb"${s.cb ? ' checked' : ''}> 🎨 색약 모드 (체력 바 파랑 · 주황)</label>
      <button class="btn sm tut">📘 안내 다시 보기</button>`);
    ex.querySelectorAll('[data-k]').forEach((x) => x.addEventListener('change', () => { s[x.dataset.k] = x.checked; }));
    $('.tut', ex).addEventListener('click', () => { s.tut = false; this.hooks.save(); location.reload(); });
    p.appendChild(ex);
    $('#optEat', c).addEventListener('change', (e) => { s.autoEat = Number(e.target.value); });
    const fo = h('div', 'card', `<b>🍖 음식 관리</b>
      <label class="tg"><input type="checkbox" data-k="eatDanger"${s.eatDanger ? ' checked' : ''}> 다음 공격에 죽을 수 있으면 미리 먹기</label>
      <label class="tg"><input type="checkbox" data-k="eatWorst"${s.eatWorst ? ' checked' : ''}> 약한 음식부터 먹기</label>
      <label class="tg"><input type="checkbox" data-k="stopNoFood"${s.stopNoFood ? ' checked' : ''}> 음식이 떨어지고 체력 30% 아래면 전투 멈춤</label>
      <div class="mut">가방에서 음식마다 🔒 아껴 두기를 할 수 있습니다</div>`);
    fo.querySelectorAll('[data-k]').forEach((x) => x.addEventListener('change', () => { s[x.dataset.k] = x.checked; }));
    p.appendChild(fo);
    const sv = h('div', 'card', `<b>저장</b><div class="mut">15초마다 자동 저장 · 오프라인 최대 12시간 진행</div><div class="seg" style="margin-top:6px"><button id="bSave">💾 저장</button><button id="bExp">📤 내보내기</button><button id="bImp">📥 불러오기</button><button id="bReset">🗑️ 초기화</button></div>`);
    p.appendChild(sv);
    $('#bSave', sv).addEventListener('click', () => { this.hooks.save(); g.toast('저장했습니다'); });
    $('#bExp', sv).addEventListener('click', () => this.modal('📤 세이브 코드', `<textarea readonly>${exportSave(s)}</textarea><div class="mut">전체 선택해서 복사하세요</div>`, [{ label: '닫기' }]));
    $('#bImp', sv).addEventListener('click', () => this.modal('📥 세이브 코드 불러오기', '<textarea id="impTxt" placeholder="세이브 코드를 붙여 넣으세요"></textarea>', [
      { label: '취소' },
      { label: '불러오기', pri: true, fn: () => { try { this.hooks.restart(importSave($('#impTxt').value)); } catch (e) { g.toast('세이브 코드가 올바르지 않습니다', 'bad'); } } },
    ]));
    $('#bReset', sv).addEventListener('click', () => this.modal('🗑️ 초기화', '모든 진행 상황을 지우고 처음부터 시작합니다. 되돌릴 수 없습니다.', [
      { label: '취소' }, { label: '초기화', pri: true, fn: () => this.hooks.restart(null) },
    ]));
    p.appendChild(h('div', 'card mut', `별무리 개척기 v${VERSION} · 코드: ${window.BOOT?.src || '웹'}${window.BOOT?.ref ? ' ' + window.BOOT.ref : ''} · 처치 ${fmt(s.stats.kills)} · 사망 ${fmt(s.stats.deaths)} · 행동 ${fmt(s.stats.actions)}`));
  }

  modal(title, body, btns) {
    const box = $('#modalBox');
    box.innerHTML = `<h3 style="margin-top:0">${title}</h3><div>${body}</div><div class="mbtns"></div>`;
    for (const b of btns) {
      const e = h('button', 'btn' + (b.pri ? ' pri' : ''), b.label);
      e.addEventListener('click', () => { $('#modal').classList.add('hidden'); b.fn?.(); });
      $('.mbtns', box).appendChild(e);
    }
    $('#modal').classList.remove('hidden');
    this.noWrapSeg?.(box);
  }
}

import { MONSTER } from './data.js';
const MONSTER_OF = (id) => MONSTER[id];
