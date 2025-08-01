import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiService } from '../services/api';
import GameGrid from './GameGrid';
import AdminDashboard from './AdminDashboard';
import MobileDashboard from './MobileDashboard';
import MobileProfileCard from './MobileProfileCard';
import VoiceRoom from './VoiceRoom';
import { User } from '../types';
import {
  LogOut,
  Crown,
  Coins,
  Gem,
  Trophy,
  Star,
  Bell,
  Settings,
  User as UserIcon,
  Volume2,
  Gamepad2,
  Users,
  Home
} from 'lucide-react';

interface MainDashboardProps {
  user: User;
  onLogout: () => void;
  wsService?: any;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ user, onLogout, wsService }) => {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'home' | 'games' | 'voice' | 'leaderboard' | 'profile'>(() => {
    const isInVoiceRoom = localStorage.getItem('isInVoiceRoom') === 'true';
    const savedTab = localStorage.getItem('activeTab');

    if (isInVoiceRoom) {
      return 'voice';
    }

    return (savedTab as 'home' | 'games' | 'voice' | 'leaderboard' | 'profile') || 'home';
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTabChange = (tab: 'home' | 'games' | 'voice' | 'leaderboard' | 'profile') => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setLocation('/login');
    onLogout();
  };

  if (!user || !user.username) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 via-yellow-900 to-black text-white">
        <h1 className="text-3xl font-bold mb-4">⚠️ لا توجد بيانات لاعب!</h1>
        <pre className="bg-black/60 rounded-lg p-4 text-left text-xs max-w-xl overflow-x-auto mb-4">
          {JSON.stringify(user, null, 2)}
        </pre>
        <p className="mb-4">يرجى التأكد من أن حسابك يحتوي على اسم مستخدم وصورة ورصيد.</p>
        <button onClick={onLogout} className="px-6 py-2 bg-red-600 rounded-lg text-white font-bold">تسجيل الخروج</button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileDashboard
        userData={user}
        onLogout={handleLogout}
        wsService={wsService}
      />
    );
  }

  // مكون الصفحة الرئيسية الجديد
  const HomeScreen = () => (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">مرحباً، {user.username}! 👋</h1>
          <p className="text-purple-300 text-lg">اختر ما تريد القيام به اليوم</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm">النقاط</p>
                <p className="text-2xl font-bold text-white">{user.coins || 0}</p>
              </div>
              <Coins className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm">الجواهر</p>
                <p className="text-2xl font-bold text-white">{user.goldCoins || 0}</p>
              </div>
              <Gem className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm">اللآلئ</p>
                <p className="text-2xl font-bold text-white">{user.pearls || 0}</p>
              </div>
              <Star className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <button
            onClick={() => handleTabChange('games')}
            className="bg-gradient-to-br from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 transition-all duration-300 transform hover:scale-105 group"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">الألعاب</h3>
              <p className="text-purple-300 text-sm">اختر لعبتك المفضلة</p>
            </div>
          </button>

          <button
            onClick={() => handleTabChange('voice')}
            className="bg-gradient-to-br from-green-600/30 to-emerald-600/30 hover:from-green-600/50 hover:to-emerald-600/50 backdrop-blur-sm rounded-xl p-6 border border-green-500/30 transition-all duration-300 transform hover:scale-105 group"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Volume2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">الغرفة الصوتية</h3>
              <p className="text-green-300 text-sm">تواصل مع الأصدقاء</p>
            </div>
          </button>

          <button
            onClick={() => handleTabChange('leaderboard')}
            className="bg-gradient-to-br from-yellow-600/30 to-orange-600/30 hover:from-yellow-600/50 hover:to-orange-600/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/30 transition-all duration-300 transform hover:scale-105 group"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">المتصدرين</h3>
              <p className="text-yellow-300 text-sm">شاهد أفضل اللاعبين</p>
            </div>
          </button>

          <button
            onClick={() => handleTabChange('profile')}
            className="bg-gradient-to-br from-blue-600/30 to-cyan-600/30 hover:from-blue-600/50 hover:to-cyan-600/50 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30 transition-all duration-300 transform hover:scale-105 group"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">البروفايل</h3>
              <p className="text-blue-300 text-sm">إدارة حسابك</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // مكون المتصدرين الجديد
  const LeaderboardScreen = () => (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 المتصدرين</h1>
          <p className="text-purple-300">شاهد أفضل اللاعبين في المنصة</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
          <div className="space-y-4">
            {/* Top 3 Players */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">🥈</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                </div>
                <h3 className="font-bold text-white">اللاعب الثاني</h3>
                <p className="text-gray-400 text-sm">2,500 نقطة</p>
              </div>

              {/* 1st Place */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">👑</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                </div>
                <h3 className="font-bold text-white">اللاعب الأول</h3>
                <p className="text-yellow-400 text-sm">3,200 نقطة</p>
              </div>

              {/* 3rd Place */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">🥉</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                </div>
                <h3 className="font-bold text-white">اللاعب الثالث</h3>
                <p className="text-orange-400 text-sm">1,800 نقطة</p>
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {[4, 5, 6, 7, 8, 9, 10].map((rank) => (
                <div key={rank} className="flex items-center justify-between p-4 bg-purple-800/20 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{rank}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">اللاعب {rank}</h4>
                      <p className="text-purple-300 text-sm">{1500 - (rank * 100)} نقطة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-semibold">{1500 - (rank * 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800/60 to-indigo-800/60 backdrop-blur-md border-b border-purple-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">∞</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">INFINITY BOX</h1>
                <p className="text-purple-200 text-sm">منصة الألعاب التفاعلية</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* User Stats */}
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full border border-purple-500/20">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-sm font-medium">{user.coins || 0}</span>
              </div>

              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full border border-purple-500/20">
                <Gem className="w-4 h-4 text-green-400" />
                <span className="text-white text-sm font-medium">{user.goldCoins || 0}</span>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center gap-2 bg-purple-600/50 hover:bg-purple-600/70 px-3 py-2 rounded-full transition-colors">
                  <img
                    src={user.profileImage || '/default-avatar.png'}
                    alt={user.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-white text-sm font-medium">{user.username}</span>
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-red-600/50 hover:bg-red-600/70 px-3 py-2 rounded-full transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-gradient-to-b from-purple-900/50 to-indigo-900/50 backdrop-blur-sm border-r border-purple-500/30 p-4">
            <nav className="space-y-2">
              <button
                onClick={() => handleTabChange('home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'home'
                    ? 'bg-purple-600/50 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="font-medium">الرئيسية</span>
              </button>

              <button
                onClick={() => handleTabChange('games')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'games'
                    ? 'bg-purple-600/50 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-5 h-5" />
                <span className="font-medium">الألعاب</span>
              </button>

              <button
                onClick={() => handleTabChange('voice')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'voice'
                    ? 'bg-purple-600/50 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <Volume2 className="w-5 h-5" />
                <span className="font-medium">الغرفة الصوتية</span>
              </button>

              <button
                onClick={() => handleTabChange('leaderboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'leaderboard'
                    ? 'bg-purple-600/50 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <Trophy className="w-5 h-5" />
                <span className="font-medium">المتصدرين</span>
              </button>

              <button
                onClick={() => handleTabChange('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'profile'
                    ? 'bg-purple-600/50 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5" />
                <span className="font-medium">البروفايل</span>
              </button>

              {/* Admin Panel */}
              {user.isAdmin && (
                <div className="pt-4 border-t border-purple-500/30">
                  <button
                    onClick={() => setLocation('/admin')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-yellow-300 hover:bg-yellow-600/30 transition-all duration-300"
                  >
                    <Crown className="w-5 h-5" />
                    <span className="font-medium">لوحة الإدارة</span>
                  </button>
                </div>
              )}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'home' && <HomeScreen />}
            {activeTab === 'games' && <GameGrid />}
            {activeTab === 'voice' && <VoiceRoom user={user} wsService={wsService} />}
            {activeTab === 'leaderboard' && <LeaderboardScreen />}
            {activeTab === 'profile' && <MobileProfileCard userData={user} onLogout={handleLogout} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;