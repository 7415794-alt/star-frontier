// 별무리 개척기 — 화면
import {
  VERSION, SKILLS, SKILL, ITEMS, GEAR, SLOTS, SLOT_IDS, STYLES, STYLE_IDS, ZONES, ACTIONS, PRAYERS, PETS, PET, TIERS,
  XP_TABLE, MAX_LVL, SPECIAL_NAMES, SLOT_SPECIAL, SHOP, monMaxHit,
} from './data.js';
import { exportSave, importSave } from './game.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const spText = (sp) => Object.entries(sp || {}).map(([k, v]) => `${SPECIAL_NAMES[k]} +${pct(v, v < 0.1 ? 1 : 0)}`).join(', ');
const time = (sec) => sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : sec >= 60 ? `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초` : `${sec.toFixed(1)}초`;

export class UI {
  constructor(game, hooks) {
    this.g = game;
    this.hooks = hooks;
    this.tab = 'combat';
    this.zone = 0;
    this.skillSel = 'wood';
    this.sig = '';
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(true); }));
    $('#act').addEventListener('click', (e) => { if (e.target.id === 'stopBtn') this.g.stop(); });
    this.render(true);
  }

  // 바뀐 게 있을 때만 패널을 다시 그림 (스크롤 유지)
  signature() {
    const s = this.g.s;
    return JSON.stringify([this.tab, this.zone, this.skillSel, s.bank, s.equip, s.activity, s.prayer, s.pet, s.pets, s.meleeMode, s.autoEat, s.showNums, SKILLS.map((k) => this.g.lvl(k.id)), this.tab === 'bank' ? s.coins : 0]);
  }
  render(force = false) {
    const sig = this.signature();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const p = $('#panel');
    const top = p.scrollTop;
    p.innerHTML = '';
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    ({ combat: this.tabCombat, skills: this.tabSkills, gear: this.tabGear, bank: this.tabBank, div: this.tabDiv, pets: this.tabPets, more: this.tabMore })[this.tab].call(this, p);
    if (!force) p.scrollTop = top;
  }

  // 매 프레임: 상단 행동 패널 · 재화 · 알림
  frame() {
    const g = this.g, s = g.s, rt = g.rt;
    $('#coins').textContent = '🪙 ' + fmt(s.coins);
    $('#cbLvl').textContent = '⚔ 전투 Lv ' + g.combatLevel();
    const act = $('#act');
    const A = s.activity;
    const key = A ? A.type + (A.mon || A.act || A.bone) : 'idle';
    if (act._k !== key) { act._k = key; act.innerHTML = this.actHtml(); act._fl = new Set(); }
    if (A?.type === 'combat') {
      const m = rt.mon;
      const mx = g.maxHp();
      $('.hpP > div', act).style.width = pct(Math.max(0, rt.hp) / mx, 1);
      $('.hpP span', act).textContent = `${fmt(Math.max(0, rt.hp))} / ${fmt(mx)}`;
      $('.tmP > div', act).style.width = pct(Math.min(1, rt.atkT / g.atkInterval()), 1);
      const mm = g.s.activity && MONSTER_OF(A.mon);
      $('.hpM > div', act).style.width = m ? pct(Math.max(0, rt.monHp) / m.hp, 1) : '0%';
      $('.hpM span', act).textContent = m ? `${fmt(rt.monHp)} / ${fmt(m.hp)}` : rt.dead > 0 ? `부활까지 ${rt.dead.toFixed(1)}초` : '다음 몬스터…';
      $('.tmM > div', act).style.width = m ? pct(Math.min(1, rt.monT / m.interval), 1) : '0%';
      $('.monIc', act).style.opacity = m ? 1 : 0.3;
      $('.heroIc', act).style.opacity = rt.dead > 0 ? 0.3 : 1;
      const food = Object.keys(s.bank).filter((id) => ITEMS[id]?.kind === 'food').reduce((a, id) => a + s.bank[id], 0);
      $('.info', act).textContent = `처치 ${fmt(s.kills?.[A.mon] || 0)} · 음식 ${fmt(food)}개 · 명중 ${pct(g.vs(mm).hit)} · 최대 ${g.maxHit()}`;
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
      $('.info', act).textContent = `${SKILL[sk].name} Lv ${g.lvl(sk)} · ${this.xpText(sk)}` + (A.type === 'bury' ? ` · 남은 뼈 ${fmt(g.have(A.bone))}` : '');
    }
    // 알림
    while (rt.log.length) {
      const l = rt.log.shift();
      const t = h('div', 'toast ' + l.kind, l.text);
      $('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 2600);
      while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
    }
    this.render();
  }
  actHtml() {
    const g = this.g, A = g.s.activity;
    if (!A) return '<div class="idle">쉬는 중 · 전투 또는 스킬을 골라 시작하세요</div>';
    if (A.type === 'combat') {
      const m = MONSTER_OF(A.mon);
      return `<div class="duel">
        <div class="fighter"><div class="ic heroIc">🧝</div><div class="nm">나 (${STYLES[g.style()].icon} ${STYLES[g.style()].name})</div><div class="bar hpP"><div></div><span></span></div><div class="bar tm tmP"><div></div></div></div>
        <div class="vs">VS</div>
        <div class="fighter"><div class="ic monIc">${m.icon}</div><div class="nm">${m.boss ? '👑 ' : ''}${m.name} Lv ${m.lvl} · ${STYLES[m.style].icon}</div><div class="bar mon hpM"><div></div><span></span></div><div class="bar tm tmM"><div></div></div></div>
      </div><div class="floats"></div><div class="actinfo"><span class="info"></span><button class="btn sm" id="stopBtn">■ 멈춤</button></div>`;
    }
    const a = A.type === 'bury' ? { icon: ITEMS[A.bone].icon, name: ITEMS[A.bone].name + ' 묻기' } : ACTIONS[A.skill].find((x) => x.id === A.act);
    return `<div class="skillact"><div class="ic">${a.icon}</div><div class="grow"><b>${a.name}</b><div class="bar"><div></div></div><div class="actinfo"><span class="info"></span></div></div><button class="btn sm" id="stopBtn">■ 멈춤</button></div>`;
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
    const b = g.bonuses();
    const card = h('div', 'card', `<b>${STYLES[st].icon} ${STYLES[st].name} 전투</b> <span class="mut">(무기로 결정)</span>
      <div class="stats" style="margin-top:6px">
        <div>명중 굴림 <b>${fmt(g.atkRoll())}</b></div><div>최대 피해 <b>${g.maxHit()}</b></div>
        <div>공격 주기 <b>${g.atkInterval().toFixed(2)}초</b></div><div>최대 체력 <b>${fmt(g.maxHp())}</b></div>
        <div>근접 방어 <b>${fmt(b.def.melee)}</b></div><div>원거리 방어 <b>${fmt(b.def.ranged)}</b></div>
        <div>마법 방어 <b>${fmt(b.def.magic)}</b></div><div>자동 섭취 <b>체력 ${pct(s.autoEat)} 이하</b></div>
      </div>
      ${st === 'melee' ? `<div class="mut" style="margin-top:6px">근접 경험치</div><div class="seg melee">${[['atk', '🗡️ 공격'], ['str', '💪 힘'], ['def', '🛡️ 방어'], ['shared', '⚖️ 나눠서']].map(([k, n]) => `<button data-k="${k}" class="${s.meleeMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : `<div class="mut" style="margin-top:6px">${st === 'ranged' ? '원거리' : '마법'} 경험치 + 체력 경험치(1/3)</div>`}`);
    p.appendChild(card);
    card.querySelectorAll('.melee button').forEach((x) => x.addEventListener('click', () => { s.meleeMode = x.dataset.k; }));

    const seg = h('div', 'seg');
    ZONES.forEach((z, i) => {
      const bt = h('button', i === this.zone ? 'on' : '', `${z.n}<br><small>Lv ${z.lvl}+</small>`);
      bt.addEventListener('click', () => { this.zone = i; });
      seg.appendChild(bt);
    });
    p.appendChild(seg);
    const zn = ZONES[this.zone];
    for (const m of zn.mons) {
      const v = g.vs(m);
      const on = s.activity?.type === 'combat' && s.activity.mon === m.id;
      const danger = v.mdps * v.ttk > g.maxHp() * 0.5;
      const r = h('div', 'row' + (on ? ' on' : ''), `
        <div class="ic">${m.icon}</div>
        <div class="info"><div class="nm">${m.boss ? '👑 ' : ''}${m.name} <span class="mut">Lv ${m.lvl} · 체력 ${fmt(m.hp)}</span></div>
        <div class="mut">공격 ${STYLES[m.style].icon}${STYLES[m.style].name} (최대 ${monMaxHit(m)}, ${m.interval}초) · 약점 ${STYLES[m.weak].icon}${STYLES[m.weak].name}</div>
        <div class="mut">내 명중 ${pct(v.hit)} · 처치 약 ${time(v.ttk)} · 적 명중 ${pct(v.mHit)} · 받는 피해 ${v.mdps.toFixed(1)}/초${danger ? ' <span style="color:#f87171">⚠ 위험</span>' : ''} · 처치 ${fmt(s.kills?.[m.id] || 0)}</div></div>
        <button class="btn ${on ? '' : 'pri'}">${on ? '■' : '⚔ 싸우기'}</button>`);
      $('button', r).addEventListener('click', () => { if (on) g.stop(); else g.startCombat(m.id); });
      p.appendChild(r);
    }
    p.appendChild(h('div', 'card mut', `전리품: ${ITEMS['bone' + zn.t].icon} ${ITEMS['bone' + zn.t].name} · 🪙 동전 · ${ITEMS['hide' + zn.t].name} / ${ITEMS['cloth' + zn.t].name} · 날생선 · ${TIERS[zn.t].n} 장비(일반 2.5% · 보스 30%) · 보스는 펫 ${PETS.find((x) => x.src === 'boss:' + zn.t).icon} 확률`));
    p.appendChild(h('div', 'card mut', '공식: 명중 = 내 명중 굴림 ÷ (내 굴림 + 적 방어 굴림), 굴림 = (레벨 + 10) × (장비 보너스 + 50) · 최대 피해 = 1 + (힘/원거리/마법 레벨 + 8) × (공격력 보너스 + 40) ÷ 200 · 맞으면 1 ~ 최대 피해 · 몬스터는 자기 공격 주기마다 한 번 공격 · 약점 방식으로 때리면 적 방어가 크게 낮음'));
  }

  // ---------- 스킬 ----------
  tabSkills(p) {
    const g = this.g, s = g.s;
    const list = h('div', 'grid2');
    for (const k of SKILLS) {
      const c = h('div', 'slot', `<div class="n">${k.icon} ${k.name} <span class="mut">Lv ${g.lvl(k.id)}</span></div><div class="t">${k.desc}</div>${this.lvBar(k.id)}`);
      if (ACTIONS[k.id]) { c.style.cursor = 'pointer'; c.addEventListener('click', () => { this.skillSel = k.id; }); }
      if (k.id === this.skillSel) c.style.borderColor = 'var(--acc)';
      list.appendChild(c);
    }
    p.appendChild(list);
    const k = SKILL[this.skillSel];
    p.appendChild(h('div', 'h', `${k.icon} ${k.name} Lv ${g.lvl(k.id)} <span class="mut">${this.xpText(k.id)}</span>`));
    let group = '';
    for (const a of ACTIONS[k.id]) {
      if (a.group && a.group !== group) { group = a.group; p.appendChild(h('div', 'mut', group)); }
      const lock = g.lvl(k.id) < a.lvl;
      const on = s.activity?.type === 'skill' && s.activity.act === a.id && s.activity.skill === k.id;
      const io = [a.in ? '필요 ' + Object.entries(a.in).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} ${n} (보유 ${fmt(g.have(id))})`).join(', ') : '', '획득 ' + Object.entries(a.out).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} ${n}`).join(', ')].filter(Boolean).join(' · ');
      const burn = g.burnChance(a);
      const it = ITEMS[Object.keys(a.out)[0]];
      const gearInfo = it.kind === 'gear' ? `<div class="mut">${this.gearLine(it)}</div>` : '';
      const r = h('div', 'row' + (lock ? ' lock' : '') + (on ? ' on' : ''), `<div class="ic">${a.icon}</div>
        <div class="info"><div class="nm">${a.name} <span class="mut">Lv ${a.lvl}</span></div><div class="mut">${io}</div>${gearInfo}
        <div class="mut">XP ${g.actionXp(k.id, a).toFixed(0)} · ${g.actionTime(k.id, a).toFixed(1)}초${burn ? ` · 태울 확률 ${pct(burn)}` : ''}</div></div>
        <button class="btn ${on ? '' : 'pri'}"${lock ? ' disabled' : ''}>${lock ? '🔒' : on ? '■' : '▶'}</button>`);
      $('button', r).addEventListener('click', () => { if (on) g.stop(); else g.startSkill(k.id, a.id); });
      p.appendChild(r);
    }
    const pet = PETS.find((x) => x.src === k.id);
    if (pet) p.appendChild(h('div', 'card mut', `행동마다 펫 ${pet.icon} ${pet.name} 확률 1/${Math.round(1 / pet.p)} · 레벨이 요구 레벨보다 높을수록 빨라짐 (1레벨당 +1%, 최대 2배)`));
  }

  gearLine(it) {
    const st = it.stats;
    const part = (k, n) => STYLE_IDS.filter((x) => st[k][x]).map((x) => `${STYLES[x].icon}${n} ${st[k][x] > 0 ? '+' : ''}${st[k][x]}`).join(' ');
    return [part('acc', '명중'), part('pow', '공격력'), part('def', '방어'), `<span class="sp">★ ${spText(st.sp)}</span>`, it.speed ? `주기 ${it.speed}초` : '', it.twoHand ? '양손' : '', `요구 ${SKILL[it.req[0]].name} ${it.req[1]}`].filter(Boolean).join(' · ');
  }

  // ---------- 장비 ----------
  tabGear(p) {
    const g = this.g, s = g.s;
    const grid = h('div', 'grid2');
    for (const sl of SLOT_IDS) {
      const it = ITEMS[s.equip[sl]];
      const [spk] = SLOT_SPECIAL[sl];
      const c = h('div', 'slot', `<div class="t">${SLOTS[sl].icon} ${SLOTS[sl].name} · <span class="sp">★ ${SPECIAL_NAMES[spk]}</span></div><div class="n" style="color:${it ? TIERS[it.t].c : 'var(--mut)'}">${it ? it.icon + ' ' + it.name : '비어 있음'}</div>${it ? `<div class="t sp">${spText(it.stats.sp)}</div>` : ''}`);
      if (it) { c.style.cursor = 'pointer'; c.title = '눌러서 해제'; c.addEventListener('click', () => g.unequip(sl)); }
      grid.appendChild(c);
    }
    p.appendChild(h('div', 'mut', '장착한 칸을 누르면 해제 · 부위마다 ★ 특수 옵션이 정해져 있고 단계가 높을수록 커집니다'));
    p.appendChild(grid);
    const b = g.bonuses();
    const tbl = `<table class="tbl"><tr><th></th>${STYLE_IDS.map((x) => `<th>${STYLES[x].icon}${STYLES[x].name}</th>`).join('')}</tr>
      ${[['acc', '명중'], ['pow', '공격력'], ['def', '방어']].map(([k, n]) => `<tr><td>${n}</td>${STYLE_IDS.map((x) => `<td>${fmt(b[k][x])}</td>`).join('')}</tr>`).join('')}</table>`;
    p.appendChild(h('div', 'card', `<b>장비 보너스</b>${tbl}<div style="margin-top:6px"><b>특수 옵션 합계</b> <span class="mut">(장비 · 기도 · 펫)</span><div class="sp">${spText(b.sp) || '없음'}</div></div>`));
    p.appendChild(h('div', 'h', '가방의 장비'));
    const gear = Object.keys(s.bank).filter((id) => ITEMS[id].kind === 'gear').sort((a, c) => ITEMS[c].t - ITEMS[a].t || ITEMS[a].slot.localeCompare(ITEMS[c].slot));
    if (!gear.length) p.appendChild(h('div', 'mut', '장비가 없습니다. 몬스터 드롭 · 대장 · 공예로 얻습니다.'));
    for (const id of gear) {
      const it = ITEMS[id];
      const ok = g.canEquip(id);
      const r = h('div', 'row' + (ok ? '' : ' lock'), `<div class="ic">${it.icon}</div><div class="info"><div class="nm" style="color:${TIERS[it.t].c}">${it.name} <span class="mut">x${g.have(id)} · ${SLOTS[it.slot].name}</span></div><div class="mut">${this.gearLine(it)}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm pri eq"${ok ? '' : ' disabled'}>장착</button><button class="btn sm sl">판매 ${fmt(it.value)}</button></div>`);
      $('.eq', r).addEventListener('click', () => g.equip(id));
      $('.sl', r).addEventListener('click', () => g.sell(id, 1));
      p.appendChild(r);
    }
  }

  // ---------- 가방 · 상점 ----------
  tabBank(p) {
    const g = this.g, s = g.s;
    const ids = Object.keys(s.bank).filter((id) => ITEMS[id].kind !== 'gear').sort((a, b) => (ITEMS[a].kind + ITEMS[a].t).localeCompare(ITEMS[b].kind + ITEMS[b].t));
    p.appendChild(h('div', 'h', `🎒 가방 (${ids.length}종) · 🪙 ${fmt(s.coins)}`));
    for (const id of ids) {
      const it = ITEMS[id];
      const extra = it.kind === 'food' ? ` · 회복 ${it.heal}` : it.kind === 'bone' ? ` · 신성 XP ${it.xp}` : '';
      const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name} <span class="mut">x${fmt(g.have(id))}</span></div><div class="mut">개당 🪙${fmt(it.value)}${extra}</div></div>
        <button class="btn sm s1">1개 판매</button><button class="btn sm sa">모두</button>`);
      $('.s1', r).addEventListener('click', () => g.sell(id, 1));
      $('.sa', r).addEventListener('click', () => g.sell(id, g.have(id)));
      p.appendChild(r);
    }
    p.appendChild(h('div', 'h', '🏪 상점'));
    for (const sh of SHOP) {
      const it = ITEMS[sh.id];
      const r = h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm">${it.name}</div><div class="mut">${it.kind === 'gear' ? this.gearLine(it) : `회복 ${it.heal}`}</div></div><button class="btn sm pri"${s.coins >= sh.price ? '' : ' disabled'}>🪙 ${fmt(sh.price)}</button>`);
      $('button', r).addEventListener('click', () => g.buy(sh.id));
      p.appendChild(r);
    }
  }

  // ---------- 신성 ----------
  tabDiv(p) {
    const g = this.g, s = g.s;
    p.appendChild(h('div', 'card', `<b>✨ 신성 Lv ${g.lvl('div')}</b> <span class="mut">${this.xpText('div')}</span>${this.lvBar('div')}<div class="mut">몬스터 뼈를 묻어 수련 · 기도는 1개만 켤 수 있고 켜 두면 계속 유지됩니다</div>`));
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
    for (const pr of PRAYERS) {
      const lock = g.lvl('div') < pr.lvl;
      const on = s.prayer === pr.id;
      const r = h('div', 'row' + (lock ? ' lock' : '') + (on ? ' on' : ''), `<div class="ic">${pr.icon}</div><div class="info"><div class="nm">${pr.name} <span class="mut">Lv ${pr.lvl}</span></div><div class="mut sp">★ ${spText(pr.fx)}</div></div><button class="btn"${lock ? ' disabled' : ''}>${lock ? '🔒' : on ? '끄기' : '켜기'}</button>`);
      $('button', r).addEventListener('click', () => { s.prayer = on ? null : pr.id; g.dirty(); });
      p.appendChild(r);
    }
  }

  // ---------- 펫 ----------
  tabPets(p) {
    const g = this.g, s = g.s;
    p.appendChild(h('div', 'card mut', `펫 ${s.pets.length} / ${PETS.length} · 1마리만 데리고 다니며, 펫마다 ★ 특수 옵션이 다릅니다`));
    for (const pet of PETS) {
      const own = s.pets.includes(pet.id);
      const on = s.pet === pet.id;
      const src = pet.src.startsWith('boss:') ? `${ZONES[+pet.src.slice(5)].mons[3].name} 처치` : `${SKILL[pet.src].name} 행동`;
      const r = h('div', 'row' + (own ? '' : ' lock') + (on ? ' on' : ''), `<div class="ic">${own ? pet.icon : '❔'}</div><div class="info"><div class="nm">${own ? pet.name : '???'}</div><div class="mut">${src} · 확률 1/${Math.round(1 / pet.p)}</div><div class="mut sp">★ ${spText(pet.fx)}</div></div><button class="btn"${own ? '' : ' disabled'}>${on ? '보내기' : '데리고 다니기'}</button>`);
      $('button', r).addEventListener('click', () => { s.pet = on ? null : pet.id; g.dirty(); });
      p.appendChild(r);
    }
  }

  // ---------- 설정 ----------
  tabMore(p) {
    const g = this.g, s = g.s;
    const c = h('div', 'card', `<b>설정</b>
      <label class="tg"><input type="checkbox" id="optNums"${s.showNums ? ' checked' : ''}> 피해 숫자 표시</label>
      <label class="tg">자동 섭취: 체력 <select id="optEat">${[0, 0.3, 0.4, 0.5, 0.6, 0.7].map((v) => `<option value="${v}"${s.autoEat === v ? ' selected' : ''}>${v ? pct(v) + ' 이하' : '끄기'}</option>`).join('')}</select></label>`);
    p.appendChild(c);
    $('#optNums', c).addEventListener('change', (e) => { s.showNums = e.target.checked; });
    $('#optEat', c).addEventListener('change', (e) => { s.autoEat = Number(e.target.value); });
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
    p.appendChild(h('div', 'card mut', `별무리 개척기 v${VERSION} · 처치 ${fmt(s.stats.kills)} · 사망 ${fmt(s.stats.deaths)} · 행동 ${fmt(s.stats.actions)}`));
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
  }
}

import { MONSTER } from './data.js';
const MONSTER_OF = (id) => MONSTER[id];
