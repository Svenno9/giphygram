// In this file, self a keyword that refers to the service worker itself. 
// The service worker uses two apis:
// Cache api https://developer.mozilla.org/en-US/docs/Web/API/Cache 
// Fetch api https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

const version = '1.0'

// If any of the staticAssets change, the version above should be increased. 
// This is the simplest way to reset the cache. 
const staticAssets = [
  "index.html",
  "main.js",
  "vendor/bootstrap.min.css",
  "vendor/jquery.min.js",

  "images/flame.png",
  "images/logo.png",
  "images/sync.png"
]

const staticAssetsCacheName = `static-${version}`

// During the service workers install event, all static assets are cached.
// The wait for the cacheReadyPromise is there so that the install event does not finish before the cache is ready. 
self.addEventListener('install', (e) => {
  const cacheReadyPromise = caches.open(staticAssetsCacheName).then((cache) => {
    return cache.addAll(staticAssets)
  })

  e.waitUntil(cacheReadyPromise);
});

// When a newly installed service worker takes over it will activate. 
// It has already been installed and new cache has been setup, here we clean up all old caches. 
// Again we wait for the promise so that the activate event does not finish before cleanup is finished. 
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
// This function takes a request and attempt to serve it from the cache first. 
// It it is not in the cache it will fetch it and add it to the cache. 
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
// This function takes a request and tries to fetch it over the network. 
// If successful, then the result is cached. 
// If the fetch fail we attempt to fallback to cache. 
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

// The function sends an array of giphy urls. 
// Urls that are in the cache, but not the array are deleted.
// This is to preserve memory. 
// When the app (main.js) has fetched a new list of giphys, only those should be stored in the cache. 
// All old giphys are deleted. 
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

  // Here the service worker listen to all fetch request. 
  // Some of the fetch requests are intercepted and a caching strategy is applied. 
  // All other requests go through as normal. 
  // It is important that not everything is cached. 
  // If everything was intercepted, then we would cache requests made by chrome extensions for example. That is not something we want. 

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