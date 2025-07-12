// نظام الإشعارات الذكية
import { WebSocketService } from './websocket';

export interface NotificationPreferences {
  gameWins: boolean;
  gameLosses: boolean;
  gifts: boolean;
  messages: boolean;
  friendRequests: boolean;
  systemUpdates: boolean;
  balanceChanges: boolean;
  achievements: boolean;
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
}

export interface UserBehavior {
  activeHours: number[];
  preferredGameTypes: string[];
  averageSessionDuration: number;
  notificationResponseRate: number;
  lastActiveTime: Date;
  timezone: string;
}

export interface SmartNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  scheduledFor?: Date;
  expiresAt?: Date;
  isPersonalized: boolean;
  behaviorScore: number;
}

export class SmartNotificationService {
  private wsService: WebSocketService;
  private preferences: NotificationPreferences;
  private userBehavior: UserBehavior;
  private notificationQueue: SmartNotification[] = [];
  private isPermissionGranted: boolean = false;
  private behaviorAnalyzer: BehaviorAnalyzer;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    
    // تحميل التفضيلات المحفوظة
    this.loadPreferences();
    this.loadUserBehavior();
    
    // طلب إذن الإشعارات
    this.requestNotificationPermission();
    
    // إعداد مستمعي الأحداث
    this.setupEventListeners();
    
    // بدء تحليل السلوك
    this.startBehaviorTracking();
  }

  // طلب إذن الإشعارات
  private async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.isPermissionGranted = permission === 'granted';
      
      if (this.isPermissionGranted) {
        console.log('✅ تم منح إذن الإشعارات');
      } else {
        console.warn('⚠️ لم يتم منح إذن الإشعارات');
      }
    }
  }

  // إعداد مستمعي الأحداث
  private setupEventListeners() {
    // إشعارات WebSocket
    this.wsService.onMessage('balance_update', (data) => {
      this.handleBalanceUpdate(data);
    });

    this.wsService.onMessage('gift_received', (data) => {
      this.handleGiftReceived(data);
    });

    this.wsService.onMessage('new_private_message', (data) => {
      this.handleNewMessage(data);
    });

    this.wsService.onMessage('friend_request', (data) => {
      this.handleFriendRequest(data);
    });

    this.wsService.onMessage('achievement_unlocked', (data) => {
      this.handleAchievement(data);
    });

    // تتبع نشاط المستخدم
    document.addEventListener('click', () => this.trackUserActivity());
    document.addEventListener('keypress', () => this.trackUserActivity());
    window.addEventListener('focus', () => this.trackUserActivity());
  }

  // معالجة تحديث الرصيد
  private handleBalanceUpdate(data: any) {
    if (!this.preferences.balanceChanges) return;

    const isSignificant = Math.abs(data.change) >= 1000;
    const priority = isSignificant ? 'high' : 'medium';
    
    const notification: SmartNotification = {
      id: `balance_${Date.now()}`,
      type: 'balance_update',
      title: data.change > 0 ? '💰 ربح رائع!' : '💸 تغيير في الرصيد',
      message: `${data.change > 0 ? '+' : ''}${data.change} عملة ذهبية`,
      priority: priority,
      category: 'financial',
      data: data,
      isPersonalized: true,
      behaviorScore: this.calculateBehaviorScore('balance', data)
    };

    this.queueNotification(notification);
  }

  // معالجة استلام هدية
  private handleGiftReceived(data: any) {
    if (!this.preferences.gifts) return;

    const notification: SmartNotification = {
      id: `gift_${Date.now()}`,
      type: 'gift_received',
      title: '🎁 هدية جديدة!',
      message: `استلمت ${data.gift.amount} ${data.gift.giftType === 'gold' ? 'عملة ذهبية' : 'لؤلؤة'} من ${data.gift.sender.username}`,
      priority: 'high',
      category: 'social',
      data: data,
      isPersonalized: true,
      behaviorScore: this.calculateBehaviorScore('gift', data)
    };

    this.queueNotification(notification);
  }

  // معالجة رسالة جديدة
  private handleNewMessage(data: any) {
    if (!this.preferences.messages) return;

    // تخصيص الإشعار حسب العلاقة مع المرسل
    const isFromFriend = this.checkIfFriend(data.sender.id);
    const priority = isFromFriend ? 'high' : 'medium';

    const notification: SmartNotification = {
      id: `message_${Date.now()}`,
      type: 'new_message',
      title: `💬 رسالة من ${data.sender.username}`,
      message: data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content,
      priority: priority,
      category: 'social',
      data: data,
      isPersonalized: true,
      behaviorScore: this.calculateBehaviorScore('message', data)
    };

    this.queueNotification(notification);
  }

  // معالجة طلب صداقة
  private handleFriendRequest(data: any) {
    if (!this.preferences.friendRequests) return;

    const notification: SmartNotification = {
      id: `friend_${Date.now()}`,
      type: 'friend_request',
      title: '🤝 طلب صداقة جديد',
      message: `${data.requester.username} أرسل لك طلب صداقة`,
      priority: 'medium',
      category: 'social',
      data: data,
      isPersonalized: false,
      behaviorScore: 0.8
    };

    this.queueNotification(notification);
  }

  // معالجة إنجاز جديد
  private handleAchievement(data: any) {
    if (!this.preferences.achievements) return;

    const notification: SmartNotification = {
      id: `achievement_${Date.now()}`,
      type: 'achievement',
      title: '🏆 إنجاز جديد!',
      message: `تم فتح: ${data.achievement.name}`,
      priority: 'high',
      category: 'achievement',
      data: data,
      isPersonalized: true,
      behaviorScore: 1.0
    };

    this.queueNotification(notification);
  }

  // إضافة إشعار للطابور
  private queueNotification(notification: SmartNotification) {
    // فحص الوقت المناسب للإرسال
    if (!this.isOptimalTime()) {
      notification.scheduledFor = this.getNextOptimalTime();
    }

    // فحص عدم التكرار
    if (this.isDuplicate(notification)) {
      return;
    }

    this.notificationQueue.push(notification);
    this.processNotificationQueue();
  }

  // معالجة طابور الإشعارات
  private processNotificationQueue() {
    const now = new Date();
    
    this.notificationQueue = this.notificationQueue.filter(notification => {
      // فحص انتهاء الصلاحية
      if (notification.expiresAt && now > notification.expiresAt) {
        return false;
      }

      // فحص الوقت المجدول
      if (notification.scheduledFor && now < notification.scheduledFor) {
        return true; // الاحتفاظ في الطابور
      }

      // إرسال الإشعار
      this.sendNotification(notification);
      return false; // إزالة من الطابور
    });
  }

  // إرسال الإشعار
  private sendNotification(notification: SmartNotification) {
    // إشعار سطح المكتب
    if (this.preferences.desktop && this.isPermissionGranted) {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: notification.type,
        requireInteraction: notification.priority === 'urgent'
      });

      desktopNotification.onclick = () => {
        this.handleNotificationClick(notification);
        desktopNotification.close();
      };

      // إغلاق تلقائي حسب الأولوية
      const autoCloseTime = this.getAutoCloseTime(notification.priority);
      setTimeout(() => desktopNotification.close(), autoCloseTime);
    }

    // صوت الإشعار
    if (this.preferences.sound) {
      this.playNotificationSound(notification.priority);
    }

    // اهتزاز (للأجهزة المحمولة)
    if (this.preferences.vibration && 'vibrate' in navigator) {
      const pattern = this.getVibrationPattern(notification.priority);
      navigator.vibrate(pattern);
    }

    // إشعار داخل التطبيق
    this.showInAppNotification(notification);

    // تسجيل الإشعار
    this.logNotification(notification);
  }

  // عرض إشعار داخل التطبيق
  private showInAppNotification(notification: SmartNotification) {
    const event = new CustomEvent('showNotification', {
      detail: notification
    });
    window.dispatchEvent(event);
  }

  // تشغيل صوت الإشعار
  private playNotificationSound(priority: string) {
    const audio = new Audio();
    
    switch (priority) {
      case 'urgent':
        audio.src = '/sounds/urgent.mp3';
        break;
      case 'high':
        audio.src = '/sounds/high.mp3';
        break;
      default:
        audio.src = '/sounds/default.mp3';
    }
    
    audio.volume = 0.5;
    audio.play().catch(console.error);
  }

  // حساب نقاط السلوك
  private calculateBehaviorScore(type: string, data: any): number {
    return this.behaviorAnalyzer.calculateScore(type, data, this.userBehavior);
  }

  // فحص الوقت الأمثل
  private isOptimalTime(): boolean {
    const hour = new Date().getHours();
    return this.userBehavior.activeHours.includes(hour);
  }

  // الحصول على الوقت الأمثل التالي
  private getNextOptimalTime(): Date {
    const now = new Date();
    const currentHour = now.getHours();
    
    // البحث عن أقرب ساعة نشطة
    for (let i = 1; i <= 24; i++) {
      const nextHour = (currentHour + i) % 24;
      if (this.userBehavior.activeHours.includes(nextHour)) {
        const nextTime = new Date(now);
        nextTime.setHours(nextHour, 0, 0, 0);
        if (nextTime <= now) {
          nextTime.setDate(nextTime.getDate() + 1);
        }
        return nextTime;
      }
    }
    
    // افتراضي: بعد ساعة
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // فحص التكرار
  private isDuplicate(notification: SmartNotification): boolean {
    const recent = this.notificationQueue.filter(n => 
      n.type === notification.type && 
      Date.now() - new Date(n.id.split('_')[1]).getTime() < 60000 // آخر دقيقة
    );
    
    return recent.length > 0;
  }

  // معالجة النقر على الإشعار
  private handleNotificationClick(notification: SmartNotification) {
    // تسجيل التفاعل
    this.behaviorAnalyzer.recordInteraction(notification.type, true);
    
    // توجيه المستخدم حسب نوع الإشعار
    switch (notification.type) {
      case 'new_message':
        window.location.hash = '#/messages';
        break;
      case 'friend_request':
        window.location.hash = '#/friends';
        break;
      case 'gift_received':
        window.location.hash = '#/gifts';
        break;
      default:
        window.focus();
    }
  }

  // تتبع نشاط المستخدم
  private trackUserActivity() {
    this.userBehavior.lastActiveTime = new Date();
    this.behaviorAnalyzer.recordActivity();
  }

  // بدء تتبع السلوك
  private startBehaviorTracking() {
    setInterval(() => {
      this.behaviorAnalyzer.updateBehavior(this.userBehavior);
      this.saveUserBehavior();
    }, 5 * 60 * 1000); // كل 5 دقائق
  }

  // تحميل التفضيلات
  private loadPreferences() {
    const saved = localStorage.getItem('notificationPreferences');
    this.preferences = saved ? JSON.parse(saved) : {
      gameWins: true,
      gameLosses: false,
      gifts: true,
      messages: true,
      friendRequests: true,
      systemUpdates: true,
      balanceChanges: true,
      achievements: true,
      sound: true,
      vibration: true,
      desktop: true
    };
  }

  // حفظ التفضيلات
  public savePreferences() {
    localStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
  }

  // تحميل سلوك المستخدم
  private loadUserBehavior() {
    const saved = localStorage.getItem('userBehavior');
    this.userBehavior = saved ? JSON.parse(saved) : {
      activeHours: [9, 10, 11, 14, 15, 16, 19, 20, 21],
      preferredGameTypes: [],
      averageSessionDuration: 30,
      notificationResponseRate: 0.5,
      lastActiveTime: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  // حفظ سلوك المستخدم
  private saveUserBehavior() {
    localStorage.setItem('userBehavior', JSON.stringify(this.userBehavior));
  }

  // فحص الصداقة
  private checkIfFriend(userId: string): boolean {
    // يمكن تحسين هذا بالاتصال بـ API
    const friends = JSON.parse(localStorage.getItem('friends') || '[]');
    return friends.some((friend: any) => friend.id === userId);
  }

  // الحصول على وقت الإغلاق التلقائي
  private getAutoCloseTime(priority: string): number {
    switch (priority) {
      case 'urgent': return 10000; // 10 ثوان
      case 'high': return 7000;    // 7 ثوان
      case 'medium': return 5000;  // 5 ثوان
      default: return 3000;        // 3 ثوان
    }
  }

  // الحصول على نمط الاهتزاز
  private getVibrationPattern(priority: string): number[] {
    switch (priority) {
      case 'urgent': return [200, 100, 200, 100, 200];
      case 'high': return [200, 100, 200];
      case 'medium': return [200];
      default: return [100];
    }
  }

  // تسجيل الإشعار
  private logNotification(notification: SmartNotification) {
    console.log(`📢 إشعار مرسل:`, {
      type: notification.type,
      priority: notification.priority,
      personalized: notification.isPersonalized,
      behaviorScore: notification.behaviorScore
    });
  }

  // الحصول على التفضيلات
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // تحديث التفضيلات
  public updatePreferences(newPreferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
  }

  // الحصول على إحصائيات الإشعارات
  public getStats() {
    return this.behaviorAnalyzer.getStats();
  }
}

// محلل السلوك
class BehaviorAnalyzer {
  private interactions: Map<string, { sent: number; clicked: number }> = new Map();
  private activityLog: Date[] = [];

  calculateScore(type: string, data: any, behavior: UserBehavior): number {
    let score = 0.5; // نقطة البداية

    // تحليل نوع الإشعار
    switch (type) {
      case 'balance':
        score += Math.abs(data.change) / 10000; // كلما زاد المبلغ زادت الأهمية
        break;
      case 'gift':
        score += 0.3; // الهدايا مهمة دائماً
        break;
      case 'message':
        score += 0.2; // الرسائل مهمة متوسطة
        break;
    }

    // تحليل الوقت
    const hour = new Date().getHours();
    if (behavior.activeHours.includes(hour)) {
      score += 0.2;
    }

    // تحليل معدل الاستجابة
    score *= behavior.notificationResponseRate;

    return Math.min(1.0, Math.max(0.0, score));
  }

  recordInteraction(type: string, clicked: boolean) {
    if (!this.interactions.has(type)) {
      this.interactions.set(type, { sent: 0, clicked: 0 });
    }

    const stats = this.interactions.get(type)!;
    stats.sent++;
    if (clicked) {
      stats.clicked++;
    }
  }

  recordActivity() {
    this.activityLog.push(new Date());
    
    // الاحتفاظ بآخر 1000 نشاط فقط
    if (this.activityLog.length > 1000) {
      this.activityLog.splice(0, this.activityLog.length - 1000);
    }
  }

  updateBehavior(behavior: UserBehavior) {
    // تحديث الساعات النشطة
    const recentActivity = this.activityLog.filter(
      date => Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000 // آخر أسبوع
    );

    const hourCounts = new Array(24).fill(0);
    recentActivity.forEach(date => {
      hourCounts[date.getHours()]++;
    });

    // الساعات التي تحتوي على أكثر من 10% من النشاط
    const threshold = recentActivity.length * 0.1;
    behavior.activeHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count >= threshold)
      .map(item => item.hour);

    // تحديث معدل الاستجابة
    let totalSent = 0;
    let totalClicked = 0;
    
    for (const stats of this.interactions.values()) {
      totalSent += stats.sent;
      totalClicked += stats.clicked;
    }
    
    if (totalSent > 0) {
      behavior.notificationResponseRate = totalClicked / totalSent;
    }
  }

  getStats() {
    return {
      interactions: Object.fromEntries(this.interactions),
      totalActivity: this.activityLog.length,
      recentActivity: this.activityLog.filter(
        date => Date.now() - date.getTime() < 24 * 60 * 60 * 1000
      ).length
    };
  }
}
