// Saúde em Campo: guarda os arquivos do app no aparelho para abrir sem internet.
// Só cuida dos arquivos do próprio site; os dados vão direto para o Supabase.
const VERSAO = 'saude-em-campo-2026-11-10a';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './vendor/supabase-2.89.0.js',
  './marca/acao-missionaria-norte.png', './marca/mub.png', './marca/icone-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Página: tenta a versão nova na rede; sem internet, usa a guardada.
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(VERSAO).then(x => x.put('./index.html', c)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSAO).then(x => x.put(req, c)); } return res; })));
});
