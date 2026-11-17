// 별무리 개척기 — 시작 · 게임 루프 · 자동 저장
import { Game, newState, loadState, saveState, SAVE_KEY } from './game.js';
import { UI } from './ui.js';
import './town.js';
import './frontier.js';
import { ITEMS, SKILL, OFFLINE_CAP } from './data.js';

const state = loadState() || newState();
const game = new Game(state);
game.townInit();
let locked = false;
const save = () => { if (!locked) saveState(game.s); };
const restart = (st) => {
  locked = true;
  if (st) saveState(st); else localStorage.removeItem(SAVE_KEY);
  setTimeout(() => location.replace(location.href.split('#')[0]), 30);
};
// 화면부터 바로 띄우고, 꺼져 있던 동안의 진행(오프라인)은 그 뒤에 조금씩 나눠 계산
const away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
game.rt.hp = Math.min(game.rt.hp, game.maxHp());
const ui = new UI(game, { save, restart });
window.game = game; window.ui = ui;
let offRun = false;
function runOffline(sec, done) {
  sec = Math.min(sec, OFFLINE_CAP);
  if (offRun || sec < 30 || (!game.s.activity && !game.s.hunt)) return;
  offRun = true;
  const s = game.s, xp0 = { ...s.xp }, bank0 = { ...s.bank }, c0 = s.coins, k0 = s.stats.kills;
  const step = sec > 600 ? 5 : 1; // 오래 꺼져 있었으면 5초 단위로 계산 (결과는 거의 같고 훨씬 빠름)
  const bar = document.createElement('div');
  bar.className = 'offbar';
  document.body.appendChild(bar);
  let t = 0;
  const chunk = () => {
    const end = performance.now() + 14;
    game.quiet = true;
    try { while (t < sec && performance.now() < end) { const d = Math.min(step, sec - t); game.update(d); t += d; } } finally { game.quiet = false; }
    bar.textContent = `🌙 꺼져 있던 ${Math.floor(sec / 60)}분 진행 계산 중… ${Math.floor((t / sec) * 100)}%`;
    if (t < sec) { setTimeout(chunk, 0); return; }
    bar.remove();
    offRun = false;
    const xp = Object.fromEntries(Object.keys(s.xp).map((k) => [k, s.xp[k] - (xp0[k] || 0)]).filter(([, v]) => v > 0));
    const items = Object.fromEntries(Object.keys(s.bank).map((k) => [k, s.bank[k] - (bank0[k] || 0)]).filter(([, v]) => v > 0));
    done({ sec, xp, items, coins: s.coins - c0, kills: s.stats.kills - k0 });
  };
  setTimeout(chunk, 50);
}
runOffline(away, (off) => {
  game.rt.hp = Math.min(game.rt.hp, game.maxHp());
  if (state.pop?.all === false || state.pop?.modal === false) { game.toast(`🌙 ${Math.floor(off.sec / 60)}분 진행 · 처치 ${off.kills}`); return; }
  const items = Object.entries(off.items).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} +${n.toLocaleString()}`).join(', ') || '없음';
  const xp = Object.entries(off.xp).map(([k, v]) => `${SKILL[k]?.name || k} +${Math.floor(v).toLocaleString()}`).join(', ') || '없음';
  ui.modal('🌙 오프라인 진행', `${Math.floor(off.sec / 60)}분 동안 진행했습니다.<br>처치 ${off.kills} · 💰 +${off.coins.toLocaleString()}<br>경험치: ${xp}<br>획득: ${items}`, [{ label: '확인', pri: true }]);
});

let last = performance.now();
let acc = 0;
let lastUi = 0;
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 30) { runOffline(dt, (r) => game.toast(`🌙 ${Math.floor(r.sec / 60)}분 진행 · 처치 ${r.kills}`)); dt = 0; }
  if (offRun) { ui.frame(); requestAnimationFrame(loop); return; } // 오프라인 계산 중에는 게임 시간을 멈춤
  // 배속: 게임 시간 = 실제 시간 x 배속 (프레임당 최대 1초 x 배속)
  acc += Math.min(dt, 1) * game.speed();
  // 렉 줄이기: 한 프레임에 계산은 최대 30번 · 10ms까지 (밀리면 한 번에 더 큰 단위로 계산)
  const base = game.speed() >= 64 ? 0.1 : 0.05;
  const step = Math.min(0.5, Math.max(base, acc / 30));
  const t0 = performance.now();
  let n = 0;
  while (acc >= step && n++ < 30 && performance.now() - t0 < 10) { game.update(step); acc -= step; }
  if (acc > step * 60) acc = step * 60; // 폰이 따라가지 못하면 밀린 시간은 버림 (끊김 방지)
  // 화면 숫자 · 막대는 1초에 10번만 갱신 (떠오르는 숫자 움직임은 CSS가 처리)
  if (now - lastUi >= 100) { lastUi = now; ui.frame(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(save, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

// 게임 중 화면 꺼짐 방지
let wake = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !document.hidden && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; }
}
keepAwake();
document.addEventListener('visibilitychange', keepAwake);
window.addEventListener('pointerdown', keepAwake, { passive: true });

// PWA 서비스 워커 (안드로이드 앱에서는 사용하지 않음)
if ('serviceWorker' in navigator && !window.Capacitor && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
