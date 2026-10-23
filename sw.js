/* Fresh-first cache: prevents stale UI after GitHub Pages deployments. */
const CACHE='homework-hub-pwa-v5';
const CORE=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
const scope=new URL(self.registration.scope);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('homework-hub-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;const cacheFresh=()=>fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}return response}).catch(async()=>await caches.match(request)||(request.mode==='navigate'?await caches.match('./index.html'):null)||Response.error());if(request.mode==='navigate'){event.respondWith(cacheFresh());return}if(['.js','.css','.json','.png','.svg','.ico','.webp'].some(ext=>url.pathname.endsWith(ext)))event.respondWith(cacheFresh())});
