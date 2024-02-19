const version = '1.0'

// if we change the contents here, we need to bump version above 
const staticAssets = [
  "index.html",
  "main.js",
  "vendor/bootstrap.min.css",
  "vendor/jquery.min.js",

  "images/flame.png",
  "images/logo.png",
  "images/sync.png",

  "/images/icons/favicon-32x32.png"
]

const staticAssetsCacheName = `static-${version}`

// here we cache all relevant files
self.addEventListener('install', (e) => {
  const cacheReadyPromise = caches.open(staticAssetsCacheName).then((cache) => {
    return cache.addAll(staticAssets)
  })

  e.waitUntil(cacheReadyPromise);
});

// here we clean old caches to preserve memory
self.addEventListener('activate', (e) => {
  const cacheCleanedPromise =  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key !== staticAssetsCacheName && key.match('static-')) {
        return caches.delete(key);
      }
    })
  });

  e.waitUntil(cacheCleanedPromise);
});

// Static cache strategy - cache with network fallback
const staticCache = (req, cacheName = staticAssetsCacheName) => {
    return caches.match(req.url).then((cachedRes) => {
      // return cached response if found
      if (cachedRes) {
        console.log(`Serving ${cachedRes.url} from cache.`);
        return cachedRes;
      }

      // Fall back to network 
      return fetch(req).then((networkRes) => {
        console.log(`Adding ${networkRes.url} to cache.`);
        caches.open(cacheName).then((cache) => {
          cache.put(req, networkRes)
        })
        return networkRes.clone();
      })
    })
}

// network with cache fallback 
const fallbackCache = (req) => {
  return fetch(req).then((networkRes) => {

    // Check if res is ok, if not go to cache
    if (!networkRes.ok) throw 'Fetch error';

    console.log(`Adding ${networkRes.url} to cache.`);
    caches.open(staticAssetsCacheName).then((cache) => {
      cache.put(req, networkRes)
    })
    return networkRes.clone();
  }).catch(() => {
    return caches.match(req.url).then((cachedRes) => {
      // return cached response if found
      if (cachedRes) {
        console.log(`Serving ${cachedRes.url} from cache.`);
        return cachedRes;
      }
    })
  })
}

const cleanGiphyCache = (giphys) => {
  caches.open('giphy').then(cache => {
    cache.keys().then(keys => {
      keys.forEach((key) => {
        if (!giphys.includes(key.url)) {
          cache.delete(key)
        }
      })
    })
  })
}

self.addEventListener('fetch', (e) => {
  // for this example only files from origin will be cached
  // something is needed here to avoid calls going to chrome extension
  // we do not want to cache all requests to api, how to avoid that? 

  // app shell 
  if (e.request.url.match(location.origin)) {
    e.respondWith(staticCache(e.request));

  // Giphy api 
  } else if (e.request.url.match('api.giphy.com/v1/gifs/trending')) {
    e.respondWith(fallbackCache(e.request));

  // Giphy media 
  } else if (e.request.url.match('giphy.com/media')) {
    e.respondWith(staticCache(e.request, 'giphy'));
  };
})

// listen for message from app 
self.addEventListener('message', e => {
  if (e.data.action === 'cleanGiphyCache') cleanGiphyCache(e.data.giphys)
})