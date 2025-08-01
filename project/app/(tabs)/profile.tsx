import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, CreditCard as Edit3, Save, X, Trophy, Target, Clock, Star, User, Globe } from 'lucide-react-native';

export default function ProfileScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [profileData, setProfileData] = useState({
    arabicName: 'أحمد محمد',
    englishName: 'Ahmed Mohammed',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    level: 25,
    totalScore: 15420,
    gamesPlayed: 127,
    winRate: 78,
    achievements: 12,
  });

  const [editData, setEditData] = useState({
    arabicName: profileData.arabicName,
    englishName: profileData.englishName,
  });

  const handleSave = () => {
    setProfileData({
      ...profileData,
      arabicName: editData.arabicName,
      englishName: editData.englishName,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      arabicName: profileData.arabicName,
      englishName: profileData.englishName,
    });
    setIsEditing(false);
  };

  const handleImageChange = () => {
    // في التطبيق الحقيقي، ستستخدم expo-image-picker هنا
    const sampleImages = [
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
      'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
      'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    ];
    
    const randomImage = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    setProfileData({ ...profileData, avatar: randomImage });
    setShowImagePicker(false);
  };

  const stats = [
    { icon: Trophy, label: 'المستوى', value: profileData.level.toString(), color: '#ffd700' },
    { icon: Target, label: 'النقاط', value: profileData.totalScore.toLocaleString(), color: '#00d4ff' },
    { icon: Clock, label: 'الألعاب', value: profileData.gamesPlayed.toString(), color: '#ff6b6b' },
    { icon: Star, label: 'معدل الفوز', value: `${profileData.winRate}%`, color: '#4ecdc4' },
  ];

  return (
    <LinearGradient
      colors={['#0f0f23', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>البروفايل الشخصي</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <X size={20} color="#ffffff" />
            ) : (
              <Edit3 size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#06b6d4']}
            style={styles.profileGradient}
          >
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowImagePicker(true)}
                disabled={!isEditing}
              >
                <Image source={{ uri: profileData.avatar }} style={styles.avatar} />
                {isEditing && (
                  <View style={styles.cameraOverlay}>
                    <Camera size={20} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{profileData.level}</Text>
              </View>
            </View>

            {/* Name Section */}
            <View style={styles.nameSection}>
              {isEditing ? (
                <View style={styles.editForm}>
                  <View style={styles.inputGroup}>
                    <User size={16} color="#9ca3af" />
                    <TextInput
                      style={styles.input}
                      value={editData.arabicName}
                      onChangeText={(text) => setEditData({ ...editData, arabicName: text })}
                      placeholder="الاسم بالعربية"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Globe size={16} color="#9ca3af" />
                    <TextInput
                      style={styles.input}
                      value={editData.englishName}
                      onChangeText={(text) => setEditData({ ...editData, englishName: text })}
                      placeholder="Name in English"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                      <Save size={16} color="#ffffff" />
                      <Text style={styles.saveButtonText}>حفظ</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                      <X size={16} color="#ffffff" />
                      <Text style={styles.cancelButtonText}>إلغاء</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.nameDisplay}>
                  <Text style={styles.arabicName}>{profileData.arabicName}</Text>
                  <Text style={styles.englishName}>{profileData.englishName}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>الإحصائيات</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <LinearGradient
                  colors={[stat.color + '20', stat.color + '10']}
                  style={styles.statGradient}
                >
                  <View style={[styles.statIcon, { backgroundColor: stat.color }]}>
                    <stat.icon size={20} color="white" />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsContainer}>
          <Text style={styles.sectionTitle}>الإنجازات</Text>
          <View style={styles.achievementsBadge}>
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.achievementsGradient}
            >
              <Trophy size={24} color="#1a1a2e" />
              <Text style={styles.achievementsText}>
                {profileData.achievements} إنجاز مكتمل
              </Text>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تغيير الصورة الشخصية</Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={handleImageChange}>
              <Camera size={20} color="#ffffff" />
              <Text style={styles.modalButtonText}>اختيار صورة جديدة</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowImagePicker(false)}
            >
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileGradient: {
    padding: 30,
    alignItems: 'center',
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  levelBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  nameSection: {
    width: '100%',
    alignItems: 'center',
  },
  nameDisplay: {
    alignItems: 'center',
  },
  arabicName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  englishName: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
  },
  editForm: {
    width: '100%',
    alignItems: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    width: '100%',
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statCard: {
    width: '47%',
    borderRadius: 15,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  achievementsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  achievementsBadge: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  achievementsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  achievementsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 15,
    gap: 10,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalCancelButton: {
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#9ca3af',
    fontSize: 16,
  },
});