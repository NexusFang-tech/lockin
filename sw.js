// ═══════════════════════════════════════════
// LOCK IN — Service Worker
// Cache: lockin-v7  (serves the v9 app code — Goals / Cookie Jar)
// Strategy: network-first for the document (so new HTML lands on the
//   next online load), cache-first for static shell assets.
// ═══════════════════════════════════════════
const CACHE='lockin-v7';
const SHELL=[
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — pre-cache the shell, then take over immediately.
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(SHELL).catch(()=>{/* some icons may be absent; ignore */}))
      .then(()=>self.skipWaiting())
  );
});

// Activate — purge every old cache version so stale HTML can't linger.
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;

  const isDoc=req.mode==='navigate' ||
              (req.headers.get('accept')||'').includes('text/html');

  if(isDoc){
    // Network-first: always try to pull the freshest HTML; fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache what we fetch).
  e.respondWith(
    caches.match(req).then(cached=>
      cached || fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        return res;
      }).catch(()=>cached)
    )
  );
});