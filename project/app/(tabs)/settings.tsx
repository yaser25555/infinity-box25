import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Volume2, Moon, Globe, Shield, CircleHelp as HelpCircle, LogOut, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const settingsOptions = [
    {
      icon: Bell,
      title: 'الإشعارات',
      subtitle: 'تلقي إشعارات الألعاب والتحديثات',
      type: 'switch',
      value: notifications,
      onToggle: setNotifications,
    },
    {
      icon: Volume2,
      title: 'الصوت',
      subtitle: 'تشغيل الأصوات والموسيقى',
      type: 'switch',
      value: sound,
      onToggle: setSound,
    },
    {
      icon: Moon,
      title: 'الوضع الليلي',
      subtitle: 'تفعيل المظهر الداكن',
      type: 'switch',
      value: darkMode,
      onToggle: setDarkMode,
    },
    {
      icon: Globe,
      title: 'اللغة',
      subtitle: 'العربية',
      type: 'navigation',
    },
    {
      icon: Shield,
      title: 'الخصوصية والأمان',
      subtitle: 'إدارة بيانات الحساب',
      type: 'navigation',
    },
    {
      icon: HelpCircle,
      title: 'المساعدة والدعم',
      subtitle: 'الأسئلة الشائعة والتواصل',
      type: 'navigation',
    },
  ];

  return (
    <LinearGradient
      colors={['#0f0f23', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>الإعدادات</Text>
        <Text style={styles.subtitle}>تخصيص تجربة اللعب</Text>
      </View>

      <ScrollView style={styles.settingsContainer} showsVerticalScrollIndicator={false}>
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.settingCard}
            disabled={option.type === 'switch'}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
              style={styles.settingGradient}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <option.icon size={20} color="#00d4ff" />
                </View>
                
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{option.title}</Text>
                  <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
                </View>
                
                <View style={styles.settingAction}>
                  {option.type === 'switch' ? (
                    <Switch
                      value={option.value}
                      onValueChange={option.onToggle}
                      trackColor={{ false: '#374151', true: '#00d4ff' }}
                      thumbColor={option.value ? '#ffffff' : '#9ca3af'}
                    />
                  ) : (
                    <ChevronRight size={20} color="#9ca3af" />
                  )}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutCard}>
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.logoutGradient}
          >
            <View style={styles.logoutContent}>
              <LogOut size={20} color="#ffffff" />
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>منصة الألعاب v1.0.0</Text>
        </View>
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
  settingsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingGradient: {
    padding: 16,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  settingAction: {
    marginLeft: 16,
  },
  logoutCard: {
    marginTop: 20,
    marginBottom: 30,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutGradient: {
    padding: 16,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
  },
});