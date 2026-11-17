// Mode hors ligne (repris de Port de la Lune et Canelé Quest) : la carte, ses données, la 3D, les polices,
// les traductions et les miniatures des photos sont gardées dès la première visite ; les grandes photos
// au fur et à mesure qu'on les ouvre. Pages, scripts et données : réseau d'abord, cache sinon.
// Images et polices : cache d'abord. Changer VERSION pour forcer le nettoyage, et ajouter tout
// nouveau fichier à COEUR.
const VERSION = 'bm-2';
const COEUR = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'css/polices.css',
  'js/carte.js', 'js/fond-carte.js', 'js/compact.js', 'js/monuments3d.js', 'js/fiche.js', 'js/horaires.js', 'js/i18n.js',
  'js/lang/en.js', 'js/lang/es.js', 'js/lang/it.js', 'js/lang/de.js',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'vendor/three.module.min.js',
  'data/carte/fond.json', 'data/carte/batis.json', 'data/lieux.json', 'data/photos.json', 'data/vacances.json', 'data/trajets.json',
  'img/icone-32.png', 'img/icone-192.png', 'img/icone-512.png',
  'fonts/cormorantgaramond-500-latin.woff2', 'fonts/cormorantgaramond-500-latin-ext.woff2',
  'fonts/cormorantgaramond-500i-latin.woff2', 'fonts/cormorantgaramond-500i-latin-ext.woff2',
  'fonts/inter-normal-latin.woff2', 'fonts/inter-normal-latin-ext.woff2',
];
const cle = (url) => { const u = new URL(url); u.search = ''; return u.href; };

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const frais = (u) => new Request(u, { cache: 'reload' });
    await cache.addAll(COEUR.map(frais));
    try {
      const photos = await (await fetch(frais('data/photos.json'))).json();
      await Promise.allSettled(Object.values(photos).map((p) => cache.add(frais(p.mini))));
    } catch { /* gardées à la consultation */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(webp|jpe?g|png|svg|woff2)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const enCache = await cache.match(cle(req.url));
      if (enCache) return enCache;
      const r = await fetch(req);
      if (r.ok) cache.put(cle(req.url), r.clone());
      return r;
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const r = await fetch(req);
      if (r.ok) cache.put(cle(req.url), r.clone());
      return r;
    } catch {
      return (await cache.match(cle(req.url))) || (req.mode === 'navigate' && (await cache.match(cle(new URL('index.html', self.location).href)))) || Response.error();
    }
  })());
});
