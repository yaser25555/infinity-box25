import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import MainDashboard from './components/MainDashboard';
import { WebSocketService } from './services/websocket';
import { RealTimeSyncService } from './services/realtime-sync';
import { apiService } from './services/api';
import { User } from './types';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsService] = useState(() => new WebSocketService(`ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`));
  const [syncService] = useState(() => new RealTimeSyncService(wsService));

  useEffect(() => {
    // Clear any old activeTab data
    localStorage.removeItem('activeTab');

    // إعداد مستمعي أحداث التزامن
    setupSyncEventListeners();

    const token = localStorage.getItem('token');
    console.log('🔍 App: Checking token:', token ? 'Token exists' : 'No token found');

    if (token) {
      console.log('🔄 App: Attempting to get current user...');
      apiService.getCurrentUser()
        .then((user) => {
          console.log('✅ App: User data received:', user);
          if (user && typeof user === 'object') {
            // استخدام isAdmin من بيانات الخادم، وليس من localStorage
            setUserData(user as User);
            // تحديث localStorage بالقيمة الصحيحة من الخادم
            localStorage.setItem('isAdmin', (user as any).isAdmin ? 'true' : 'false');
          } else {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            setUserData({ id: '', username: '', isAdmin } as User);
          }
          console.log('🔓 App: Setting authenticated to true');
          setIsAuthenticated(true);
          // الاتصال بـ WebSocket
          const token = localStorage.getItem('token');
          if (token) {
            wsService.connect(token).then(() => {
              console.log('✅ WebSocket connected on app load');
            }).catch((error: any) => {
              console.error('❌ Failed to connect to WebSocket on app load:', error);
            });
          }
        })
        .catch((error) => {
          console.log('❌ App: Error getting user:', error);
          // Check if logged in from another device
          if (error.message.includes('MULTIPLE_LOGIN')) {
            alert('تم تسجيل الدخول من جهاز آخر. سيتم تسجيل خروجك من هذا الجهاز.');
          }
          console.log('🔒 App: Setting authenticated to false');
          setIsAuthenticated(false);
          setUserData(null);
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('isAdmin');
        })
        .finally(() => {
          console.log('⏹️ App: Loading finished');
          setIsLoading(false);
        });
    } else {
      console.log('🔒 App: No token found, setting authenticated to false');
      setIsLoading(false);
    }
  }, []);

  // إعداد مستمعي أحداث التزامن
  const setupSyncEventListeners = () => {
    // تحديث الرصيد
    window.addEventListener('balanceUpdated', (event: any) => {
      if (userData) {
        setUserData(prev => prev ? {
          ...prev,
          goldCoins: event.detail.newBalance || event.detail.goldCoins,
          pearls: event.detail.pearls || prev.pearls
        } : null);
      }
    });

    // تحديث البروفايل
    window.addEventListener('profileUpdated', (event: any) => {
      if (userData) {
        setUserData(prev => prev ? {
          ...prev,
          ...event.detail
        } : null);
      }
    });

    // استلام هدية
    window.addEventListener('giftReceived', (event: any) => {
      // يمكن إضافة إشعار أو تحديث واجهة المستخدم
      console.log('🎁 تم استلام هدية:', event.detail);
    });

    // فشل في تنفيذ إجراء
    window.addEventListener('actionFailed', (event: any) => {
      console.error('❌ فشل في تنفيذ الإجراء:', event.detail);
      // يمكن إضافة إشعار للمستخدم
    });
  };

  const handleAuthSuccess = async (userData: any) => {
    setUserData(userData);
    setIsAuthenticated(true);
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await wsService.connect(token);
      }
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    wsService.disconnect();
    setIsAuthenticated(false);
    setUserData(null);
  };

  const handleUpdateProfile = (updatedData: any) => {
    console.log('🔄 App: Updating user data:', updatedData);
    const newUserData = { ...userData, ...updatedData };
    setUserData(newUserData);
  };

  if (isLoading) {
    console.log('⏳ App: Showing loading screen');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('🔐 App: Showing AuthPage (not authenticated)');
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  console.log('🏠 App: Showing MainDashboard (authenticated)');
  return userData ? <MainDashboard user={userData} onLogout={handleLogout} wsService={wsService} /> : null;
}

export default App;