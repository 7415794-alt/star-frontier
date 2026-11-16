// 별무리 개척기 — 시작 로더
// 안드로이드 앱에서는 GitHub에 올라간 최신 코드를 받아 실행 → 코드를 고치고 push만 하면 앱을 다시 설치하지 않아도 업데이트됨.
// 인터넷이 없거나 실패하면 앱에 들어 있는 코드로 실행. 세이브는 앱 안(localStorage)에 그대로 남음.
const REPO = '7415794-alt/star-frontier';
const CDN = (ref) => `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/www/`;

const isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const force = new URLSearchParams(location.search).has('remote'); // 브라우저에서 시험용

async function fetchT(url, ms, type = 'text') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    return type === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

async function latestRef() {
  try {
    const j = await fetchT(`https://api.github.com/repos/${REPO}/commits/main`, 4000, 'json');
    if (j && /^[0-9a-f]{40}$/.test(j.sha)) return j.sha;
  } catch (e) { /* 제한 · 오프라인 → 브랜치 이름으로 */ }
  return 'main';
}

function useCss(href) {
  return new Promise((res) => {
    const old = document.querySelector('link[rel=stylesheet]');
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = () => { old?.remove(); res(true); };
    l.onerror = () => { l.remove(); res(false); };
    document.head.appendChild(l);
    setTimeout(() => res(false), 5000);
  });
}

async function remote() {
  const ref = await latestRef();
  const base = CDN(ref);
  const html = await fetchT(base + 'index.html', 6000);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach((s) => s.remove());
  // 최신 코드를 먼저 받아 둔 뒤 화면을 바꿈 (중간에 실패하면 내장 코드로)
  const mod = base + 'js/main.js';
  await fetchT(mod, 6000);
  await useCss(base + 'css/style.css');
  document.body.innerHTML = doc.body.innerHTML;
  window.BOOT = { src: '온라인 최신', ref: ref.slice(0, 7) };
  await import(mod);
}

(async () => {
  if (isApp || force) {
    try { await remote(); return; } catch (e) { console.warn('최신 코드 불러오기 실패, 내장 코드로 실행', e); }
  }
  window.BOOT = { src: isApp ? '앱 내장 (오프라인)' : '웹', ref: '' };
  await import('./main.js');
})();
