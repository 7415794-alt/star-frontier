// 별무리 개척기 — 📖 도감 탭: 몬스터 도감 · 모험 일지 · 아이템 백과 · 경험치 계산기
import { ZONES, ITEMS, SKILLS, SKILL, ACTIONS, SHOP, STYLES, RARITY, HUNT_TIERS, HUNT_NAMES, HUNT_PER, huntTier, XP_TABLE, MAX_LVL, TIERS, PETS } from './data.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const time = (sec) => (sec >= 86400 ? `${Math.floor(sec / 86400)}일 ${Math.floor((sec % 86400) / 3600)}시간` : sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : sec >= 60 ? `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초` : `${Math.max(0, sec).toFixed(0)}초`);

// 아이템을 어디서 얻는지
let SOURCES = null;
function sources() {
  if (SOURCES) return SOURCES;
  SOURCES = {};
  const add = (id, txt) => { (SOURCES[id] ||= []).push(txt); };
  for (const z of ZONES) for (const m of z.mons) for (const l of m.loot) add(l.id, `${m.icon} ${m.name} ${l.fixed ? '항상' : pct(l.p, l.p < 0.01 ? 1 : 0)}`);
  for (const [sk, list] of Object.entries(ACTIONS)) for (const a of list) {
    for (const id of Object.keys(a.out || {})) add(id, `${SKILL[sk].icon} ${SKILL[sk].name} Lv ${a.lvl}`);
    if (a.gem) add(a.gem, `${SKILL[sk].icon} ${a.name} (1%)`);
    for (const [id, p] of Object.entries(a.rare || {})) add(id, `${SKILL[sk].icon} ${a.name} (${pct(p, 2)})`);
  }
  for (const sh of SHOP) add(sh.id, `🏪 상점 💰${fmt(sh.price)}`);
  return SOURCES;
}

export function tabCodex(ui, p) {
  const g = ui.g, s = g.s;
  const seg = h('div', 'seg');
  for (const [k, n] of [['mon', '👾 몬스터'], ['log', '📜 일지'], ['item', '🔎 백과'], ['calc', '🧮 계산기']]) {
    const b = h('button', ui.codex === k ? 'on' : '', n);
    b.addEventListener('click', () => { ui.codex = k; });
    seg.appendChild(b);
  }
  p.appendChild(seg);
  ({ mon: codexMon, log: codexLog, item: codexItem, calc: codexCalc })[ui.codex || 'mon'](ui, p, g, s);
}

function codexMon(ui, p, g, s) {
  p.appendChild(h('div', 'card mut', `🏹 사냥꾼 숙련: 같은 몬스터를 ${HUNT_TIERS.join(' / ')}마리 잡을 때마다 한 단계씩, 그 몬스터 상대로 드롭률 +${pct(HUNT_PER.drop)} · 피해 +${pct(HUNT_PER.dmg)} · 방어 +${pct(HUNT_PER.def, 1)} (최대 ${HUNT_TIERS.length}단계)`));
  const near = g.combatLevel() + 15;
  const zl = ZONES.filter((z) => z.lvl <= near || z.mons.some((m) => s.kills?.[m.id]));
  for (const z of zl) {
    p.appendChild(h('div', 'h', `${z.n} <span class="mut">Lv ${z.lvl}+</span>`));
    for (const m of z.mons) {
      const k = s.kills?.[m.id] || 0;
      const t = huntTier(k);
      const next = HUNT_TIERS[t];
      const seen = k > 0;
      const bar = next ? `<div class="lvbar"><div style="width:${pct(Math.min(1, k / next), 1)}"></div></div>` : '';
      const r = h('div', 'row' + (seen ? '' : ' lock'), `<div class="ic">${seen ? m.icon : '❔'}</div><div class="info">
        <div class="nm">${m.boss ? '👑 ' : ''}${seen ? m.name : '???'} <span class="mut">Lv ${m.lvl} · 처치 ${fmt(k)}</span></div>
        <div class="mut">${HUNT_NAMES[t]}${t ? ` (드롭 +${pct(t * HUNT_PER.drop)} · 피해 +${pct(t * HUNT_PER.dmg)} · 방어 +${pct(t * HUNT_PER.def, 1)})` : ''}${next ? ` · 다음 단계까지 ${fmt(next - k)}마리` : ' · 최고 단계'}</div>
        ${seen ? `<div class="mut">${STYLES[m.style].icon}${STYLES[m.style].name} · 체력 ${fmt(m.hp)} · 처음 처치 ${new Date(s.log.first[m.id] || Date.now()).toLocaleDateString('ko-KR')}</div>` : ''}${bar}</div>`);
      if (seen) { r.style.cursor = 'pointer'; r.addEventListener('click', () => ui.lootModal(m)); }
      p.appendChild(r);
    }
  }
  if (zl.length < ZONES.length) p.appendChild(h('div', 'mut', `더 높은 지역 ${ZONES.length - zl.length}곳은 전투 레벨이 오르면 보입니다`));
}

function codexLog(ui, p, g, s) {
  const L = s.log;
  const byR = {};
  for (const [id, n] of Object.entries(L.gear)) { const r = ITEMS[id]?.r || 1; byR[r] = (byR[r] || 0) + n; }
  const seenMon = ZONES.flatMap((z) => z.mons).filter((m) => s.kills?.[m.id]).length;
  const allMon = ZONES.flatMap((z) => z.mons).length;
  p.appendChild(h('div', 'card', `<b>📜 모험 일지</b><div class="stats" style="margin-top:6px">
    <div>플레이 시간 <b>${time(L.time || 0)}</b></div><div>처치 <b>${fmt(s.stats.kills)}</b></div>
    <div>보스 처치 <b>${fmt(L.bossKills || 0)}</b></div><div>사망 <b>${fmt(s.stats.deaths)}</b></div>
    <div>만난 몬스터 <b>${seenMon} / ${allMon}</b></div><div>펫 <b>${s.pets.length} / ${PETS.length}</b></div>
    <div>먹은 음식 <b>${fmt(L.food || 0)}</b></div><div>생활 행동 <b>${fmt(s.stats.actions)}</b></div></div>`));
  p.appendChild(h('div', 'card', `<b>📦 얻은 장비 (등급별)</b><div class="stats" style="margin-top:6px">${RARITY.map((R) => `<div style="color:${R.c}">${R.n} <b>${fmt(byR[R.r] || 0)}</b></div>`).join('')}</div>`));
  const top = Object.entries(L.got).filter(([id]) => ITEMS[id] && ITEMS[id].kind !== 'gear').sort((a, b) => b[1] - a[1]).slice(0, 30);
  p.appendChild(h('div', 'card', `<b>⛏️ 모은 자원 (상위 30)</b><div class="stats" style="margin-top:6px">${top.map(([id, n]) => `<div>${ITEMS[id].icon} ${ITEMS[id].name} <b>${fmt(n)}</b></div>`).join('') || '<div class="mut">아직 없음</div>'}</div>`));
  const best = Object.keys(L.gear).filter((id) => ITEMS[id]).sort((a, b) => ITEMS[b].r - ITEMS[a].r || ITEMS[b].t - ITEMS[a].t).slice(0, 12);
  p.appendChild(h('div', 'card', `<b>🏆 가장 좋은 장비</b>${best.map((id) => `<div style="color:${ITEMS[id].rc}">${ITEMS[id].icon} ${ITEMS[id].name} x${L.gear[id]}</div>`).join('') || '<div class="mut">아직 없음</div>'}`));
}

function codexItem(ui, p, g, s) {
  const box = h('div', 'card', `<input id="cxQ" placeholder="아이템 이름 검색 (예: 광석, 검, 결정)" value="${(ui.codexQ || '').replace(/"/g, '')}" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:#0f1330;color:inherit">`);
  p.appendChild(box);
  const inp = box.querySelector('#cxQ');
  inp.addEventListener('change', () => { ui.codexQ = inp.value.trim(); });
  const q = (ui.codexQ || '').toLowerCase();
  const src = sources();
  const ids = Object.keys(ITEMS).filter((id) => !(ITEMS[id].r > 1) && (!q || ITEMS[id].name.toLowerCase().includes(q))).slice(0, 60);
  p.appendChild(h('div', 'mut', q ? `"${ui.codexQ}" 검색 결과 ${ids.length}개${ids.length >= 60 ? ' (최대 60개)' : ''}` : '이름을 입력하고 엔터 · 처음 60개만 보여줍니다'));
  for (const id of ids) {
    const it = ITEMS[id];
    const from = src[id] || ['제작 · 기타'];
    p.appendChild(h('div', 'row', `<div class="ic">${it.icon}</div><div class="info"><div class="nm" style="color:${TIERS[it.t]?.c || 'inherit'}">${it.name} <span class="mut">보유 ${fmt(g.have(id))} · 💰${fmt(it.value || 0)}</span></div>
      <div class="mut">${from.slice(0, 6).join(' · ')}${from.length > 6 ? ` 외 ${from.length - 6}곳` : ''}</div></div>`));
  }
}

function codexCalc(ui, p, g, s) {
  const sk = ui.calcSkill || 'mine';
  const cur = g.lvl(sk);
  const target = Math.min(MAX_LVL, Math.max(cur + 1, ui.calcTarget || cur + 10));
  const c = h('div', 'card', `<b>🧮 경험치 계산기</b><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
    <select id="cSk">${SKILLS.map((k) => `<option value="${k.id}"${k.id === sk ? ' selected' : ''}>${k.icon} ${k.name} (Lv ${g.lvl(k.id)})</option>`).join('')}</select>
    → 목표 Lv <select id="cTg">${Array.from({ length: MAX_LVL - cur }, (_, i) => cur + 1 + i).map((L) => `<option${L === target ? ' selected' : ''}>${L}</option>`).join('')}</select></div>`);
  p.appendChild(c);
  c.querySelector('#cSk').addEventListener('change', (e) => { ui.calcSkill = e.target.value; ui.calcTarget = 0; });
  c.querySelector('#cTg').addEventListener('change', (e) => { ui.calcTarget = Number(e.target.value); });
  const need = Math.max(0, XP_TABLE[target] - (s.xp[sk] || 0));
  p.appendChild(h('div', 'card', `필요 경험치 <b>${fmt(need)}</b> XP <span class="mut">(지금 ${fmt(s.xp[sk] || 0)})</span>`));
  const acts = (ACTIONS[sk] || []).filter((a) => cur >= a.lvl);
  if (!acts.length) p.appendChild(h('div', 'mut', SKILL[sk].type === 'combat' ? '전투 스킬은 입힌 피해 1당 0.45 XP (근접은 공격 · 힘 둘 다, 방어는 70%)' : sk === 'div' ? '신성은 뼈를 묻어 올립니다' : '할 수 있는 행동이 없습니다'));
  for (const a of acts) {
    const xp = g.actionXp(sk, a), t = g.actionTime(sk, a), n = Math.ceil(need / xp);
    const mats = a.in ? ' · 재료 ' + Object.entries(a.in).map(([id, k]) => `${ITEMS[id].icon}${fmt(k * n)}`).join(' ') : '';
    p.appendChild(h('div', 'row', `<div class="ic">${a.icon}</div><div class="info"><div class="nm">${a.name} <span class="mut">${xp.toFixed(0)} XP · ${t.toFixed(1)}초</span></div>
      <div class="mut">${fmt(n)}회 · 약 ${time(n * t)} (배속 x1 기준)${mats}</div></div>`));
  }
  // 목표 설정
  const goal = s.goals?.[sk];
  const gb = h('div', 'card', `<b>🎯 스킬 목표</b> <span class="mut">${goal ? `지금 목표: Lv ${goal}` : '없음'}</span><div class="seg" style="margin-top:6px"><button class="set">Lv ${target}을 목표로</button>${goal ? '<button class="clr">목표 지우기</button>' : ''}</div>`);
  gb.querySelector('.set').addEventListener('click', () => { s.goals = { ...s.goals, [sk]: target }; g.toast(`🎯 ${SKILL[sk].name} Lv ${target} 목표 설정`); });
  gb.querySelector('.clr')?.addEventListener('click', () => { const x = { ...s.goals }; delete x[sk]; s.goals = x; });
  p.appendChild(gb);
}
