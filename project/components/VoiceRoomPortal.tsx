import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Users,
  Phone,
  PhoneOff,
  Settings,
  X,
} from 'lucide-react-native';

interface VoiceUser {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

export default function VoiceRoomPortal() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [connectedUsers] = useState<VoiceUser[]>([
    {
      id: '1',
      name: 'أحمد محمد',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
      isSpeaking: true,
      isMuted: false,
    },
    {
      id: '2',
      name: 'سارة أحمد',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
      isSpeaking: false,
      isMuted: true,
    },
    {
      id: '3',
      name: 'محمد علي',
      avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
      isSpeaking: false,
      isMuted: false,
    },
  ]);

  const handleConnect = () => {
    setIsConnected(true);
    setShowRoomModal(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setShowRoomModal(false);
    setIsMuted(false);
    setIsDeafened(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  if (!isConnected) {
    return (
      <View style={styles.portalContainer}>
        <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
          <LinearGradient
            colors={['#10b981', '#059669']}
            style={styles.connectGradient}
          >
            <Mic size={20} color="#ffffff" />
            <Text style={styles.connectText}>انضم للغرفة الصوتية</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* Voice Room Portal Bar */}
      <TouchableOpacity
        style={styles.voiceBar}
        onPress={() => setShowRoomModal(true)}
      >
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          style={styles.voiceBarGradient}
        >
          <View style={styles.voiceBarContent}>
            <View style={styles.voiceBarLeft}>
              <View style={styles.voiceIndicator}>
                <Mic size={16} color="#ffffff" />
              </View>
              <Text style={styles.voiceBarText}>الغرفة الصوتية</Text>
              <View style={styles.userCount}>
                <Users size={14} color="#ffffff" />
                <Text style={styles.userCountText}>{connectedUsers.length}</Text>
              </View>
            </View>
            
            <View style={styles.voiceBarControls}>
              <TouchableOpacity
                style={[styles.controlButton, isMuted && styles.mutedButton]}
                onPress={toggleMute}
              >
                {isMuted ? (
                  <MicOff size={16} color="#ffffff" />
                ) : (
                  <Mic size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnect}
              >
                <PhoneOff size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Voice Room Modal */}
      <Modal
        visible={showRoomModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRoomModal(false)}
      >
        <LinearGradient
          colors={['#0f0f23', '#1a1a2e', '#16213e']}
          style={styles.modalContainer}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>الغرفة الصوتية</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowRoomModal(false)}
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Connected Users */}
          <ScrollView style={styles.usersContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>المتصلون ({connectedUsers.length})</Text>
            
            <View style={styles.usersGrid}>
              {connectedUsers.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userAvatarContainer}>
                    <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                    {user.isSpeaking && (
                      <View style={styles.speakingIndicator}>
                        <View style={styles.speakingRing} />
                      </View>
                    )}
                    {user.isMuted && (
                      <View style={styles.mutedIndicator}>
                        <MicOff size={12} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.userName}>{user.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Voice Controls */}
          <View style={styles.controlsContainer}>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.largeControlButton, isMuted && styles.mutedButton]}
                onPress={toggleMute}
              >
                {isMuted ? (
                  <MicOff size={24} color="#ffffff" />
                ) : (
                  <Mic size={24} color="#ffffff" />
                )}
                <Text style={styles.controlButtonText}>
                  {isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.largeControlButton, isDeafened && styles.deafenedButton]}
                onPress={toggleDeafen}
              >
                {isDeafened ? (
                  <VolumeX size={24} color="#ffffff" />
                ) : (
                  <Volume2 size={24} color="#ffffff" />
                )}
                <Text style={styles.controlButtonText}>
                  {isDeafened ? 'تشغيل الصوت' : 'إيقاف الصوت'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.disconnectLargeButton}
              onPress={handleDisconnect}
            >
              <PhoneOff size={24} color="#ffffff" />
              <Text style={styles.disconnectButtonText}>مغادرة الغرفة</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  portalContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  connectButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 10,
  },
  connectText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  voiceBar: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    borderRadius: 25,
    overflow: 'hidden',
    zIndex: 1000,
  },
  voiceBarGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  voiceBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceBarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  voiceBarControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#ef4444',
  },
  disconnectButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'space-around',
  },
  userCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  speakingIndicator: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakingRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: '#10b981',
  },
  mutedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 80,
  },
  controlsContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  largeControlButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    gap: 8,
  },
  deafenedButton: {
    backgroundColor: '#f59e0b',
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  disconnectLargeButton: {
    backgroundColor: '#ef4444',
    borderRadius: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disconnectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});