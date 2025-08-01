import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Zap, Target, Puzzle, Dices, Brain } from 'lucide-react-native';

const games = [
  { id: 1, name: 'لعبة الأكشن', icon: Zap, color: '#ff6b6b', players: '1.2K' },
  { id: 2, name: 'لعبة التصويب', icon: Target, color: '#4ecdc4', players: '890' },
  { id: 3, name: 'لعبة الألغاز', icon: Puzzle, color: '#45b7d1', players: '2.1K' },
  { id: 4, name: 'لعبة النرد', icon: Dices, color: '#f9ca24', players: '567' },
  { id: 5, name: 'لعبة الذكاء', icon: Brain, color: '#6c5ce7', players: '1.5K' },
  { id: 6, name: 'لعبة المغامرة', icon: Gamepad2, color: '#fd79a8', players: '3.2K' },
];

export default function GamesScreen() {
  return (
    <LinearGradient
      colors={['#0f0f23', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>منصة الألعاب</Text>
        <Text style={styles.subtitle}>اختر لعبتك المفضلة</Text>
      </View>

      <ScrollView style={styles.gamesContainer} showsVerticalScrollIndicator={false}>
        {games.map((game) => (
          <TouchableOpacity key={game.id} style={styles.gameCard}>
            <LinearGradient
              colors={[game.color + '20', game.color + '10']}
              style={styles.gameGradient}
            >
              <View style={styles.gameContent}>
                <View style={[styles.gameIcon, { backgroundColor: game.color }]}>
                  <game.icon size={24} color="white" />
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameName}>{game.name}</Text>
                  <Text style={styles.gamePlayers}>{game.players} لاعب نشط</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  gamesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  gameCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gameGradient: {
    padding: 20,
  },
  gameContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  gamePlayers: {
    fontSize: 14,
    color: '#9ca3af',
  },
});