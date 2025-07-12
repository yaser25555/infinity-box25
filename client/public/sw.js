// Service Worker محسن لـ INFINITY BOX
const CACHE_NAME = 'infinitybox-v1.0.0';
const STATIC_CACHE = 'infinitybox-static-v1';
const DYNAMIC_CACHE = 'infinitybox-dynamic-v1';

// الملفات المطلوب تخزينها مؤقتاً
const STATIC_FILES = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js',
  '/images/logo.png',
  '/images/default-avatar.png',
  '/sounds/click.mp3',
  '/sounds/win.mp3',
  '/sounds/lose.mp3'
];

// الملفات التي لا يجب تخزينها مؤقتاً
const EXCLUDE_CACHE = [
  '/api/',
  '/ws',
  '/health',
  '/admin/',
  'chrome-extension://',
  'moz-extension://'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES.filter(url => url !== '/'));
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Installation failed', error);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // تجاهل الطلبات المستثناة
  if (EXCLUDE_CACHE.some(pattern => request.url.includes(pattern))) {
    return;
  }
  
  // تجاهل طلبات POST وغيرها من الطرق غير GET
  if (request.method !== 'GET') {
    return;
  }
  
  // تجاهل طلبات WebSocket
  if (request.url.includes('/ws')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // إذا وجد في الكاش، أرجعه
        if (cachedResponse) {
          console.log('📦 Service Worker: Serving from cache', request.url);
          return cachedResponse;
        }
        
        // إذا لم يوجد، اجلبه من الشبكة
        return fetch(request)
          .then((networkResponse) => {
            // تحقق من صحة الاستجابة
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // نسخ الاستجابة للتخزين المؤقت
            const responseToCache = networkResponse.clone();
            
            // تخزين الملفات الثابتة في الكاش المناسب
            const cacheToUse = STATIC_FILES.includes(url.pathname) ? STATIC_CACHE : DYNAMIC_CACHE;
            
            caches.open(cacheToUse)
              .then((cache) => {
                console.log('💾 Service Worker: Caching new resource', request.url);
                cache.put(request, responseToCache);
              })
              .catch((error) => {
                console.warn('⚠️ Service Worker: Failed to cache', request.url, error);
              });
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('❌ Service Worker: Network request failed', request.url, error);
            
            // إرجاع صفحة offline إذا كانت متاحة
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // إرجاع صورة افتراضية للصور
            if (request.destination === 'image') {
              return caches.match('/images/default-avatar.png');
            }
            
            throw error;
          });
      })
  );
});

// معالجة رسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      console.log('🔄 Service Worker: Skip waiting requested');
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      console.log('🗑️ Service Worker: Clear cache requested');
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'CACHE_URLS':
      console.log('📦 Service Worker: Cache URLs requested', payload);
      if (payload && payload.urls) {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          return cache.addAll(payload.urls);
        }).then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      }
      break;
      
    default:
      console.log('📨 Service Worker: Unknown message type', type);
  }
});

// معالجة الإشعارات Push (إذا كانت مفعلة)
self.addEventListener('push', (event) => {
  console.log('📬 Service Worker: Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'إشعار جديد من INFINITY BOX',
      icon: '/images/logo.png',
      badge: '/images/favicon.png',
      tag: data.tag || 'infinitybox-notification',
      data: data.data || {},
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'INFINITY BOX', options)
    );
  }
});

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // إذا كان التطبيق مفتوحاً، ركز عليه
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // إذا لم يكن مفتوحاً، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// معالجة أخطاء Service Worker
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker: Error occurred', event.error);
});

// معالجة الأخطاء غير المعالجة
self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: Unhandled promise rejection', event.reason);
});

console.log('🎉 Service Worker: Script loaded successfully');
