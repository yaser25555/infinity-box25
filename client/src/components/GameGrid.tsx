import React from 'react';
import GameCard from './GameCard';
import { Gamepad2, Zap, Target, Puzzle, Brain, Trees, Crown, Apple, Users, Star } from 'lucide-react';
import { useLocation } from 'wouter';

interface GameGridProps {
  setActiveTab?: (tab: 'games' | 'leaderboard' | 'profile' | 'admin') => void;
}

const GameGrid: React.FC<GameGridProps> = ({ setActiveTab }) => {
  const [location, setLocation] = useLocation();
  
  const games = [
    {
      id: 1,
      title: 'تحدي السرعة',
      description: 'اختبر سرعة ردود أفعالك في هذا التحدي المثير',
      icon: Zap,
      color: 'from-yellow-500 to-orange-500',
      players: 8930,
      rating: 4.8,
      onPlay: () => window.open('/speed-challenge.html', '_blank')
    },
    {
      id: 2,
      title: 'صناديق الحظ',
      description: 'اكسر الصناديق واجمع الكنوز والجواهر',
      icon: Target,
      color: 'from-green-500 to-emerald-500',
      players: 6780,
      rating: 4.9,
      onPlay: () => window.open('/game8.html', '_blank')
    },
    {
      id: 3,
      title: 'ألغاز العقل',
      description: 'حل الألغاز المعقدة واختبر ذكاءك',
      icon: Puzzle,
      color: 'from-blue-500 to-cyan-500',
      players: 12150,
      rating: 4.7,
      onPlay: () => window.open('/mind-puzzles.html', '_blank')
    },
    {
      id: 4,
      title: 'قطف الفواكه',
      description: 'اقطف الفواكه الساقطة واجمع النقاط',
      icon: Apple,
      color: 'from-red-500 to-pink-500',
      players: 5430,
      rating: 4.6,
      onPlay: () => window.open('/fruit-catching.html', '_blank')
    },
    {
      id: 5,
      title: 'لعبة الذاكرة',
      description: 'اختبر ذاكرتك وطابق البطاقات',
      icon: Brain,
      color: 'from-purple-500 to-indigo-500',
      players: 7890,
      rating: 4.8,
      onPlay: () => window.open('/memory-match.html', '_blank')
    },
    {
      id: 6,
      title: 'لعبة الغابة',
      description: 'اكتشف الحيوانات وتعلم أسماءها',
      icon: Trees,
      color: 'from-green-600 to-emerald-600',
      players: 4560,
      rating: 4.5,
      onPlay: () => window.open('/forest-game.html', '_blank')
    }
  ];

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🎮 قاعة الألعاب</h1>
          <p className="text-purple-300 text-lg">اختر لعبتك المفضلة واستمتع بالتحدي</p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={game.onPlay}
              className="group bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
            >
              <div className="text-center">
                {/* Game Icon */}
                <div className={`w-20 h-20 bg-gradient-to-r ${game.color} rounded-full mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <game.icon className="w-10 h-10 text-white" />
                </div>

                {/* Game Info */}
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {game.title}
                </h3>
                
                <p className="text-purple-300 text-sm mb-4 leading-relaxed">
                  {game.description}
                </p>

                {/* Game Stats */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-purple-300">
                    <Users className="w-4 h-4" />
                    <span>{game.players.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{game.rating}</span>
                  </div>
                </div>

                {/* Play Button */}
                <div className="mt-4">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-full font-medium group-hover:from-purple-500 group-hover:to-indigo-500 transition-all duration-300">
                    العب الآن
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Featured Game Section */}
        <div className="mt-12">
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 backdrop-blur-sm rounded-xl p-8 border border-yellow-500/30">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">⭐ اللعبة المميزة</h2>
              <p className="text-yellow-300">صناديق الحظ - أكثر الألعاب شعبية</p>
            </div>
            
            <div className="flex items-center justify-center">
              <button
                onClick={() => window.open('/game8.html', '_blank')}
                className="group bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-yellow-500/50"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-6 h-6" />
                  <span>العب صناديق الحظ الآن</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30 text-center">
            <div className="text-2xl font-bold text-white mb-1">6</div>
            <div className="text-purple-300 text-sm">ألعاب متاحة</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-sm rounded-xl p-4 border border-green-500/30 text-center">
            <div className="text-2xl font-bold text-white mb-1">45K+</div>
            <div className="text-green-300 text-sm">لاعب نشط</div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30 text-center">
            <div className="text-2xl font-bold text-white mb-1">4.7</div>
            <div className="text-blue-300 text-sm">متوسط التقييم</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameGrid;