// LOCK IN service worker — v6
// Strategy: the app document (index.html) is NETWORK-FIRST.
// When you push new code to GitHub, the next time you open the app online it fetches
// the fresh HTML automatically — no more clearing Safari data. Still fully offline
// via the cache fallback. Cache name bumped to v6 so the v8 app code lands cleanly.

const CACHE='lockin-v6';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

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
  let url;
  try{url=new URL(req.url);}catch(err){return;}

  // NETWORK-FIRST for the app document so code updates apply on next online load
  const isDoc = req.mode==='navigate'
    || req.destination==='document'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html');

  if(isDoc){
    e.respondWith(
      fetch(req)
        .then(resp=>{
          const clone=resp.clone();
          caches.open(CACHE).then(c=>c.put('./index.html',clone)).catch(()=>{});
          return resp;
        })
        .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./')))
    );
    return;
  }

  // STALE-WHILE-REVALIDATE for same-origin assets (icons, manifest, sw itself)
  e.respondWith(
    caches.match(req).then(cached=>{
      const fetching=fetch(req).then(resp=>{
        if(resp && resp.status===200 && url.origin===self.location.origin){
          const clone=resp.clone();
          caches.open(CACHE).then(c=>c.put(req,clone)).catch(()=>{});
        }
        return resp;
      }).catch(()=>cached);
      return cached||fetching;
    })
  );
});
