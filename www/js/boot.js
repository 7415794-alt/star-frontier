// 별무리 개척기 — 시작 로더 (빠른 시작)
// 안드로이드 앱: 지난번에 받아 둔 버전(기기에 캐시됨)으로 '바로' 시작하고,
// 게임이 뜬 뒤 뒤에서 GitHub의 최신 코드를 확인 · 미리 받아 둠 → 다음에 켤 때 새 버전으로 시작.
// 처음 실행이거나 받아 둔 버전이 없으면 앱에 들어 있는 코드로 바로 시작. 세이브는 앱 안(localStorage)에 그대로.
const REPO = '7415794-alt/star-frontier';
const CDN = (ref) => `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/www/`;
const KEY = 'sf-boot-ref';
const FILES = ['index.html', 'css/style.css', 'js/main.js', 'js/game.js', 'js/ui.js', 'js/town.js', 'js/frontier.js', 'js/data.js', 'js/codex.js'];

const isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const force = new URLSearchParams(location.search).has('remote'); // 브라우저에서 시험용

async function fetchT(url, ms, type = 'text', cache = 'no-store') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache });
    if (!r.ok) throw new Error(r.status);
    return type === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}
const getRef = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const setRef = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* 무시 */ } };

function useCss(href) {
  return new Promise((res) => {
    const old = document.querySelector('link[rel=stylesheet]');
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = () => { old?.remove(); res(true); };
    l.onerror = () => { l.remove(); res(false); };
    document.head.appendChild(l);
    setTimeout(() => res(false), 3000);
  });
}

// 받아 둔 버전(커밋 고정 주소 → 기기 캐시)으로 시작
async function startRef(ref) {
  const base = CDN(ref);
  const html = await fetchT(base + 'index.html', 4000, 'text', 'force-cache');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach((s) => s.remove());
  await useCss(base + 'css/style.css');
  document.body.innerHTML = doc.body.innerHTML;
  window.BOOT = { src: '받아 둔 최신', ref: ref.slice(0, 7) };
  await import(base + 'js/main.js');
}

// 게임이 뜬 뒤: 최신 버전 확인 → 파일을 미리 받아 둠 → 다음 시작부터 사용
async function checkUpdate(cur) {
  try {
    const j = await fetchT(`https://api.github.com/repos/${REPO}/commits/main`, 8000, 'json');
    const ref = j && /^[0-9a-f]{40}$/.test(j.sha) ? j.sha : null;
    if (!ref || ref === cur) return;
    const base = CDN(ref);
    for (const f of FILES) await fetchT(base + f, 15000, 'text', 'force-cache');
    setRef(ref);
    window.game?.toast?.('🔄 새 버전을 받아 두었습니다 · 앱을 다시 켜면 적용됩니다', 'info');
  } catch (e) { /* 오프라인 · 제한 → 다음에 다시 */ }
}

(async () => {
  if (isApp || force) {
    const ref = getRef();
    if (ref) {
      try { await startRef(ref); setTimeout(() => checkUpdate(ref), 4000); return; } catch (e) { console.warn('받아 둔 버전 실행 실패, 내장 코드로', e); }
    }
    setTimeout(() => checkUpdate(null), 4000);
  }
  window.BOOT = { src: isApp ? '앱 내장' : '웹', ref: '' };
  await import('./main.js');
})();
