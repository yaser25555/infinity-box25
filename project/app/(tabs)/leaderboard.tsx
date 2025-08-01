import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Medal, Award } from 'lucide-react-native';

const leaderboardData = [
  {
    id: 1,
    rank: 1,
    name: 'سارة أحمد',
    score: 25420,
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  },
  {
    id: 2,
    rank: 2,
    name: 'محمد علي',
    score: 23150,
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  },
  {
    id: 3,
    rank: 3,
    name: 'فاطمة حسن',
    score: 21890,
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  },
  {
    id: 4,
    rank: 4,
    name: 'أحمد محمد',
    score: 15420,
    avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  },
  {
    id: 5,
    rank: 5,
    name: 'نور الدين',
    score: 14200,
    avatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  },
];

export default function LeaderboardScreen() {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy size={20} color="#ffd700" />;
      case 2:
        return <Medal size={20} color="#c0c0c0" />;
      case 3:
        return <Award size={20} color="#cd7f32" />;
      default:
        return <Text style={styles.rankNumber}>{rank}</Text>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return ['#ffd700', '#ffed4e'];
      case 2:
        return ['#c0c0c0', '#e5e5e5'];
      case 3:
        return ['#cd7f32', '#daa520'];
      default:
        return ['#374151', '#4b5563'];
    }
  };

  return (
    <LinearGradient
      colors={['#0f0f23', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>لوحة المتصدرين</Text>
        <Text style={styles.subtitle}>أفضل اللاعبين هذا الشهر</Text>
      </View>

      <ScrollView style={styles.leaderboardContainer} showsVerticalScrollIndicator={false}>
        {leaderboardData.map((player, index) => (
          <View key={player.id} style={styles.playerCard}>
            <LinearGradient
              colors={getRankColor(player.rank)}
              style={styles.playerGradient}
            >
              <View style={styles.playerContent}>
                <View style={styles.rankContainer}>
                  {getRankIcon(player.rank)}
                </View>
                
                <Image source={{ uri: player.avatar }} style={styles.playerAvatar} />
                
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerScore}>
                    {player.score.toLocaleString()} نقطة
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
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
  leaderboardContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playerCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  playerGradient: {
    padding: 16,
  },
  playerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  playerScore: {
    fontSize: 14,
    color: '#e5e7eb',
  },
});