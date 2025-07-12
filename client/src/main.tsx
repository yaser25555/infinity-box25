import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// تسجيل Service Worker للـ PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ PWA: Service Worker registered successfully:', registration.scope);

        // فحص التحديثات
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // إشعار المستخدم بوجود تحديث
                if (confirm('يتوفر تحديث جديد للتطبيق. هل تريد إعادة التحميل؟')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ PWA: Service Worker registration failed:', error);
      });
  });

  // الاستماع لتحديثات Service Worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// إضافة مستمع لحدث beforeinstallprompt
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 PWA: Install prompt available');
  e.preventDefault();
  deferredPrompt = e;

  // يمكن إضافة زر تثبيت مخصص هنا
  showInstallButton();
});

// دالة لإظهار زر التثبيت
function showInstallButton() {
  // إنشاء زر تثبيت ديناميكي
  const installButton = document.createElement('button');
  installButton.textContent = '📱 تثبيت التطبيق';
  installButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 25px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    z-index: 1000;
    transition: all 0.3s ease;
  `;

  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: Install prompt outcome: ${outcome}`);
      deferredPrompt = null;
      installButton.remove();
    }
  });

  installButton.addEventListener('mouseenter', () => {
    installButton.style.transform = 'scale(1.05)';
    installButton.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
  });

  installButton.addEventListener('mouseleave', () => {
    installButton.style.transform = 'scale(1)';
    installButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
  });

  document.body.appendChild(installButton);

  // إخفاء الزر بعد 10 ثوان
  setTimeout(() => {
    if (installButton.parentNode) {
      installButton.style.opacity = '0';
      setTimeout(() => installButton.remove(), 300);
    }
  }, 10000);
}

// معالجة حالة التطبيق المثبت
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA: App installed successfully!');
  deferredPrompt = null;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
