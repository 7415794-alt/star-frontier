// 별무리 개척기 — 시작 · 게임 루프 · 자동 저장
import { Game, newState, loadState, saveState, SAVE_KEY } from './game.js';
import { UI } from './ui.js';
import './town.js';
import { ITEMS, SKILL } from './data.js';

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
// 오프라인 진행
const away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
const off = game.offline(away);
game.rt.hp = Math.min(game.rt.hp, game.maxHp());
const ui = new UI(game, { save, restart });
window.game = game; window.ui = ui;
if (off) {
  const items = Object.entries(off.items).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} +${n.toLocaleString()}`).join(', ') || '없음';
  const xp = Object.entries(off.xp).map(([k, v]) => `${SKILL[k].name} +${Math.floor(v).toLocaleString()}`).join(', ') || '없음';
  ui.modal('🌙 오프라인 진행', `${Math.floor(off.sec / 60)}분 동안 진행했습니다.<br>처치 ${off.kills} · 💰 +${off.coins.toLocaleString()}<br>경험치: ${xp}<br>획득: ${items}`, [{ label: '확인', pri: true }]);
}

let last = performance.now();
let acc = 0;
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 30) { const r = game.offline(dt); dt = 0; if (r) game.toast(`🌙 ${Math.floor(r.sec / 60)}분 진행 · 처치 ${r.kills}`); }
  // 배속: 게임 시간 = 실제 시간 x 배속 (프레임당 최대 1초 x 배속)
  acc += Math.min(dt, 1) * game.speed();
  let n = 0;
  while (acc >= 0.05 && n++ < 1000) { game.update(0.05); acc -= 0.05; }
  ui.frame();
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
