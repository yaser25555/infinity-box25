import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import MainDashboard from './components/MainDashboard';
import PWAInstallButton from './components/PWAInstallButton';
import { WebSocketService } from './services/websocket';
import { apiService } from './services/api';
import { User } from './types';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsService] = useState(() => new WebSocketService(`ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`));

  useEffect(() => {
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

            // حفظ البيانات في localStorage للحفاظ على الجلسة
            localStorage.setItem('username', (user as any).username || '');
            localStorage.setItem('isAdmin', (user as any).isAdmin ? 'true' : 'false');
            localStorage.setItem('userId', (user as any).id || (user as any)._id || '');
          } else {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            const username = localStorage.getItem('username') || '';
            setUserData({ id: '', username, isAdmin } as User);
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

          // فقط في حالات معينة نقوم بتسجيل الخروج
          if (error.message && (
              error.message.includes('MULTIPLE_LOGIN') ||
              error.message.includes('Invalid token') ||
              error.message.includes('Token expired') ||
              error.message.includes('Unauthorized')
            ) || error.status === 401) {

            console.log('🔒 App: Invalid token, logging out');
            if (error.message && error.message.includes('MULTIPLE_LOGIN')) {
              alert('تم تسجيل الدخول من جهاز آخر. سيتم تسجيل خروجك من هذا الجهاز.');
            }

            setIsAuthenticated(false);
            setUserData(null);
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('isAdmin');
          } else {
            // في حالة أخطاء الشبكة أو أخطاء مؤقتة، نحافظ على تسجيل الدخول
            console.log('⚠️ App: Network error, keeping user logged in');

            // محاولة استخدام البيانات المحفوظة محلياً
            const savedUsername = localStorage.getItem('username');
            const savedIsAdmin = localStorage.getItem('isAdmin') === 'true';

            if (savedUsername) {
              setUserData({
                id: '',
                username: savedUsername,
                isAdmin: savedIsAdmin
              } as User);
              setIsAuthenticated(true);

              // محاولة الاتصال بـ WebSocket
              wsService.connect(token).catch((wsError: any) => {
                console.warn('⚠️ WebSocket connection failed:', wsError);
              });
            } else {
              // إذا لم توجد بيانات محفوظة، نسجل الخروج
              setIsAuthenticated(false);
              setUserData(null);
              localStorage.removeItem('token');
            }
          }
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

  const handleAuthSuccess = async (userData: any) => {
    console.log('🎉 App: Authentication successful, user data:', userData);

    setUserData(userData);
    setIsAuthenticated(true);

    // حفظ البيانات في localStorage للحفاظ على الجلسة عند تحديث الصفحة
    if (userData) {
      localStorage.setItem('username', userData.username || '');
      localStorage.setItem('isAdmin', userData.isAdmin ? 'true' : 'false');
      localStorage.setItem('userId', userData.id || userData._id || '');
    }

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await wsService.connect(token);
        console.log('✅ WebSocket connected after authentication');
      }
    } catch (error) {
      console.error('❌ Failed to connect to WebSocket after authentication:', error);
    }
  };

  const handleLogout = () => {
    console.log('👋 App: User logging out');

    // حذف جميع البيانات المحفوظة عند الخروج الفعلي
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userId');
    localStorage.removeItem('activeTab'); // حذف التبويب فقط عند الخروج الفعلي
    localStorage.removeItem('isInVoiceRoom');

    // قطع اتصال WebSocket
    wsService.disconnect();

    // إعادة تعيين الحالة
    setIsAuthenticated(false);
    setUserData(null);

    console.log('✅ App: Logout completed');
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
  return (
    <>
      {userData ? <MainDashboard user={userData} onLogout={handleLogout} wsService={wsService} /> : null}
      <PWAInstallButton />
    </>
  );
}

export default App;