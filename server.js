import { createRequire } from 'module';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
// Agora imports removed - using WebRTC instead

// تمكين require داخل بيئة ES Module
const require = createRequire(import.meta.url);

// تحميل متغيرات البيئة
require('dotenv').config();

// حساب __dirname في ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// استيراد الحزم عبر require
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000;

// WebRTC configuration
console.log('🎤 WebRTC Voice Chat initialized');

// إعداد CORS
app.use(cors({
  origin: ['https://infinitybox25.onrender.com', 'http://localhost:3000', 'http://localhost:5173', 'null'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// تطبيق middleware الأمان (سيتم تعريفه لاحقاً)
// app.use(securityMiddleware);
// app.use(sanitizeMiddleware);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// تقديم ملفات الواجهة الأمامية React
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// WebRTC test page removed

// اتصال MongoDB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('✅ Connected to MongoDB Atlas');

  // حذف فهرس inviteCode المشكل
  try {
    await User.collection.dropIndex('inviteCode_1');
    console.log('🗑️ Dropped problematic inviteCode index');
  } catch (error) {
    // الفهرس قد لا يكون موجود، هذا طبيعي
    console.log('ℹ️ inviteCode index not found or already dropped');
  }

  // حذف فهارس VoiceRoom المشكلة
  try {
    await VoiceRoom.collection.dropIndex('ownerPlayerId_1');
    console.log('🗑️ Dropped problematic ownerPlayerId index');
  } catch (error) {
    console.log('ℹ️ ownerPlayerId index not found or already dropped');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// نموذج المستخدم
const userSchema = new mongoose.Schema({
  playerId: {
    type: String,
    unique: true,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  avatar: String,
  profileImage: String,
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: 'male'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isChatBanned: {
    type: Boolean,
    default: false
  },
  voiceRoomKickExpiresAt: {
    type: Date,
    default: null
  },
  coins: {
    type: Number,
    default: 0
  },
  goldCoins: {
    type: Number,
    default: 10000
  },
  pearls: {
    type: Number,
    default: 10
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  activeSessionToken: String,
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  }
}, {
  timestamps: true
});

// توليد Player ID فريد عند الإنشاء (مرن - يبدأ من 1)
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.playerId) {
    let playerId;
    let isUnique = false;

    // البحث عن أعلى Player ID موجود
    const lastUser = await User.findOne({}, {}, { sort: { 'playerId': -1 } });
    let nextId = 1;

    if (lastUser && lastUser.playerId) {
      const lastIdNum = parseInt(lastUser.playerId);
      if (!isNaN(lastIdNum)) {
        nextId = lastIdNum + 1;
      }
    }

    // التأكد من عدم وجود Player ID مكرر
    while (!isUnique) {
      playerId = nextId.toString();
      const existing = await User.findOne({ playerId });
      if (!existing) {
        isUnique = true;
      } else {
        nextId++;
      }
    }

    this.playerId = playerId;
  }
  next();
});

const User = mongoose.model('User', userSchema);

// نموذج الأصدقاء
const friendshipSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // MongoDB ObjectId للتوافق
  requesterPlayerId: { type: String, required: true }, // Player ID الصغير
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // MongoDB ObjectId للتوافق
  recipientPlayerId: { type: String, required: true }, // Player ID الصغير
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'blocked'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date }
}, {
  timestamps: true
});

const Friendship = mongoose.model('Friendship', friendshipSchema);

// نموذج الهدايا
const giftSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  giftType: { type: String, enum: ['gold', 'pearls', 'item'], required: true },
  amount: { type: Number, required: true },
  message: { type: String },
  itemType: { type: String }, // نوع العنصر إذا كانت الهدية عنصر
  status: { type: String, enum: ['sent', 'received'], default: 'sent' }
}, {
  timestamps: true
});

const Gift = mongoose.model('Gift', giftSchema);

// نموذج المعاملات
const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['charge', 'gift_sent', 'gift_received', 'shield_purchase', 'game_win', 'game_loss', 'exchange'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['gold', 'pearls'], required: true },
  description: { type: String },
  relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// نظام مراقبة المعاملات المالية
class TransactionMonitor {
  constructor() {
    this.suspiciousActivities = new Map(); // userId -> activities[]
    this.dailyLimits = {
      gold: 100000,
      pearls: 500,
      gifts: 50000,
      games: 200000
    };
  }

  // تسجيل نشاط مشبوه
  logSuspiciousActivity(userId, activity, details) {
    if (!this.suspiciousActivities.has(userId)) {
      this.suspiciousActivities.set(userId, []);
    }

    const activities = this.suspiciousActivities.get(userId);
    activities.push({
      activity,
      details,
      timestamp: new Date(),
      severity: this.calculateSeverity(activity, details)
    });

    // الاحتفاظ بآخر 100 نشاط فقط
    if (activities.length > 100) {
      activities.splice(0, activities.length - 100);
    }

    console.warn(`⚠️ نشاط مشبوه - المستخدم: ${userId} | النشاط: ${activity} | التفاصيل:`, details);

    // إرسال تنبيه للمديرين إذا كان النشاط خطير
    if (this.calculateSeverity(activity, details) >= 8) {
      this.alertAdmins(userId, activity, details);
    }
  }

  // حساب درجة خطورة النشاط
  calculateSeverity(activity, details) {
    let severity = 1;

    switch (activity) {
      case 'rapid_transactions':
        severity = Math.min(10, Math.floor(details.count / 10));
        break;
      case 'large_amount':
        severity = Math.min(10, Math.floor(details.amount / 10000));
        break;
      case 'duplicate_session':
        severity = 7;
        break;
      case 'invalid_game_result':
        severity = 9;
        break;
      case 'balance_manipulation':
        severity = 10;
        break;
      default:
        severity = 3;
    }

    return severity;
  }

  // تنبيه المديرين
  async alertAdmins(userId, activity, details) {
    try {
      const admins = await User.find({ isAdmin: true });
      const user = await User.findById(userId);

      const alertMessage = {
        type: 'security_alert',
        data: {
          userId,
          username: user?.username || 'غير معروف',
          activity,
          details,
          timestamp: new Date().toISOString(),
          severity: this.calculateSeverity(activity, details)
        }
      };

      // إرسال للمديرين عبر WebSocket
      admins.forEach(admin => {
        broadcastToUser(admin._id.toString(), alertMessage);
      });

      console.error(`🚨 تنبيه أمني عالي - المستخدم: ${user?.username} | النشاط: ${activity}`);
    } catch (error) {
      console.error('خطأ في إرسال تنبيه المديرين:', error);
    }
  }

  // التحقق من الحدود اليومية
  async checkDailyLimits(userId, transactionType, amount) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyTransactions = await Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: today },
            type: { $in: this.getRelatedTransactionTypes(transactionType) }
          }
        },
        {
          $group: {
            _id: '$currency',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const limits = this.dailyLimits;
      let isWithinLimits = true;
      let warnings = [];

      dailyTransactions.forEach(transaction => {
        const currency = transaction._id;
        const total = transaction.totalAmount;
        const limit = limits[currency] || limits.gold;

        if (total + amount > limit) {
          isWithinLimits = false;
          warnings.push(`تجاوز الحد اليومي لـ ${currency}: ${total + amount}/${limit}`);
        }

        // تحذير عند الوصول لـ 80% من الحد
        if (total + amount > limit * 0.8) {
          warnings.push(`اقتراب من الحد اليومي لـ ${currency}: ${Math.round((total + amount) / limit * 100)}%`);
        }
      });

      return { isWithinLimits, warnings, dailyTransactions };
    } catch (error) {
      console.error('خطأ في فحص الحدود اليومية:', error);
      return { isWithinLimits: true, warnings: [], dailyTransactions: [] };
    }
  }

  // الحصول على أنواع المعاملات المرتبطة
  getRelatedTransactionTypes(transactionType) {
    const typeGroups = {
      'game_win': ['game_win', 'game_loss'],
      'game_loss': ['game_win', 'game_loss'],
      'gift_sent': ['gift_sent'],
      'gift_received': ['gift_received'],
      'charge': ['charge']
    };

    return typeGroups[transactionType] || [transactionType];
  }
}

// إنشاء مثيل من مراقب المعاملات
const transactionMonitor = new TransactionMonitor();

// نظام مراقبة الأحداث في الوقت الحقيقي
class RealTimeEventMonitor {
  constructor() {
    this.activeUsers = new Map(); // userId -> { lastActivity, sessionCount, actions }
    this.systemMetrics = {
      totalConnections: 0,
      activeTransactions: 0,
      errorCount: 0,
      lastReset: new Date()
    };

    // بدء مراقبة دورية
    this.startPeriodicMonitoring();
  }

  // تسجيل نشاط المستخدم
  logUserActivity(userId, activity, details = {}) {
    const now = new Date();

    if (!this.activeUsers.has(userId)) {
      this.activeUsers.set(userId, {
        lastActivity: now,
        sessionCount: 1,
        actions: []
      });
    }

    const userActivity = this.activeUsers.get(userId);
    userActivity.lastActivity = now;
    userActivity.actions.push({
      activity,
      details,
      timestamp: now
    });

    // الاحتفاظ بآخر 50 نشاط فقط
    if (userActivity.actions.length > 50) {
      userActivity.actions.splice(0, userActivity.actions.length - 50);
    }

    // فحص الأنشطة المشبوهة
    this.checkSuspiciousActivity(userId, activity, details);
  }

  // فحص الأنشطة المشبوهة
  checkSuspiciousActivity(userId, activity, details) {
    const userActivity = this.activeUsers.get(userId);
    if (!userActivity) return;

    const recentActions = userActivity.actions.filter(
      action => new Date() - action.timestamp < 60000 // آخر دقيقة
    );

    // فحص التكرار السريع
    const sameActivityCount = recentActions.filter(
      action => action.activity === activity
    ).length;

    if (sameActivityCount > 10) {
      transactionMonitor.logSuspiciousActivity(userId, 'rapid_actions', {
        activity,
        count: sameActivityCount,
        timeWindow: '1 minute'
      });
    }

    // فحص أنماط غير طبيعية
    if (activity === 'balance_update' && details.amount) {
      const totalAmount = recentActions
        .filter(action => action.activity === 'balance_update')
        .reduce((sum, action) => sum + Math.abs(action.details.amount || 0), 0);

      if (totalAmount > 50000) {
        transactionMonitor.logSuspiciousActivity(userId, 'large_amount_activity', {
          totalAmount,
          actionsCount: recentActions.length
        });
      }
    }
  }

  // تحديث إحصائيات النظام
  updateSystemMetrics(metric, value = 1) {
    switch (metric) {
      case 'connection':
        this.systemMetrics.totalConnections += value;
        break;
      case 'transaction':
        this.systemMetrics.activeTransactions += value;
        break;
      case 'error':
        this.systemMetrics.errorCount += value;
        break;
    }
  }

  // الحصول على إحصائيات النظام
  getSystemMetrics() {
    const now = new Date();
    const uptime = now - this.systemMetrics.lastReset;

    return {
      ...this.systemMetrics,
      activeUsers: this.activeUsers.size,
      uptime: Math.floor(uptime / 1000), // بالثواني
      timestamp: now.toISOString()
    };
  }

  // مراقبة دورية
  startPeriodicMonitoring() {
    // تنظيف البيانات القديمة كل 5 دقائق
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);

    // إرسال إحصائيات للمديرين كل دقيقة
    setInterval(() => {
      this.sendMetricsToAdmins();
    }, 60 * 1000);
  }

  // تنظيف البيانات القديمة
  cleanupOldData() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    // إزالة المستخدمين غير النشطين
    for (const [userId, userActivity] of this.activeUsers.entries()) {
      if (userActivity.lastActivity < fiveMinutesAgo) {
        this.activeUsers.delete(userId);
      }
    }

    console.log(`🧹 تنظيف البيانات - المستخدمين النشطين: ${this.activeUsers.size}`);
  }

  // إرسال إحصائيات للمديرين
  async sendMetricsToAdmins() {
    try {
      const metrics = this.getSystemMetrics();

      // إرسال فقط إذا كان هناك نشاط مهم
      if (metrics.activeUsers > 0 || metrics.errorCount > 0) {
        const admins = await User.find({ isAdmin: true });

        const metricsMessage = {
          type: 'system_metrics',
          data: metrics
        };

        admins.forEach(admin => {
          broadcastToUser(admin._id.toString(), metricsMessage);
        });
      }
    } catch (error) {
      console.error('خطأ في إرسال الإحصائيات:', error);
    }
  }
}

// إنشاء مثيل من مراقب الأحداث
const eventMonitor = new RealTimeEventMonitor();

// نظام الحماية من الهجمات
class SecurityManager {
  constructor() {
    this.rateLimits = new Map(); // IP -> { requests: [], lastReset: Date }
    this.suspiciousIPs = new Set();
    this.blockedIPs = new Set();

    // تنظيف دوري للبيانات
    setInterval(() => {
      this.cleanupRateLimits();
    }, 60 * 1000); // كل دقيقة
  }

  // فحص معدل الطلبات
  checkRateLimit(ip, endpoint, limit = 100, windowMs = 60000) {
    const now = Date.now();

    if (!this.rateLimits.has(ip)) {
      this.rateLimits.set(ip, {
        requests: [],
        lastReset: now
      });
    }

    const ipData = this.rateLimits.get(ip);

    // إزالة الطلبات القديمة
    ipData.requests = ipData.requests.filter(time => now - time < windowMs);

    // إضافة الطلب الحالي
    ipData.requests.push(now);

    // فحص تجاوز الحد
    if (ipData.requests.length > limit) {
      this.flagSuspiciousIP(ip, 'rate_limit_exceeded', {
        requests: ipData.requests.length,
        limit: limit,
        endpoint: endpoint
      });
      return false;
    }

    return true;
  }

  // تسجيل IP مشبوه
  flagSuspiciousIP(ip, reason, details) {
    this.suspiciousIPs.add(ip);

    console.warn(`⚠️ IP مشبوه: ${ip} | السبب: ${reason}`, details);

    // حظر تلقائي بعد عدة مخالفات
    const violations = this.countViolations(ip);
    if (violations >= 5) {
      this.blockIP(ip, reason);
    }
  }

  // حظر IP
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    console.error(`🚫 تم حظر IP: ${ip} | السبب: ${reason}`);

    // إزالة الحظر بعد ساعة
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      console.log(`✅ تم رفع الحظر عن IP: ${ip}`);
    }, 60 * 60 * 1000);
  }

  // عد المخالفات
  countViolations(ip) {
    // يمكن تحسين هذا بحفظ المخالفات في قاعدة البيانات
    return this.suspiciousIPs.has(ip) ? 1 : 0;
  }

  // تنظيف بيانات معدل الطلبات
  cleanupRateLimits() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [ip, data] of this.rateLimits.entries()) {
      if (data.lastReset < oneHourAgo) {
        this.rateLimits.delete(ip);
      }
    }
  }

  // فحص IP محظور
  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  // فحص محتوى مشبوه
  checkSuspiciousContent(content) {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
      /alert\s*\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  // تنظيف المحتوى
  sanitizeContent(content) {
    if (typeof content !== 'string') return content;

    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
}

// إنشاء مثيل من مدير الأمان
const securityManager = new SecurityManager();

// نظام النسخ الاحتياطي التلقائي
class AutoBackupSystem {
  constructor() {
    this.backupInterval = 6 * 60 * 60 * 1000; // كل 6 ساعات
    this.maxBackups = 24; // الاحتفاظ بـ 24 نسخة (4 أيام)
    this.backupPath = path.join(__dirname, 'backups');
    this.criticalCollections = ['users', 'transactions', 'gifts', 'gamestats'];

    this.initializeBackupSystem();
  }

  // تهيئة نظام النسخ الاحتياطي
  async initializeBackupSystem() {
    try {
      // إنشاء مجلد النسخ الاحتياطية
      if (!require('fs').existsSync(this.backupPath)) {
        require('fs').mkdirSync(this.backupPath, { recursive: true });
      }

      // بدء النسخ الاحتياطي الدوري
      this.startPeriodicBackup();

      console.log('✅ نظام النسخ الاحتياطي جاهز');
    } catch (error) {
      console.error('❌ خطأ في تهيئة نظام النسخ الاحتياطي:', error);
    }
  }

  // بدء النسخ الاحتياطي الدوري
  startPeriodicBackup() {
    // نسخة احتياطية فورية عند البدء
    setTimeout(() => {
      this.createFullBackup();
    }, 30000); // بعد 30 ثانية من البدء

    // نسخ احتياطية دورية
    setInterval(() => {
      this.createFullBackup();
    }, this.backupInterval);

    // تنظيف النسخ القديمة يومياً
    setInterval(() => {
      this.cleanupOldBackups();
    }, 24 * 60 * 60 * 1000);
  }

  // إنشاء نسخة احتياطية كاملة
  async createFullBackup() {
    const backupId = `backup_${Date.now()}`;
    const backupDir = path.join(this.backupPath, backupId);

    try {
      require('fs').mkdirSync(backupDir, { recursive: true });

      console.log(`🔄 بدء النسخ الاحتياطي: ${backupId}`);

      const backupResults = {};

      // نسخ احتياطي للمجموعات الحرجة
      for (const collection of this.criticalCollections) {
        try {
          const result = await this.backupCollection(collection, backupDir);
          backupResults[collection] = result;
        } catch (error) {
          console.error(`❌ خطأ في نسخ ${collection}:`, error);
          backupResults[collection] = { error: error.message };
        }
      }

      // حفظ معلومات النسخة الاحتياطية
      const backupInfo = {
        id: backupId,
        timestamp: new Date().toISOString(),
        collections: backupResults,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };

      require('fs').writeFileSync(
        path.join(backupDir, 'backup_info.json'),
        JSON.stringify(backupInfo, null, 2)
      );

      console.log(`✅ تم إنشاء النسخة الاحتياطية: ${backupId}`);

      // إرسال تقرير للمديرين
      this.notifyAdminsBackupComplete(backupInfo);

      return backupInfo;
    } catch (error) {
      console.error(`❌ فشل في إنشاء النسخة الاحتياطية ${backupId}:`, error);
      throw error;
    }
  }

  // نسخ احتياطي لمجموعة واحدة
  async backupCollection(collectionName, backupDir) {
    try {
      let Model;
      switch (collectionName) {
        case 'users':
          Model = User;
          break;
        case 'transactions':
          Model = Transaction;
          break;
        case 'gifts':
          Model = Gift;
          break;
        case 'gamestats':
          Model = GameStats;
          break;
        default:
          throw new Error(`مجموعة غير معروفة: ${collectionName}`);
      }

      const documents = await Model.find({}).lean();
      const filePath = path.join(backupDir, `${collectionName}.json`);

      require('fs').writeFileSync(filePath, JSON.stringify(documents, null, 2));

      return {
        success: true,
        count: documents.length,
        size: require('fs').statSync(filePath).size,
        path: filePath
      };
    } catch (error) {
      throw new Error(`فشل في نسخ ${collectionName}: ${error.message}`);
    }
  }

  // تنظيف النسخ القديمة
  async cleanupOldBackups() {
    try {
      const backupDirs = require('fs').readdirSync(this.backupPath)
        .filter(dir => dir.startsWith('backup_'))
        .map(dir => ({
          name: dir,
          path: path.join(this.backupPath, dir),
          timestamp: parseInt(dir.split('_')[1])
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // حذف النسخ الزائدة
      if (backupDirs.length > this.maxBackups) {
        const toDelete = backupDirs.slice(this.maxBackups);

        for (const backup of toDelete) {
          require('fs').rmSync(backup.path, { recursive: true, force: true });
          console.log(`🗑️ تم حذف النسخة الاحتياطية القديمة: ${backup.name}`);
        }
      }

      console.log(`🧹 تنظيف النسخ الاحتياطية - المتبقي: ${Math.min(backupDirs.length, this.maxBackups)}`);
    } catch (error) {
      console.error('❌ خطأ في تنظيف النسخ الاحتياطية:', error);
    }
  }

  // استعادة من نسخة احتياطية
  async restoreFromBackup(backupId) {
    const backupDir = path.join(this.backupPath, backupId);

    try {
      if (!require('fs').existsSync(backupDir)) {
        throw new Error(`النسخة الاحتياطية غير موجودة: ${backupId}`);
      }

      const backupInfoPath = path.join(backupDir, 'backup_info.json');
      const backupInfo = JSON.parse(require('fs').readFileSync(backupInfoPath, 'utf8'));

      console.log(`🔄 بدء الاستعادة من: ${backupId}`);

      const restoreResults = {};

      // استعادة كل مجموعة
      for (const collection of this.criticalCollections) {
        try {
          const result = await this.restoreCollection(collection, backupDir);
          restoreResults[collection] = result;
        } catch (error) {
          console.error(`❌ خطأ في استعادة ${collection}:`, error);
          restoreResults[collection] = { error: error.message };
        }
      }

      console.log(`✅ تمت الاستعادة من: ${backupId}`);
      return { backupInfo, restoreResults };
    } catch (error) {
      console.error(`❌ فشل في الاستعادة من ${backupId}:`, error);
      throw error;
    }
  }

  // استعادة مجموعة واحدة
  async restoreCollection(collectionName, backupDir) {
    try {
      let Model;
      switch (collectionName) {
        case 'users':
          Model = User;
          break;
        case 'transactions':
          Model = Transaction;
          break;
        case 'gifts':
          Model = Gift;
          break;
        case 'gamestats':
          Model = GameStats;
          break;
        default:
          throw new Error(`مجموعة غير معروفة: ${collectionName}`);
      }

      const filePath = path.join(backupDir, `${collectionName}.json`);
      const documents = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));

      // حذف البيانات الحالية (احتياط)
      await Model.deleteMany({});

      // إدراج البيانات المستعادة
      await Model.insertMany(documents);

      return {
        success: true,
        restored: documents.length
      };
    } catch (error) {
      throw new Error(`فشل في استعادة ${collectionName}: ${error.message}`);
    }
  }

  // إشعار المديرين بإتمام النسخ الاحتياطي
  async notifyAdminsBackupComplete(backupInfo) {
    try {
      const admins = await User.find({ isAdmin: true });

      const message = {
        type: 'backup_complete',
        data: {
          backupId: backupInfo.id,
          timestamp: backupInfo.timestamp,
          collections: Object.keys(backupInfo.collections),
          success: Object.values(backupInfo.collections).every(r => r.success)
        }
      };

      admins.forEach(admin => {
        broadcastToUser(admin._id.toString(), message);
      });
    } catch (error) {
      console.error('خطأ في إشعار المديرين:', error);
    }
  }

  // الحصول على قائمة النسخ الاحتياطية
  getBackupsList() {
    try {
      return require('fs').readdirSync(this.backupPath)
        .filter(dir => dir.startsWith('backup_'))
        .map(dir => {
          const backupInfoPath = path.join(this.backupPath, dir, 'backup_info.json');
          if (require('fs').existsSync(backupInfoPath)) {
            return JSON.parse(require('fs').readFileSync(backupInfoPath, 'utf8'));
          }
          return null;
        })
        .filter(info => info !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('خطأ في جلب قائمة النسخ الاحتياطية:', error);
      return [];
    }
  }
}

// إنشاء مثيل من نظام النسخ الاحتياطي
const backupSystem = new AutoBackupSystem();

// نظام الكاش الذكي
class SmartCacheSystem {
  constructor() {
    this.cache = new Map();
    this.accessCount = new Map();
    this.lastAccess = new Map();
    this.maxSize = 1000; // حد أقصى 1000 عنصر
    this.ttl = 5 * 60 * 1000; // 5 دقائق افتراضي
    this.hitCount = 0;
    this.missCount = 0;

    // تنظيف دوري
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // كل دقيقة
  }

  // إضافة عنصر للكاش
  set(key, value, customTTL = null) {
    const ttl = customTTL || this.ttl;
    const expiresAt = Date.now() + ttl;

    // إزالة عنصر قديم إذا تجاوز الحد الأقصى
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    this.accessCount.set(key, 0);
    this.lastAccess.set(key, Date.now());

    console.log(`📦 تم حفظ في الكاش: ${key}`);
  }

  // جلب عنصر من الكاش
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      console.log(`❌ كاش miss: ${key}`);
      return null;
    }

    // فحص انتهاء الصلاحية
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      this.missCount++;
      console.log(`⏰ انتهت صلاحية الكاش: ${key}`);
      return null;
    }

    // تحديث إحصائيات الوصول
    this.hitCount++;
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    this.lastAccess.set(key, Date.now());

    console.log(`✅ كاش hit: ${key}`);
    return item.value;
  }

  // حذف عنصر من الكاش
  delete(key) {
    this.cache.delete(key);
    this.accessCount.delete(key);
    this.lastAccess.delete(key);
  }

  // إزالة العنصر الأقل استخداماً
  evictLeastUsed() {
    let leastUsedKey = null;
    let leastUsedCount = Infinity;
    let oldestAccess = Infinity;

    for (const [key, count] of this.accessCount.entries()) {
      const lastAccessTime = this.lastAccess.get(key) || 0;

      if (count < leastUsedCount || (count === leastUsedCount && lastAccessTime < oldestAccess)) {
        leastUsedKey = key;
        leastUsedCount = count;
        oldestAccess = lastAccessTime;
      }
    }

    if (leastUsedKey) {
      this.delete(leastUsedKey);
      console.log(`🗑️ تم إزالة من الكاش (أقل استخداماً): ${leastUsedKey}`);
    }
  }

  // تنظيف العناصر المنتهية الصلاحية
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 تم تنظيف ${cleanedCount} عنصر منتهي الصلاحية من الكاش`);
    }
  }

  // مسح الكاش بالكامل
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessCount.clear();
    this.lastAccess.clear();
    console.log(`🗑️ تم مسح الكاش بالكامل (${size} عنصر)`);
  }

  // إحصائيات الكاش
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate}%`,
      totalRequests: totalRequests
    };
  }

  // كاش ذكي للمستخدمين
  async cacheUser(userId) {
    const cacheKey = `user:${userId}`;
    let user = this.get(cacheKey);

    if (!user) {
      user = await User.findById(userId).lean();
      if (user) {
        this.set(cacheKey, user, 10 * 60 * 1000); // 10 دقائق للمستخدمين
      }
    }

    return user;
  }

  // كاش للمعاملات الحديثة
  async cacheRecentTransactions(userId, limit = 10) {
    const cacheKey = `transactions:${userId}:${limit}`;
    let transactions = this.get(cacheKey);

    if (!transactions) {
      transactions = await Transaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      if (transactions) {
        this.set(cacheKey, transactions, 2 * 60 * 1000); // دقيقتان للمعاملات
      }
    }

    return transactions;
  }

  // كاش لإحصائيات الألعاب
  async cacheGameStats(userId) {
    const cacheKey = `gamestats:${userId}`;
    let stats = this.get(cacheKey);

    if (!stats) {
      stats = await GameStats.find({ userId })
        .sort({ startTime: -1 })
        .limit(50)
        .lean();

      if (stats) {
        this.set(cacheKey, stats, 5 * 60 * 1000); // 5 دقائق للإحصائيات
      }
    }

    return stats;
  }

  // إبطال كاش المستخدم عند التحديث
  invalidateUserCache(userId) {
    const patterns = [`user:${userId}`, `transactions:${userId}`, `gamestats:${userId}`];

    for (const [key] of this.cache.entries()) {
      if (patterns.some(pattern => key.startsWith(pattern))) {
        this.delete(key);
      }
    }

    console.log(`🔄 تم إبطال كاش المستخدم: ${userId}`);
  }

  // كاش للبيانات العامة
  async cacheSystemData(key, fetchFunction, ttl = 5 * 60 * 1000) {
    let data = this.get(key);

    if (!data) {
      data = await fetchFunction();
      if (data) {
        this.set(key, data, ttl);
      }
    }

    return data;
  }
}

// إنشاء مثيل من نظام الكاش
const smartCache = new SmartCacheSystem();

// نظام التحليلات المتقدمة
class AdvancedAnalyticsSystem {
  constructor() {
    this.metrics = new Map();
    this.userSessions = new Map();
    this.gameAnalytics = new Map();
    this.financialMetrics = new Map();
    this.realTimeData = {
      activeUsers: 0,
      onlineUsers: new Set(),
      currentTransactions: 0,
      systemLoad: 0
    };

    this.startRealTimeTracking();
  }

  // بدء التتبع في الوقت الحقيقي
  startRealTimeTracking() {
    // تحديث الإحصائيات كل 30 ثانية
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 30 * 1000);

    // حفظ التحليلات كل 5 دقائق
    setInterval(() => {
      this.saveAnalytics();
    }, 5 * 60 * 1000);

    // تنظيف البيانات القديمة يومياً
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  // تسجيل حدث
  trackEvent(category, action, label = '', value = 0, userId = null) {
    const event = {
      category,
      action,
      label,
      value,
      userId,
      timestamp: new Date(),
      sessionId: this.getSessionId(userId)
    };

    // إضافة للمقاييس العامة
    const key = `${category}:${action}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalValue: 0,
        uniqueUsers: new Set(),
        hourlyData: new Array(24).fill(0),
        dailyData: new Array(7).fill(0)
      });
    }

    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalValue += value;

    if (userId) {
      metric.uniqueUsers.add(userId);
    }

    // تحديث البيانات الزمنية
    const hour = event.timestamp.getHours();
    const day = event.timestamp.getDay();
    metric.hourlyData[hour]++;
    metric.dailyData[day]++;

    // تحليل خاص حسب الفئة
    switch (category) {
      case 'game':
        this.trackGameEvent(action, label, value, userId);
        break;
      case 'financial':
        this.trackFinancialEvent(action, label, value, userId);
        break;
      case 'user':
        this.trackUserEvent(action, label, value, userId);
        break;
    }

    console.log(`📊 تم تسجيل حدث: ${category}/${action} | المستخدم: ${userId || 'غير محدد'}`);
  }

  // تتبع أحداث الألعاب
  trackGameEvent(action, gameType, value, userId) {
    if (!this.gameAnalytics.has(gameType)) {
      this.gameAnalytics.set(gameType, {
        totalPlays: 0,
        totalWins: 0,
        totalLosses: 0,
        totalWinAmount: 0,
        totalLossAmount: 0,
        averageSessionTime: 0,
        uniquePlayers: new Set(),
        popularityScore: 0
      });
    }

    const gameData = this.gameAnalytics.get(gameType);

    switch (action) {
      case 'game_start':
        gameData.totalPlays++;
        if (userId) gameData.uniquePlayers.add(userId);
        break;
      case 'game_win':
        gameData.totalWins++;
        gameData.totalWinAmount += value;
        break;
      case 'game_loss':
        gameData.totalLosses++;
        gameData.totalLossAmount += value;
        break;
    }

    // حساب نقاط الشعبية
    gameData.popularityScore = this.calculatePopularityScore(gameData);
  }

  // تتبع الأحداث المالية
  trackFinancialEvent(action, currency, amount, userId) {
    if (!this.financialMetrics.has(currency)) {
      this.financialMetrics.set(currency, {
        totalTransactions: 0,
        totalVolume: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        averageTransaction: 0,
        uniqueUsers: new Set()
      });
    }

    const finData = this.financialMetrics.get(currency);
    finData.totalTransactions++;
    finData.totalVolume += Math.abs(amount);

    if (userId) finData.uniqueUsers.add(userId);

    switch (action) {
      case 'deposit':
      case 'gift_received':
      case 'game_win':
        finData.totalDeposits += amount;
        break;
      case 'withdrawal':
      case 'gift_sent':
      case 'game_loss':
        finData.totalWithdrawals += Math.abs(amount);
        break;
    }

    finData.averageTransaction = finData.totalVolume / finData.totalTransactions;
  }

  // تتبع أحداث المستخدمين
  trackUserEvent(action, label, value, userId) {
    if (!userId) return;

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        sessionStart: new Date(),
        totalSessions: 0,
        totalTime: 0,
        actions: [],
        preferences: {},
        behavior: {
          mostActiveHour: 0,
          favoriteGame: '',
          averageSessionLength: 0,
          engagementScore: 0
        }
      });
    }

    const userSession = this.userSessions.get(userId);

    switch (action) {
      case 'login':
        userSession.sessionStart = new Date();
        userSession.totalSessions++;
        this.realTimeData.onlineUsers.add(userId);
        break;
      case 'logout':
        const sessionTime = Date.now() - userSession.sessionStart.getTime();
        userSession.totalTime += sessionTime;
        userSession.averageSessionLength = userSession.totalTime / userSession.totalSessions;
        this.realTimeData.onlineUsers.delete(userId);
        break;
      case 'page_view':
        userSession.actions.push({ action: 'page_view', page: label, timestamp: new Date() });
        break;
    }

    // حساب نقاط المشاركة
    userSession.behavior.engagementScore = this.calculateEngagementScore(userSession);
  }

  // حساب نقاط الشعبية للألعاب
  calculatePopularityScore(gameData) {
    const playRate = gameData.totalPlays / Math.max(1, gameData.uniquePlayers.size);
    const winRate = gameData.totalWins / Math.max(1, gameData.totalPlays);
    const profitability = (gameData.totalWinAmount - gameData.totalLossAmount) / Math.max(1, gameData.totalPlays);

    return (playRate * 0.4 + winRate * 0.3 + Math.max(0, profitability / 1000) * 0.3) * 100;
  }

  // حساب نقاط المشاركة
  calculateEngagementScore(userSession) {
    const sessionFrequency = userSession.totalSessions / 30; // متوسط الجلسات في الشهر
    const sessionLength = userSession.averageSessionLength / (60 * 1000); // بالدقائق
    const activityLevel = userSession.actions.length / Math.max(1, userSession.totalSessions);

    return Math.min(100, (sessionFrequency * 20 + Math.min(sessionLength, 60) + activityLevel * 10));
  }

  // تحديث المقاييس في الوقت الحقيقي
  async updateRealTimeMetrics() {
    try {
      // عدد المستخدمين النشطين
      this.realTimeData.activeUsers = this.realTimeData.onlineUsers.size;

      // عدد المعاملات الحالية
      const recentTransactions = await Transaction.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // آخر 5 دقائق
      });
      this.realTimeData.currentTransactions = recentTransactions;

      // حمولة النظام
      const memoryUsage = process.memoryUsage();
      this.realTimeData.systemLoad = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      // إرسال للمديرين
      this.broadcastRealTimeData();
    } catch (error) {
      console.error('خطأ في تحديث المقاييس:', error);
    }
  }

  // إرسال البيانات الفورية للمديرين
  async broadcastRealTimeData() {
    try {
      const admins = await User.find({ isAdmin: true });

      const data = {
        type: 'real_time_analytics',
        data: {
          ...this.realTimeData,
          onlineUsers: Array.from(this.realTimeData.onlineUsers),
          timestamp: new Date().toISOString()
        }
      };

      admins.forEach(admin => {
        broadcastToUser(admin._id.toString(), data);
      });
    } catch (error) {
      console.error('خطأ في إرسال البيانات الفورية:', error);
    }
  }

  // حفظ التحليلات
  async saveAnalytics() {
    try {
      const analyticsData = {
        timestamp: new Date(),
        metrics: Object.fromEntries(
          Array.from(this.metrics.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              uniqueUsers: value.uniqueUsers.size
            }
          ])
        ),
        gameAnalytics: Object.fromEntries(
          Array.from(this.gameAnalytics.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              uniquePlayers: value.uniquePlayers.size
            }
          ])
        ),
        financialMetrics: Object.fromEntries(
          Array.from(this.financialMetrics.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              uniqueUsers: value.uniqueUsers.size
            }
          ])
        ),
        realTimeData: {
          ...this.realTimeData,
          onlineUsers: this.realTimeData.onlineUsers.size
        }
      };

      // حفظ في ملف (يمكن تحسينه بحفظ في قاعدة البيانات)
      const fs = require('fs');
      const analyticsDir = path.join(__dirname, 'analytics');

      if (!fs.existsSync(analyticsDir)) {
        fs.mkdirSync(analyticsDir, { recursive: true });
      }

      const filename = `analytics_${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(analyticsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(analyticsData, null, 2));

      console.log(`📊 تم حفظ التحليلات: ${filename}`);
    } catch (error) {
      console.error('خطأ في حفظ التحليلات:', error);
    }
  }

  // تنظيف البيانات القديمة
  cleanupOldData() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // تنظيف جلسات المستخدمين القديمة
    for (const [userId, session] of this.userSessions.entries()) {
      if (session.sessionStart.getTime() < oneWeekAgo) {
        this.userSessions.delete(userId);
      }
    }

    console.log('🧹 تم تنظيف البيانات القديمة');
  }

  // الحصول على معرف الجلسة
  getSessionId(userId) {
    if (!userId) return 'anonymous';

    const session = this.userSessions.get(userId);
    return session ? `${userId}_${session.sessionStart.getTime()}` : `${userId}_${Date.now()}`;
  }

  // الحصول على تقرير شامل
  getComprehensiveReport() {
    const report = {
      overview: {
        totalEvents: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.count, 0),
        uniqueUsers: new Set(Array.from(this.userSessions.keys())).size,
        activeUsers: this.realTimeData.activeUsers,
        systemLoad: this.realTimeData.systemLoad
      },
      games: Object.fromEntries(
        Array.from(this.gameAnalytics.entries()).map(([game, data]) => [
          game,
          {
            ...data,
            uniquePlayers: data.uniquePlayers.size,
            winRate: (data.totalWins / Math.max(1, data.totalPlays) * 100).toFixed(2) + '%',
            profitability: data.totalWinAmount - data.totalLossAmount
          }
        ])
      ),
      financial: Object.fromEntries(
        Array.from(this.financialMetrics.entries()).map(([currency, data]) => [
          currency,
          {
            ...data,
            uniqueUsers: data.uniqueUsers.size,
            netFlow: data.totalDeposits - data.totalWithdrawals
          }
        ])
      ),
      topUsers: Array.from(this.userSessions.entries())
        .map(([userId, session]) => ({
          userId,
          engagementScore: session.behavior.engagementScore,
          totalSessions: session.totalSessions,
          averageSessionLength: Math.round(session.behavior.averageSessionLength / 60000) // بالدقائق
        }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10)
    };

    return report;
  }

  // الحصول على البيانات الفورية
  getRealTimeData() {
    return {
      ...this.realTimeData,
      onlineUsers: Array.from(this.realTimeData.onlineUsers)
    };
  }
}

// إنشاء مثيل من نظام التحليلات
const analyticsSystem = new AdvancedAnalyticsSystem();

// middleware للحماية من الهجمات
const securityMiddleware = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  // فحص IP محظور
  if (securityManager.isBlocked(clientIP)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // فحص معدل الطلبات
  if (!securityManager.checkRateLimit(clientIP, req.path)) {
    return res.status(429).json({ message: 'Too many requests' });
  }

  // فحص المحتوى المشبوه في البيانات
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string' && securityManager.checkSuspiciousContent(value)) {
        securityManager.flagSuspiciousIP(clientIP, 'suspicious_content', {
          field: key,
          content: value.substring(0, 100)
        });
        return res.status(400).json({ message: 'Invalid content detected' });
      }
    }
  }

  next();
};

// middleware لتنظيف البيانات
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = securityManager.sanitizeContent(value);
      }
    }
  }
  next();
};

// نموذج الشحن المجاني
const freeChargeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chargeType: { type: String, enum: ['1_dollar', '5_dollar'], required: true },
  amount: { type: Number, required: true },
  usedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// فهرس مركب لضمان شحن مجاني واحد لكل نوع لكل مستخدم
freeChargeSchema.index({ user: 1, chargeType: 1 }, { unique: true });

const FreeCharge = mongoose.model('FreeCharge', freeChargeSchema);

// نموذج الدروع
const shieldSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['gold', 'usd'], required: true },
  isActive: { type: Boolean, default: true },
  activatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  cost: { type: Number, required: true },
  currency: { type: String, enum: ['gold', 'usd'], required: true }
}, {
  timestamps: true
});

const Shield = mongoose.model('Shield', shieldSchema);

// نموذج الإشعارات
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // MongoDB ObjectId للتوافق
  userPlayerId: { type: String, required: true }, // Player ID الصغير
  type: { type: String, enum: ['gift_received', 'friend_request', 'friend_accepted', 'message', 'item_received'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Object }, // بيانات إضافية
  isRead: { type: Boolean, default: false },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // MongoDB ObjectId للتوافق
  fromUserPlayerId: { type: String } // Player ID الصغير
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

// نموذج الرسائل
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // MongoDB ObjectId للتوافق
  senderPlayerId: { type: String, required: true }, // Player ID الصغير
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // MongoDB ObjectId للتوافق
  recipientPlayerId: { type: String, required: true }, // Player ID الصغير
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  messageType: { type: String, enum: ['text', 'gift', 'item'], default: 'text' }
}, {
  timestamps: true
});

const Message = mongoose.model('Message', messageSchema);

// نموذج الغرفة الصوتية
const voiceRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'الغرفة الصوتية الرئيسية'
  },
  description: {
    type: String,
    default: 'غرفة صوتية للمحادثة مع الأصدقاء'
  },
  maxSeats: {
    type: Number,
    default: 5
  },
  maxUsers: {
    type: Number,
    default: 100
  },
  seats: [{
    seatNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userPlayerId: {
      type: String,
      default: null
    },
    isSpeaking: {
      type: Boolean,
      default: false
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    joinedAt: {
      type: Date,
      default: null
    }
  }],
  waitingQueue: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userPlayerId: {
      type: String,
      required: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  listeners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userPlayerId: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  textMessages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderPlayerId: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    messageType: {
      type: String,
      enum: ['text', 'system', 'mic_request'],
      default: 'text'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  settings: {
    allowTextChat: {
      type: Boolean,
      default: true
    },
    autoKickInactive: {
      type: Boolean,
      default: true
    },
    inactiveTimeoutMinutes: {
      type: Number,
      default: 30
    }
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// إنشاء المقاعد الافتراضية عند إنشاء غرفة جديدة
voiceRoomSchema.pre('save', function(next) {
  if (this.isNew && this.seats.length === 0) {
    for (let i = 1; i <= this.maxSeats; i++) {
      this.seats.push({
        seatNumber: i,
        user: null,
        userPlayerId: null,
        isSpeaking: false,
        isMuted: false,
        joinedAt: null
      });
    }
  }
  next();
});

const VoiceRoom = mongoose.model('VoiceRoom', voiceRoomSchema);

// وظيفة إنشاء إشعار
const createNotification = async (userId, type, title, message, data = {}, fromUserId = null, userPlayerId = null) => {
  try {
    // إذا لم يتم تمرير userPlayerId، نحاول الحصول عليه من المستخدم
    if (!userPlayerId && userId) {
      const user = await User.findById(userId);
      if (user) {
        userPlayerId = user.playerId;
      }
    }

    // إذا لم يتم تمرير fromUserId، نحاول الحصول على Player ID للمرسل
    let fromUserPlayerId = null;
    if (fromUserId) {
      const fromUser = await User.findById(fromUserId);
      if (fromUser) {
        fromUserPlayerId = fromUser.playerId;
      }
    }

    const notification = new Notification({
      user: userId, // MongoDB ObjectId للتوافق
      userPlayerId: userPlayerId, // Player ID الصغير
      type,
      title,
      message,
      data,
      fromUser: fromUserId, // MongoDB ObjectId للتوافق
      fromUserPlayerId: fromUserPlayerId // Player ID الصغير
    });
    await notification.save();
    console.log(`📢 Notification created for user ${userPlayerId || userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// middleware للمصادقة مع تحسينات الأمان
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // التحقق من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'infinitybox_secret_key');

    // التحقق من وجود المستخدم في قاعدة البيانات
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    // التحقق من عدم حظر المستخدم
    if (user.isChatBanned && req.path.includes('/messages')) {
      return res.status(403).json({ message: 'You are banned from messaging' });
    }

    // تسجيل النشاط
    eventMonitor.logUserActivity(decoded.userId, 'api_request', {
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    req.user = decoded;
    req.userDoc = user; // إضافة document المستخدم للاستخدام في endpoints
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    eventMonitor.updateSystemMetrics('error', 1);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// نموذج إحصائيات الألعاب
const GameStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameType: { type: String, required: true },
  sessionId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number },
  betAmount: { type: Number, default: 0 },
  winAmount: { type: Number, default: 0 },
  lossAmount: { type: Number, default: 0 },
  netResult: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  playerScore: { type: Number, default: 0 },
  skillFactor: { type: Number, default: 0 },
  economicFactor: { type: Number, default: 0 },
  winProbability: { type: Number, default: 0 }
}, { timestamps: true });

const GameStats = mongoose.model('GameStats', GameStatsSchema);



// Routes الأساسية

// فحص صحة الخادم
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// إحصائيات النظام للمديرين
app.get('/api/admin/system-metrics', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    // جمع الإحصائيات
    const systemMetrics = eventMonitor.getSystemMetrics();

    // إحصائيات قاعدة البيانات
    const dbStats = {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      totalTransactions: await Transaction.countDocuments(),
      todayTransactions: await Transaction.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      totalGifts: await Gift.countDocuments(),
      activeVoiceRooms: await VoiceRoom.countDocuments({ isActive: true })
    };

    // إحصائيات المعاملات حسب النوع
    const transactionsByType = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // إحصائيات الألعاب
    const gameStats = await GameStats.aggregate([
      {
        $match: {
          startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$gameType',
          gamesPlayed: { $sum: 1 },
          totalWinAmount: { $sum: '$winAmount' },
          totalLossAmount: { $sum: '$lossAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      systemMetrics,
      database: dbStats,
      transactions: transactionsByType,
      games: gameStats,
      suspiciousActivities: Array.from(transactionMonitor.suspiciousActivities.entries()).map(
        ([userId, activities]) => ({
          userId,
          activitiesCount: activities.length,
          lastActivity: activities[activities.length - 1]?.timestamp
        })
      )
    });

  } catch (error) {
    console.error('خطأ في جلب إحصائيات النظام:', error);
    res.status(500).json({ message: 'خطأ في جلب الإحصائيات' });
  }
});

// تصدير بيانات المعاملات للمديرين
app.get('/api/admin/export-transactions', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { startDate, endDate, type, userId } = req.query;

    // بناء الاستعلام
    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (type) {
      query.type = type;
    }

    if (userId) {
      query.user = userId;
    }

    // جلب المعاملات مع بيانات المستخدمين
    const transactions = await Transaction.find(query)
      .populate('user', 'username playerId email')
      .populate('relatedUser', 'username playerId')
      .sort({ createdAt: -1 })
      .limit(10000); // حد أقصى 10,000 معاملة

    res.json({
      success: true,
      count: transactions.length,
      transactions: transactions.map(t => ({
        id: t._id,
        user: t.user ? {
          id: t.user._id,
          username: t.user.username,
          playerId: t.user.playerId,
          email: t.user.email
        } : null,
        relatedUser: t.relatedUser ? {
          id: t.relatedUser._id,
          username: t.relatedUser.username,
          playerId: t.relatedUser.playerId
        } : null,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في تصدير المعاملات:', error);
    res.status(500).json({ message: 'خطأ في تصدير البيانات' });
  }
});

// endpoint للتزامن مع العميل
app.get('/api/sync/data', authenticateToken, async (req, res) => {
  try {
    const { lastSync } = req.query;
    const userId = req.user.userId;

    // تحديد نقطة البداية للتزامن
    const syncPoint = lastSync ? new Date(lastSync) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // جلب البيانات المحدثة منذ آخر تزامن
    const [user, transactions, gifts, notifications] = await Promise.all([
      User.findById(userId),
      Transaction.find({
        user: userId,
        updatedAt: { $gte: syncPoint }
      }).sort({ updatedAt: -1 }).limit(100),
      Gift.find({
        $or: [
          { sender: userId },
          { recipient: userId }
        ],
        updatedAt: { $gte: syncPoint }
      }).populate('sender recipient', 'username profileImage').sort({ updatedAt: -1 }).limit(50),
      Notification.find({
        user: userId,
        updatedAt: { $gte: syncPoint }
      }).sort({ updatedAt: -1 }).limit(20)
    ]);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تجميع التحديثات
    const updates = [];

    // تحديث بيانات المستخدم
    updates.push({
      type: 'profile',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        goldCoins: user.goldCoins,
        pearls: user.pearls,
        level: user.level,
        profileImage: user.profileImage,
        gender: user.gender,
        lastActive: user.lastActive
      },
      timestamp: user.updatedAt
    });

    // تحديثات الرصيد من المعاملات
    if (transactions.length > 0) {
      updates.push({
        type: 'balance',
        data: {
          goldCoins: user.goldCoins,
          pearls: user.pearls,
          recentTransactions: transactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            currency: t.currency,
            description: t.description,
            status: t.status,
            createdAt: t.createdAt
          }))
        },
        timestamp: transactions[0].updatedAt
      });
    }

    // تحديثات الهدايا
    if (gifts.length > 0) {
      updates.push({
        type: 'gifts',
        data: gifts.map(g => ({
          id: g._id,
          sender: g.sender ? {
            id: g.sender._id,
            username: g.sender.username,
            profileImage: g.sender.profileImage
          } : null,
          recipient: g.recipient ? {
            id: g.recipient._id,
            username: g.recipient.username,
            profileImage: g.recipient.profileImage
          } : null,
          giftType: g.giftType,
          amount: g.amount,
          message: g.message,
          status: g.status,
          createdAt: g.createdAt
        })),
        timestamp: gifts[0].updatedAt
      });
    }

    // تحديثات الإشعارات
    if (notifications.length > 0) {
      updates.push({
        type: 'notifications',
        data: notifications.map(n => ({
          id: n._id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          isRead: n.isRead,
          createdAt: n.createdAt
        })),
        timestamp: notifications[0].updatedAt
      });
    }

    // تسجيل النشاط
    eventMonitor.logUserActivity(userId, 'sync_request', {
      lastSync: lastSync,
      updatesCount: updates.length
    });

    res.json({
      success: true,
      hasUpdates: updates.length > 0,
      updates: updates,
      syncTimestamp: new Date().toISOString(),
      serverTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في التزامن:', error);
    eventMonitor.updateSystemMetrics('error', 1);
    res.status(500).json({ message: 'خطأ في التزامن' });
  }
});

// فرض التزامن الفوري
app.post('/api/sync/force', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // إرسال إشارة تزامن فوري عبر WebSocket
    broadcastToUser(userId, {
      type: 'force_sync',
      data: {
        timestamp: new Date().toISOString(),
        reason: 'user_requested'
      }
    });

    // تسجيل النشاط
    eventMonitor.logUserActivity(userId, 'force_sync', {
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'تم طلب التزامن الفوري',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في فرض التزامن:', error);
    res.status(500).json({ message: 'خطأ في فرض التزامن' });
  }
});

// ========== BACKUP SYSTEM ENDPOINTS ==========

// جلب قائمة النسخ الاحتياطية (للمديرين فقط)
app.get('/api/admin/backups', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const backups = backupSystem.getBackupsList();

    res.json({
      success: true,
      backups: backups,
      totalBackups: backups.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في جلب النسخ الاحتياطية:', error);
    res.status(500).json({ message: 'خطأ في جلب النسخ الاحتياطية' });
  }
});

// إنشاء نسخة احتياطية فورية (للمديرين فقط)
app.post('/api/admin/backup/create', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    console.log(`📦 طلب نسخة احتياطية فورية من المدير: ${admin.username}`);

    const backupInfo = await backupSystem.createFullBackup();

    // تسجيل النشاط
    eventMonitor.logUserActivity(req.user.userId, 'manual_backup', {
      backupId: backupInfo.id,
      timestamp: backupInfo.timestamp
    });

    res.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      backup: backupInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
    eventMonitor.updateSystemMetrics('error', 1);
    res.status(500).json({
      message: 'خطأ في إنشاء النسخة الاحتياطية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// استعادة من نسخة احتياطية (للمديرين فقط - خطير!)
app.post('/api/admin/backup/restore', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { backupId, confirmationCode } = req.body;

    if (!backupId) {
      return res.status(400).json({ message: 'معرف النسخة الاحتياطية مطلوب' });
    }

    // رمز تأكيد إضافي للحماية
    if (confirmationCode !== 'RESTORE_CONFIRM_2024') {
      return res.status(400).json({ message: 'رمز التأكيد غير صحيح' });
    }

    console.warn(`⚠️ طلب استعادة خطير من المدير: ${admin.username} | النسخة: ${backupId}`);

    // إنشاء نسخة احتياطية قبل الاستعادة
    const preRestoreBackup = await backupSystem.createFullBackup();
    console.log(`📦 تم إنشاء نسخة احتياطية قبل الاستعادة: ${preRestoreBackup.id}`);

    const restoreResult = await backupSystem.restoreFromBackup(backupId);

    // تسجيل النشاط الحرج
    eventMonitor.logUserActivity(req.user.userId, 'system_restore', {
      backupId: backupId,
      preRestoreBackup: preRestoreBackup.id,
      timestamp: new Date().toISOString()
    });

    // إشعار جميع المديرين
    const admins = await User.find({ isAdmin: true });
    admins.forEach(adminUser => {
      broadcastToUser(adminUser._id.toString(), {
        type: 'critical_system_restore',
        data: {
          restoredBy: admin.username,
          backupId: backupId,
          timestamp: new Date().toISOString()
        }
      });
    });

    res.json({
      success: true,
      message: 'تمت الاستعادة بنجاح',
      restore: restoreResult,
      preRestoreBackup: preRestoreBackup.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ خطأ خطير في الاستعادة:', error);
    eventMonitor.updateSystemMetrics('error', 1);
    res.status(500).json({
      message: 'خطأ في الاستعادة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// إحصائيات الكاش (للمديرين فقط)
app.get('/api/admin/cache-stats', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const cacheStats = smartCache.getStats();
    const systemMetrics = eventMonitor.getSystemMetrics();

    res.json({
      success: true,
      cache: cacheStats,
      system: systemMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في جلب إحصائيات الكاش:', error);
    res.status(500).json({ message: 'خطأ في جلب الإحصائيات' });
  }
});

// مسح الكاش (للمديرين فقط)
app.post('/api/admin/cache-clear', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { target } = req.body; // 'all', 'user', 'system'

    if (target === 'all') {
      smartCache.clear();
    } else if (target === 'user' && req.body.userId) {
      smartCache.invalidateUserCache(req.body.userId);
    }

    // تسجيل النشاط
    eventMonitor.logUserActivity(req.user.userId, 'cache_clear', {
      target: target,
      targetUserId: req.body.userId
    });

    console.log(`🗑️ تم مسح الكاش بواسطة المدير: ${admin.username} | الهدف: ${target}`);

    res.json({
      success: true,
      message: 'تم مسح الكاش بنجاح',
      target: target,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في مسح الكاش:', error);
    res.status(500).json({ message: 'خطأ في مسح الكاش' });
  }
});

// ========== ANALYTICS SYSTEM ENDPOINTS ==========

// تقرير التحليلات الشامل (للمديرين فقط)
app.get('/api/admin/analytics/report', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const report = analyticsSystem.getComprehensiveReport();

    // إضافة بيانات إضافية من قاعدة البيانات
    const [totalUsers, totalTransactions, totalGifts, activeVoiceRooms] = await Promise.all([
      User.countDocuments(),
      Transaction.countDocuments(),
      Gift.countDocuments(),
      VoiceRoom.countDocuments({ isActive: true })
    ]);

    const enhancedReport = {
      ...report,
      database: {
        totalUsers,
        totalTransactions,
        totalGifts,
        activeVoiceRooms
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      report: enhancedReport,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في جلب تقرير التحليلات:', error);
    res.status(500).json({ message: 'خطأ في جلب التقرير' });
  }
});

// البيانات الفورية (للمديرين فقط)
app.get('/api/admin/analytics/realtime', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const realTimeData = analyticsSystem.getRealTimeData();
    const systemMetrics = eventMonitor.getSystemMetrics();
    const cacheStats = smartCache.getStats();

    res.json({
      success: true,
      realTime: realTimeData,
      system: systemMetrics,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في جلب البيانات الفورية:', error);
    res.status(500).json({ message: 'خطأ في جلب البيانات الفورية' });
  }
});

// تسجيل حدث مخصص
app.post('/api/analytics/track', authenticateToken, async (req, res) => {
  try {
    const { category, action, label, value } = req.body;

    if (!category || !action) {
      return res.status(400).json({ message: 'الفئة والإجراء مطلوبان' });
    }

    // تسجيل الحدث
    analyticsSystem.trackEvent(category, action, label || '', value || 0, req.user.userId);

    // تسجيل في مراقب الأحداث أيضاً
    eventMonitor.logUserActivity(req.user.userId, 'custom_event', {
      category,
      action,
      label,
      value
    });

    res.json({
      success: true,
      message: 'تم تسجيل الحدث بنجاح',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('خطأ في تسجيل الحدث:', error);
    res.status(500).json({ message: 'خطأ في تسجيل الحدث' });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'INFINITY BOX Backend API v2.0 - Working!',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users', 
      health: '/health'
    }
  });
});

// تسجيل مستخدم جديد
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'اسم المستخدم أو البريد الإلكتروني مُستخدم بالفعل' 
      });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // توليد معرف لاعب فريد (مرن - يبدأ من 1)
    let playerId;
    let isUnique = false;

    // البحث عن أعلى Player ID موجود
    const lastUser = await User.findOne({}, {}, { sort: { 'playerId': -1 } });
    let nextId = 1;

    if (lastUser && lastUser.playerId) {
      const lastIdNum = parseInt(lastUser.playerId);
      if (!isNaN(lastIdNum)) {
        nextId = lastIdNum + 1;
      }
    }

    // التأكد من عدم وجود Player ID مكرر
    while (!isUnique) {
      playerId = nextId.toString();
      const existingPlayerId = await User.findOne({ playerId });
      if (!existingPlayerId) {
        isUnique = true;
      } else {
        nextId++;
      }
    }

    // توليد كود دعوة فريد
    const inviteCode = `INV${playerId}${Date.now().toString().slice(-4)}`;

    // إنشاء المستخدم الجديد
    const newUser = new User({
      username,
      password: hashedPassword,
      email,
      playerId,
      inviteCode,
      goldCoins: 10000, // مكافأة الترحيب
      pearls: 10, // مكافأة الترحيب - 10 لؤلؤ
      level: 1,
      experience: 0,
      isAdmin: false,
      status: 'online'
    });

    await newUser.save();



    // إنشاء JWT token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username },
      process.env.JWT_SECRET || 'infinitybox_secret_key',
      { expiresIn: '24h' }
    );

    // تحديث activeSessionToken
    newUser.activeSessionToken = token;
    await newUser.save();

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      welcomeMessage: `🎉 مرحباً ${newUser.username}! لقد حصلت على مكافأة الترحيب: 10,000 عملة ذهبية و 10 لآلئ! استمتع باللعب!`,
      isNewUser: true,
      rewards: {
        goldCoins: 10000,
        pearls: 10,
        message: 'مكافأة الترحيب'
      },
      token,
      user: {
        id: newUser._id,
        playerId: newUser.playerId,
        username: newUser.username,
        email: newUser.email,
        goldCoins: newUser.goldCoins,
        pearls: newUser.pearls,
        level: newUser.level,
        isAdmin: newUser.isAdmin
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء الحساب' });
  }
});

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // البحث عن المستخدم
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ 
        message: 'المستخدم غير موجود. الرجاء التسجيل أولاً.' 
      });
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
    }

    // إنشاء JWT token جديد
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'infinitybox_secret_key',
      { expiresIn: '24h' }
    );

    // تحديث الجلسة والنشاط
    user.activeSessionToken = token;
    user.lastActive = new Date();
    user.status = 'online';
    await user.save();

    // تسجيل في نظام التحليلات
    analyticsSystem.trackEvent('user', 'login', 'success', 1, user._id.toString());

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        playerId: user.playerId,
        username: user.username,
        email: user.email,
        goldCoins: user.goldCoins,
        pearls: user.pearls,
        level: user.level,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
        gender: user.gender
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'خطأ في تسجيل الدخول' });
  }
});

// جلب بيانات المستخدم الحالي
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({
      id: user._id,
      playerId: user.playerId,
      username: user.username,
      email: user.email,
      goldCoins: user.goldCoins,
      pearls: user.pearls,
      level: user.level,
      isAdmin: user.isAdmin,
      profileImage: user.profileImage,
      gender: user.gender,
      status: user.status,
      lastActive: user.lastActive
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات المستخدم' });
  }
});

// جلب العملات الحالية للمستخدم
app.get('/api/user/currency', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('goldCoins pearls');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({
      goldCoins: user.goldCoins,
      pearls: user.pearls
    });
  } catch (error) {
    console.error('Get currency error:', error);
    res.status(500).json({ message: 'خطأ في جلب العملات' });
  }
});

// تحديث العملات للمستخدم
app.put('/api/user/currency', authenticateToken, async (req, res) => {
  try {
    const { goldCoins, pearls } = req.body;

    // التحقق من صحة البيانات
    if (typeof goldCoins !== 'number' || typeof pearls !== 'number') {
      return res.status(400).json({ message: 'قيم العملات يجب أن تكون أرقام' });
    }

    if (goldCoins < 0 || pearls < 0) {
      return res.status(400).json({ message: 'قيم العملات لا يمكن أن تكون سالبة' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        goldCoins: Math.floor(goldCoins),
        pearls: Math.floor(pearls)
      },
      { new: true }
    ).select('goldCoins pearls');

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({
      goldCoins: user.goldCoins,
      pearls: user.pearls,
      message: 'تم تحديث العملات بنجاح'
    });
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({ message: 'خطأ في تحديث العملات' });
  }
});

// جلب بيانات المستخدم الحالي (endpoint للأدمن)
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({
      id: user._id,
      playerId: user.playerId,
      username: user.username,
      email: user.email,
      goldCoins: user.goldCoins,
      pearls: user.pearls,
      level: user.level,
      isAdmin: user.isAdmin,
      profileImage: user.profileImage,
      gender: user.gender,
      status: user.status,
      lastActive: user.lastActive
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات المستخدم' });
  }
});

// تحديث الملف الشخصي للمستخدم الحالي مع ضمان التزامن
app.put('/api/profile/update', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { profileImage, gender, username, email } = req.body;

    console.log('🔄 Profile update request for user:', req.user.userId);
    console.log('📝 Update data:', {
      hasProfileImage: !!profileImage,
      gender,
      username,
      email
    });

    // التحقق من صحة البيانات
    if (username && (username.length < 3 || username.length > 20)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'اسم المستخدم يجب أن يكون بين 3-20 حرف' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    if (gender && !['male', 'female'].includes(gender)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'الجنس غير صحيح' });
    }

    // البحث عن المستخدم مع قفل للقراءة
    const user = await User.findById(req.user.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إعداد البيانات المحدثة
    const updateData = {
      lastActive: new Date()
    };

    // تحديث البيانات المرسلة فقط
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
      console.log('📸 Profile image updated');
    }

    if (gender !== undefined) {
      updateData.gender = gender;
      console.log('👤 Gender updated to:', gender);
    }

    if (username !== undefined) {
      // التحقق من عدم وجود اسم المستخدم مع مستخدم آخر
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.user.userId }
      }).session(session);

      if (existingUser) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
      }
      updateData.username = username;
      console.log('📝 Username updated to:', username);
    }

    if (email !== undefined) {
      // التحقق من عدم وجود البريد الإلكتروني مع مستخدم آخر
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user.userId }
      }).session(session);

      if (existingUser) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'البريد الإلكتروني موجود بالفعل' });
      }
      updateData.email = email;
      console.log('📧 Email updated to:', email);
    }

    // تحديث البيانات
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      {
        new: true,
        session: session,
        runValidators: true
      }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      return res.status(500).json({ message: 'فشل في تحديث الملف الشخصي' });
    }

    // تأكيد المعاملة
    await session.commitTransaction();
    console.log('✅ Profile updated successfully for user:', updatedUser.username);

    // إرسال تحديث فوري عبر WebSocket لجميع جلسات المستخدم
    broadcastToUser(req.user.userId, {
      type: 'profile_updated',
      data: {
        user: {
          id: updatedUser._id,
          playerId: updatedUser.playerId,
          username: updatedUser.username,
          email: updatedUser.email,
          goldCoins: updatedUser.goldCoins,
          pearls: updatedUser.pearls,
          level: updatedUser.level,
          isAdmin: updatedUser.isAdmin,
          profileImage: updatedUser.profileImage,
          gender: updatedUser.gender,
          status: updatedUser.status,
          lastActive: updatedUser.lastActive
        },
        timestamp: new Date().toISOString()
      }
    });

    // تحديث معلومات المستخدم في الغرف الصوتية إذا كان متصل
    const voiceRooms = await VoiceRoom.find({
      $or: [
        { 'seats.user': updatedUser._id },
        { 'listeners.user': updatedUser._id }
      ]
    });

    // إرسال تحديث للغرف الصوتية
    voiceRooms.forEach(room => {
      broadcastToAll({
        type: 'voice_room_user_updated',
        data: {
          roomId: room._id,
          user: {
            id: updatedUser._id,
            username: updatedUser.username,
            profileImage: updatedUser.profileImage,
            gender: updatedUser.gender
          },
          timestamp: new Date().toISOString()
        }
      });
    });

    // إرجاع البيانات المحدثة
    res.json({
      success: true,
      id: updatedUser._id,
      playerId: updatedUser.playerId,
      username: updatedUser.username,
      email: updatedUser.email,
      goldCoins: updatedUser.goldCoins,
      pearls: updatedUser.pearls,
      level: updatedUser.level,
      isAdmin: updatedUser.isAdmin,
      profileImage: updatedUser.profileImage,
      gender: updatedUser.gender,
      status: updatedUser.status,
      lastActive: updatedUser.lastActive,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Profile update error:', error);

    // تسجيل مفصل للخطأ
    console.error('تفاصيل خطأ البروفايل:', {
      userId: req.user.userId,
      updateData: req.body,
      error: error.message
    });

    res.status(500).json({
      message: 'خطأ في تحديث الملف الشخصي',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// جلب البيانات الكاملة للمستخدم الحالي مع الكاش
app.get('/api/profile/me', authenticateToken, async (req, res) => {
  try {
    console.log('📡 GET /api/profile/me called for user:', req.user.userId);

    // محاولة جلب من الكاش أولاً
    let user = await smartCache.cacheUser(req.user.userId);

    if (!user) {
      console.log('❌ User not found:', req.user.userId);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const fromCache = !!smartCache.get(`user:${req.user.userId}`);
    console.log('✅ User found, sending complete data for:', user.username, fromCache ? '(from cache)' : '(from DB)');

    // تسجيل النشاط
    eventMonitor.logUserActivity(req.user.userId, 'profile_access', {
      fromCache: fromCache
    });

    // إرجاع البيانات الكاملة
    res.json({
      id: user._id,
      playerId: user.playerId,
      username: user.username,
      email: user.email,
      goldCoins: user.goldCoins,
      pearls: user.pearls,
      level: user.level,
      experience: user.experience,
      isAdmin: user.isAdmin,
      role: user.role,
      profileImage: user.profileImage,
      gender: user.gender,
      status: user.status,
      lastActive: user.lastActive,
      joinedAt: user.joinedAt,
      coins: user.coins,
      points: user.points || 0,
      rank: user.rank || 'مبتدئ',
      wins: user.wins || 0,
      gamesPlayed: user.gamesPlayed || 0,
      achievements: user.achievements || 0,
      streak: user.streak || 0,
      rating: user.rating || 0,
      popularity: user.popularity || 0,
      _cached: fromCache
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    eventMonitor.updateSystemMetrics('error', 1);
    res.status(500).json({ message: 'خطأ في جلب بيانات الملف الشخصي' });
  }
});

// تحديث صورة الملف الشخصي
app.post('/api/user/update-profile-image', authenticateToken, async (req, res) => {
  try {
    const { profileImage } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.profileImage = profileImage;
    await user.save();

    res.json({
      message: 'تم تحديث الصورة الشخصية بنجاح',
      profileImage: user.profileImage
    });

  } catch (error) {
    console.error('Update profile image error:', error);
    res.status(500).json({ message: 'خطأ في تحديث الصورة' });
  }
});

// ========== ADMIN ROUTES ==========

// جلب جميع المستخدمين (للأدمن فقط)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// البحث عن مستخدم (للأدمن فقط)
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ message: 'اسم المستخدم مطلوب' });
    }

    const user = await User.findOne({ username }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ message: 'خطأ في البحث عن المستخدم' });
  }
});

// تحديث بيانات المستخدم (للأدمن فقط)
app.post('/api/users/update-user', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { username, newUsername, newPassword, newScore, newPearls } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'اسم المستخدم مطلوب' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث البيانات
    if (newUsername && newUsername !== username) {
      // التحقق من عدم وجود اسم المستخدم الجديد
      const existingUser = await User.findOne({ username: newUsername });
      if (existingUser) {
        return res.status(400).json({ message: 'اسم المستخدم الجديد موجود بالفعل' });
      }
      user.username = newUsername;
    }

    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
    }

    if (newScore !== undefined && newScore !== null && newScore !== '') {
      user.goldCoins = parseInt(newScore, 10);
    }

    if (newPearls !== undefined && newPearls !== null && newPearls !== '') {
      user.pearls = parseInt(newPearls, 10);
    }

    user.lastActive = new Date();
    await user.save();

    res.json({
      message: 'تم تحديث بيانات المستخدم بنجاح',
      user: {
        id: user._id,
        username: user.username,
        goldCoins: user.goldCoins,
        pearls: user.pearls,
        level: user.level,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'خطأ في تحديث بيانات المستخدم' });
  }
});

// ========== WEBRTC VOICE CHAT ==========
// WebRTC signaling handled via WebSocket

// Agora endpoints removed - using WebRTC instead

// All Agora endpoints removed - using WebRTC instead

// ========== VOICE ROOM ENDPOINTS ==========

// إنشاء أو جلب الغرفة الصوتية الافتراضية
const getOrCreateDefaultVoiceRoom = async () => {
  let room = await VoiceRoom.findOne({ name: 'الغرفة الصوتية الرئيسية' });

  if (!room) {
    room = new VoiceRoom({
      name: 'الغرفة الصوتية الرئيسية',
      description: 'غرفة صوتية للمحادثة مع الأصدقاء',
      maxSeats: 5,
      maxUsers: 100,
      isActive: true
    });
    await room.save();
    console.log('✅ Created default voice room');
  }

  return room;
};

// جلب بيانات الغرفة الصوتية
app.get('/api/voice-room', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // التحقق من أن المستخدم غير مطرود
    if (user && user.voiceRoomKickExpiresAt && user.voiceRoomKickExpiresAt > new Date()) {
      const timeLeft = Math.ceil((user.voiceRoomKickExpiresAt - new Date()) / (1000 * 60));
      let timeText = '';
      if (timeLeft < 60) {
        timeText = `${timeLeft} دقيقة`;
      } else if (timeLeft < 1440) {
        timeText = `${Math.floor(timeLeft / 60)} ساعة`;
      } else {
        timeText = `${Math.floor(timeLeft / 1440)} يوم`;
      }
      return res.status(403).json({
        message: `أنت مطرود من الغرفة الصوتية. الوقت المتبقي: ${timeText}`,
        isKicked: true,
        kickExpiresAt: user.voiceRoomKickExpiresAt
      });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // تحديث بيانات المقاعد مع معلومات المستخدمين
    await room.populate('seats.user', 'username profileImage playerId isChatBanned gender role isAdmin');
    await room.populate('waitingQueue.user', 'username profileImage playerId isChatBanned gender role isAdmin');

    res.json({
      id: room._id,
      name: room.name,
      description: room.description,
      maxSeats: room.maxSeats,
      seats: room.seats,
      waitingQueue: room.waitingQueue,
      settings: room.settings,
      isActive: room.isActive
    });
  } catch (error) {
    console.error('Get voice room error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات الغرفة الصوتية' });
  }
});

// الانضمام لمقعد صوتي
app.post('/api/voice-room/join-seat', authenticateToken, async (req, res) => {
  try {
    const { seatNumber } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من أن المستخدم غير مطرود
    if (user.voiceRoomKickExpiresAt && user.voiceRoomKickExpiresAt > new Date()) {
      const timeLeft = Math.ceil((user.voiceRoomKickExpiresAt - new Date()) / (1000 * 60));
      let timeText = '';
      if (timeLeft < 60) {
        timeText = `${timeLeft} دقيقة`;
      } else if (timeLeft < 1440) {
        timeText = `${Math.floor(timeLeft / 60)} ساعة`;
      } else {
        timeText = `${Math.floor(timeLeft / 1440)} يوم`;
      }
      return res.status(403).json({
        message: `أنت مطرود من الغرفة الصوتية. الوقت المتبقي: ${timeText}`
      });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // التحقق من أن المستخدم ليس في مقعد بالفعل
    const existingSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === req.user.userId
    );

    if (existingSeat) {
      return res.status(400).json({ message: 'أنت في مقعد بالفعل' });
    }

    // البحث عن المقعد المطلوب
    const targetSeat = room.seats.find(seat => seat.seatNumber === seatNumber);

    if (!targetSeat) {
      return res.status(404).json({ message: 'المقعد غير موجود' });
    }

    if (targetSeat.user) {
      return res.status(400).json({ message: 'المقعد محجوز بالفعل' });
    }

    // إضافة المستخدم للمقعد
    targetSeat.user = req.user.userId;
    targetSeat.userPlayerId = user.playerId;
    targetSeat.joinedAt = new Date();
    targetSeat.isSpeaking = false;
    targetSeat.isMuted = false;

    // إزالة المستخدم من قائمة الانتظار إذا كان موجوداً
    room.waitingQueue = room.waitingQueue.filter(
      item => item.user.toString() !== req.user.userId
    );

    await room.save();

    // إضافة رسالة نظام
    room.textMessages.push({
      sender: req.user.userId,
      senderPlayerId: user.playerId,
      content: `${user.username} انضم للمقعد ${seatNumber}`,
      messageType: 'system'
    });
    await room.save();

    res.json({
      message: `تم الانضمام للمقعد ${seatNumber} بنجاح`,
      seatNumber,
      room: {
        seats: room.seats,
        waitingQueue: room.waitingQueue
      }
    });
  } catch (error) {
    console.error('Join seat error:', error);
    res.status(500).json({ message: 'خطأ في الانضمام للمقعد' });
  }
});

// الانضمام كمستمع
app.post('/api/voice-room/join-listener', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const room = await getOrCreateDefaultVoiceRoom();

    // التحقق من عدم تجاوز الحد الأقصى للمستخدمين
    const totalUsers = room.seats.filter(seat => seat.user).length + room.listeners.length;
    if (totalUsers >= room.maxUsers) {
      return res.status(400).json({ message: 'الغرفة ممتلئة' });
    }

    // التحقق من عدم وجود المستخدم مسبقاً
    const isAlreadyListener = room.listeners.some(listener =>
      listener.user.toString() === req.user.userId
    );
    const isInSeat = room.seats.some(seat =>
      seat.user && seat.user.toString() === req.user.userId
    );

    if (isAlreadyListener || isInSeat) {
      return res.status(400).json({ message: 'أنت موجود في الغرفة بالفعل' });
    }

    // إضافة المستخدم كمستمع
    room.listeners.push({
      user: req.user.userId,
      userPlayerId: user.playerId,
      joinedAt: new Date()
    });

    await room.save();

    // إشعار جميع المستخدمين
    const connectedClients = Array.from(global.connectedClients?.values() || []);
    const voiceRoomClients = connectedClients.filter(client => client.isInVoiceRoom);

    voiceRoomClients.forEach(client => {
      if (client.socket.readyState === 1) {
        client.socket.send(JSON.stringify({
          type: 'voice_room_update',
          data: { action: 'listener_joined', userId: req.user.userId }
        }));
      }
    });

    res.json({ message: 'تم الانضمام كمستمع بنجاح' });
  } catch (error) {
    console.error('Error joining as listener:', error);
    res.status(500).json({ message: 'خطأ في الانضمام كمستمع' });
  }
});

// مغادرة الاستماع
app.post('/api/voice-room/leave-listener', authenticateToken, async (req, res) => {
  try {
    const room = await getOrCreateDefaultVoiceRoom();

    // إزالة المستخدم من قائمة المستمعين
    room.listeners = room.listeners.filter(listener =>
      listener.user.toString() !== req.user.userId
    );

    await room.save();

    // إشعار جميع المستخدمين
    const connectedClients = Array.from(global.connectedClients?.values() || []);
    const voiceRoomClients = connectedClients.filter(client => client.isInVoiceRoom);

    voiceRoomClients.forEach(client => {
      if (client.socket.readyState === 1) {
        client.socket.send(JSON.stringify({
          type: 'voice_room_update',
          data: { action: 'listener_left', userId: req.user.userId }
        }));
      }
    });

    res.json({ message: 'تم مغادرة الاستماع بنجاح' });
  } catch (error) {
    console.error('Error leaving listener:', error);
    res.status(500).json({ message: 'خطأ في مغادرة الاستماع' });
  }
});

// مغادرة المقعد الصوتي
app.post('/api/voice-room/leave-seat', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // البحث عن مقعد المستخدم
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === req.user.userId
    );

    if (!userSeat) {
      return res.status(400).json({ message: 'أنت لست في أي مقعد' });
    }

    const seatNumber = userSeat.seatNumber;

    // إفراغ المقعد
    userSeat.user = null;
    userSeat.userPlayerId = null;
    userSeat.joinedAt = null;
    userSeat.isSpeaking = false;
    userSeat.isMuted = false;

    // إضافة رسالة نظام
    room.textMessages.push({
      sender: req.user.userId,
      senderPlayerId: user.playerId,
      content: `${user.username} غادر المقعد ${seatNumber}`,
      messageType: 'system'
    });

    // إذا كان هناك أشخاص في قائمة الانتظار، نقل الأول للمقعد
    if (room.waitingQueue.length > 0) {
      const nextUser = room.waitingQueue.shift();
      const nextUserData = await User.findById(nextUser.user);

      if (nextUserData) {
        userSeat.user = nextUser.user;
        userSeat.userPlayerId = nextUser.userPlayerId;
        userSeat.joinedAt = new Date();

        // إضافة رسالة نظام للمستخدم الجديد
        room.textMessages.push({
          sender: nextUser.user,
          senderPlayerId: nextUser.userPlayerId,
          content: `${nextUserData.username} انضم للمقعد ${seatNumber} من قائمة الانتظار`,
          messageType: 'system'
        });
      }
    }

    await room.save();

    res.json({
      message: `تم مغادرة المقعد ${seatNumber} بنجاح`,
      seatNumber,
      room: {
        seats: room.seats,
        waitingQueue: room.waitingQueue
      }
    });
  } catch (error) {
    console.error('Leave seat error:', error);
    res.status(500).json({ message: 'خطأ في مغادرة المقعد' });
  }
});

// طلب الانضمام لقائمة انتظار المايك
app.post('/api/voice-room/request-mic', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من أن المستخدم غير مطرود
    if (user.voiceRoomKickExpiresAt && user.voiceRoomKickExpiresAt > new Date()) {
      const timeLeft = Math.ceil((user.voiceRoomKickExpiresAt - new Date()) / (1000 * 60));
      let timeText = '';
      if (timeLeft < 60) {
        timeText = `${timeLeft} دقيقة`;
      } else if (timeLeft < 1440) {
        timeText = `${Math.floor(timeLeft / 60)} ساعة`;
      } else {
        timeText = `${Math.floor(timeLeft / 1440)} يوم`;
      }
      return res.status(403).json({
        message: `أنت مطرود من الغرفة الصوتية. الوقت المتبقي: ${timeText}`
      });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // التحقق من أن المستخدم ليس في مقعد بالفعل
    const existingSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === req.user.userId
    );

    if (existingSeat) {
      return res.status(400).json({ message: 'أنت في مقعد بالفعل' });
    }

    // التحقق من أن المستخدم ليس في قائمة الانتظار بالفعل
    const existingRequest = room.waitingQueue.find(
      item => item.user.toString() === req.user.userId
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'أنت في قائمة الانتظار بالفعل' });
    }

    // إضافة المستخدم لقائمة الانتظار
    room.waitingQueue.push({
      user: req.user.userId,
      userPlayerId: user.playerId,
      requestedAt: new Date()
    });

    // إضافة رسالة نظام
    room.textMessages.push({
      sender: req.user.userId,
      senderPlayerId: user.playerId,
      content: `${user.username} طلب الانضمام للمحادثة الصوتية`,
      messageType: 'mic_request'
    });

    await room.save();

    res.json({
      message: 'تم إضافتك لقائمة انتظار المايك',
      queuePosition: room.waitingQueue.length,
      room: {
        seats: room.seats,
        waitingQueue: room.waitingQueue
      }
    });
  } catch (error) {
    console.error('Request mic error:', error);
    res.status(500).json({ message: 'خطأ في طلب المايك' });
  }
});

// إلغاء طلب المايك
app.post('/api/voice-room/cancel-mic-request', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // إزالة المستخدم من قائمة الانتظار
    const initialLength = room.waitingQueue.length;
    room.waitingQueue = room.waitingQueue.filter(
      item => item.user.toString() !== req.user.userId
    );

    if (room.waitingQueue.length === initialLength) {
      return res.status(400).json({ message: 'أنت لست في قائمة الانتظار' });
    }

    await room.save();

    res.json({
      message: 'تم إلغاء طلب المايك',
      room: {
        seats: room.seats,
        waitingQueue: room.waitingQueue
      }
    });
  } catch (error) {
    console.error('Cancel mic request error:', error);
    res.status(500).json({ message: 'خطأ في إلغاء طلب المايك' });
  }
});

// إرسال رسالة نصية في الغرفة الصوتية
app.post('/api/voice-room/send-message', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'محتوى الرسالة مطلوب' });
    }

    if (content.length > 500) {
      return res.status(400).json({ message: 'الرسالة طويلة جداً (الحد الأقصى 500 حرف)' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من أن المستخدم غير محظور من الكتابة
    if (user.isChatBanned) {
      return res.status(403).json({ message: 'أنت محظور من الكتابة في المحادثة' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // إضافة الرسالة
    const newMessage = {
      sender: req.user.userId,
      senderPlayerId: user.playerId,
      content: content.trim(),
      timestamp: new Date(),
      messageType: 'text'
    };

    room.textMessages.push(newMessage);

    // الاحتفاظ بآخر 100 رسالة فقط
    if (room.textMessages.length > 100) {
      room.textMessages = room.textMessages.slice(-100);
    }

    await room.save();

    // جلب الرسالة مع بيانات المرسل
    const populatedMessage = {
      _id: room.textMessages[room.textMessages.length - 1]._id,
      sender: {
        _id: user._id,
        username: user.username,
        profileImage: user.profileImage,
        playerId: user.playerId
      },
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      messageType: newMessage.messageType
    };

    res.json({
      message: 'تم إرسال الرسالة بنجاح',
      messageData: populatedMessage
    });
  } catch (error) {
    console.error('Send voice room message error:', error);
    res.status(500).json({ message: 'خطأ في إرسال الرسالة' });
  }
});

// جلب رسائل الغرفة الصوتية
app.get('/api/voice-room/messages', authenticateToken, async (req, res) => {
  try {
    const room = await getOrCreateDefaultVoiceRoom();

    // جلب آخر 50 رسالة
    const messages = room.textMessages.slice(-50);

    // تحويل الرسائل مع بيانات المرسلين
    const populatedMessages = await Promise.all(
      messages.map(async (msg) => {
        const sender = await User.findById(msg.sender).select('username profileImage playerId gender role isAdmin');
        return {
          _id: msg._id,
          sender: sender || { username: 'مستخدم محذوف', profileImage: null, playerId: 'unknown' },
          content: msg.content,
          timestamp: msg.timestamp,
          messageType: msg.messageType
        };
      })
    );

    res.json(populatedMessages);
  } catch (error) {
    console.error('Get voice room messages error:', error);
    res.status(500).json({ message: 'خطأ في جلب الرسائل' });
  }
});

// تحديث حالة المايك (كتم/إلغاء كتم)
app.post('/api/voice-room/toggle-mute', authenticateToken, async (req, res) => {
  try {
    const { isMuted } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // البحث عن مقعد المستخدم
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === req.user.userId
    );

    if (!userSeat) {
      return res.status(400).json({ message: 'أنت لست في أي مقعد صوتي' });
    }

    userSeat.isMuted = isMuted;
    await room.save();

    res.json({
      message: isMuted ? 'تم كتم المايك' : 'تم إلغاء كتم المايك',
      isMuted,
      seatNumber: userSeat.seatNumber
    });
  } catch (error) {
    console.error('Toggle mute error:', error);
    res.status(500).json({ message: 'خطأ في تحديث حالة المايك' });
  }
});

// ========== ADMIN VOICE ROOM ENDPOINTS ==========

// middleware للتحقق من صلاحيات الأدمن
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && !user.isAdmin)) {
      return res.status(403).json({ message: 'غير مصرح لك بهذا الإجراء' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ message: 'خطأ في التحقق من الصلاحيات' });
  }
};

// طرد مستخدم من الغرفة الصوتية
app.post('/api/voice-room/admin/kick', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, durationInMinutes = 30 } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // إزالة المستخدم من المقعد إن وجد
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === userId
    );

    if (userSeat) {
      userSeat.user = null;
      userSeat.isMuted = false;
    }

    // إزالة المستخدم من قائمة الانتظار
    room.waitingQueue = room.waitingQueue.filter(
      item => item.user.toString() !== userId
    );

    // إضافة المستخدم لقائمة المطرودين مع تاريخ انتهاء الطرد
    const kickExpiresAt = new Date(Date.now() + durationInMinutes * 60 * 1000);
    targetUser.voiceRoomKickExpiresAt = kickExpiresAt;
    await targetUser.save();

    await room.save();

    // تحويل المدة لنص مفهوم
    let durationText = '';
    if (durationInMinutes < 60) {
      durationText = `${durationInMinutes} دقيقة`;
    } else if (durationInMinutes < 1440) {
      durationText = `${Math.floor(durationInMinutes / 60)} ساعة`;
    } else if (durationInMinutes < 43200) {
      durationText = `${Math.floor(durationInMinutes / 1440)} يوم`;
    } else if (durationInMinutes < 525600) {
      durationText = `${Math.floor(durationInMinutes / 43200)} شهر`;
    } else {
      durationText = `${Math.floor(durationInMinutes / 525600)} سنة`;
    }

    res.json({
      message: `تم طرد المستخدم لمدة ${durationText}`,
      action: 'kick',
      targetUser: targetUser.username,
      duration: durationInMinutes,
      expiresAt: kickExpiresAt
    });

  } catch (error) {
    console.error('Admin kick error:', error);
    res.status(500).json({ message: 'خطأ في طرد المستخدم' });
  }
});

// إنزال مستخدم من المقعد
app.post('/api/voice-room/admin/remove-seat', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // البحث عن مقعد المستخدم
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === userId
    );

    if (!userSeat) {
      return res.status(400).json({ message: 'المستخدم ليس في مقعد' });
    }

    // إزالة المستخدم من المقعد
    userSeat.user = null;
    userSeat.isMuted = false;

    await room.save();

    res.json({
      message: 'تم إنزال المستخدم من المقعد بنجاح',
      action: 'remove_seat',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin remove seat error:', error);
    res.status(500).json({ message: 'خطأ في إنزال المستخدم من المقعد' });
  }
});

// إزالة مستخدم من قائمة الانتظار
app.post('/api/voice-room/admin/remove-queue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // التحقق من وجود المستخدم في قائمة الانتظار
    const inQueue = room.waitingQueue.some(
      item => item.user.toString() === userId
    );

    if (!inQueue) {
      return res.status(400).json({ message: 'المستخدم ليس في قائمة الانتظار' });
    }

    // إزالة المستخدم من قائمة الانتظار
    room.waitingQueue = room.waitingQueue.filter(
      item => item.user.toString() !== userId
    );

    await room.save();

    res.json({
      message: 'تم إزالة المستخدم من قائمة الانتظار بنجاح',
      action: 'remove_queue',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin remove queue error:', error);
    res.status(500).json({ message: 'خطأ في إزالة المستخدم من قائمة الانتظار' });
  }
});

// كتم مستخدم في الغرفة الصوتية
app.post('/api/voice-room/admin/mute', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // البحث عن مقعد المستخدم
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === userId
    );

    if (!userSeat) {
      return res.status(400).json({ message: 'المستخدم ليس في مقعد' });
    }

    // كتم المستخدم
    userSeat.isMuted = true;

    await room.save();

    res.json({
      message: 'تم كتم المستخدم بنجاح',
      action: 'mute',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin mute error:', error);
    res.status(500).json({ message: 'خطأ في كتم المستخدم' });
  }
});

// إلغاء كتم مستخدم في الغرفة الصوتية
app.post('/api/voice-room/admin/unmute', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const room = await getOrCreateDefaultVoiceRoom();

    // البحث عن مقعد المستخدم
    const userSeat = room.seats.find(seat =>
      seat.user && seat.user.toString() === userId
    );

    if (!userSeat) {
      return res.status(400).json({ message: 'المستخدم ليس في مقعد' });
    }

    // إلغاء كتم المستخدم
    userSeat.isMuted = false;

    await room.save();

    res.json({
      message: 'تم إلغاء كتم المستخدم بنجاح',
      action: 'unmute',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin unmute error:', error);
    res.status(500).json({ message: 'خطأ في إلغاء كتم المستخدم' });
  }
});

// منع مستخدم من الكتابة في المحادثة
app.post('/api/voice-room/admin/ban-chat', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إضافة المستخدم لقائمة المحظورين من الكتابة
    targetUser.isChatBanned = true;
    await targetUser.save();

    res.json({
      message: 'تم منع المستخدم من الكتابة بنجاح',
      action: 'ban_chat',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin ban chat error:', error);
    res.status(500).json({ message: 'خطأ في منع المستخدم من الكتابة' });
  }
});

// إلغاء منع مستخدم من الكتابة في المحادثة
app.post('/api/voice-room/admin/unban-chat', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إزالة المستخدم من قائمة المحظورين من الكتابة
    targetUser.isChatBanned = false;
    await targetUser.save();

    res.json({
      message: 'تم إلغاء منع المستخدم من الكتابة بنجاح',
      action: 'unban_chat',
      targetUser: targetUser.username
    });

  } catch (error) {
    console.error('Admin unban chat error:', error);
    res.status(500).json({ message: 'خطأ في إلغاء منع المستخدم من الكتابة' });
  }
});

// ========== PROFILE ENDPOINTS ==========

// جلب الأصدقاء
app.get('/api/profile/friends', authenticateToken, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [
        { requester: req.user.userId, status: 'accepted' },
        { recipient: req.user.userId, status: 'accepted' }
      ]
    }).populate('requester recipient', 'username playerId profileImage');

    const friends = friendships.map(friendship => {
      const friend = friendship.requester._id.toString() === req.user.userId
        ? friendship.recipient
        : friendship.requester;

      return {
        id: friend._id,
        username: friend.username,
        playerId: friend.playerId,
        profileImage: friend.profileImage,
        friendshipId: friendship._id,
        friendsSince: friendship.respondedAt
      };
    });

    res.json(friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'خطأ في جلب الأصدقاء' });
  }
});

// جلب طلبات الصداقة
app.get('/api/profile/friend-requests', authenticateToken, async (req, res) => {
  try {
    // الحصول على Player ID للمستخدم الحالي
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // البحث عن طلبات الصداقة باستخدام Player ID
    const friendRequests = await Friendship.find({
      recipientPlayerId: currentUser.playerId,
      status: 'pending'
    }).populate('requester', 'username playerId profileImage');

    const requests = friendRequests.map(request => ({
      id: request._id,
      requester: {
        id: request.requester._id,
        username: request.requester.username,
        playerId: request.requester.playerId,
        profileImage: request.requester.profileImage
      },
      requestedAt: request.requestedAt
    }));

    // تسجيل مبسط لطلبات الصداقة
    if (requests.length > 0) {
      console.log(`📥 Found ${requests.length} friend requests for player ${currentUser.playerId}`);
    }
    res.json(requests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'خطأ في جلب طلبات الصداقة' });
  }
});

// إرسال طلب صداقة
app.post('/api/profile/friend-request', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: 'معرف الصديق مطلوب' });
    }

    // التحقق من وجود المستخدم المستهدف (يمكن أن يكون ObjectId أو Player ID)
    let friend;
    if (mongoose.Types.ObjectId.isValid(friendId)) {
      friend = await User.findById(friendId);
    } else {
      friend = await User.findOne({ playerId: friendId });
    }

    if (!friend) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // الحصول على بيانات المرسل
    const requester = await User.findById(req.user.userId);
    if (!requester) {
      return res.status(404).json({ message: 'خطأ في بيانات المرسل' });
    }

    // التحقق من عدم إرسال طلب لنفسه
    if (friend._id.toString() === req.user.userId) {
      return res.status(400).json({ message: 'لا يمكن إرسال طلب صداقة لنفسك' });
    }

    // التحقق من عدم وجود طلب سابق باستخدام Player IDs
    const existingRequest = await Friendship.findOne({
      $or: [
        { requesterPlayerId: requester.playerId, recipientPlayerId: friend.playerId },
        { requesterPlayerId: friend.playerId, recipientPlayerId: requester.playerId }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ message: 'أنتما أصدقاء بالفعل' });
      } else if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'طلب الصداقة مرسل بالفعل' });
      }
    }

    // إنشاء طلب صداقة جديد
    const newRequest = new Friendship({
      requester: req.user.userId, // MongoDB ObjectId للتوافق
      requesterPlayerId: requester.playerId, // Player ID الصغير
      recipient: friend._id, // MongoDB ObjectId للتوافق
      recipientPlayerId: friend.playerId, // Player ID الصغير
      status: 'pending'
    });

    await newRequest.save();

    // إنشاء إشعار للمستقبل باستخدام Player ID
    await createNotification(
      friend._id, // MongoDB ObjectId للتوافق
      'friend_request',
      '🤝 طلب صداقة جديد',
      `${requester.username} أرسل لك طلب صداقة`,
      {
        friendshipId: newRequest._id,
        requesterId: req.user.userId,
        requesterName: requester.username,
        requesterPlayerId: requester.playerId,
        recipientPlayerId: friend.playerId
      },
      req.user.userId,
      friend.playerId // Player ID للمستقبل
    );

    console.log(`📤 Friend request sent from ${requester.username} to ${friend.username}`);

    res.json({
      message: 'تم إرسال طلب الصداقة بنجاح',
      request: {
        id: newRequest._id,
        friendId,
        status: 'pending',
        sentAt: newRequest.requestedAt
      }
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'خطأ في إرسال طلب الصداقة' });
  }
});

// قبول طلب صداقة
app.post('/api/profile/accept-friend', authenticateToken, async (req, res) => {
  try {
    const { friendshipId } = req.body;

    if (!friendshipId) {
      return res.status(400).json({ message: 'معرف طلب الصداقة مطلوب' });
    }

    // البحث عن طلب الصداقة
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(404).json({ message: 'طلب الصداقة غير موجود' });
    }

    // التحقق من أن المستخدم الحالي هو المستقبل
    if (friendship.recipient.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'ليس لديك صلاحية لقبول هذا الطلب' });
    }

    // التحقق من أن الطلب في حالة انتظار
    if (friendship.status !== 'pending') {
      return res.status(400).json({ message: 'طلب الصداقة ليس في حالة انتظار' });
    }

    // تحديث حالة الطلب
    friendship.status = 'accepted';
    friendship.respondedAt = new Date();
    await friendship.save();

    res.json({
      message: 'تم قبول طلب الصداقة بنجاح',
      friendship: {
        id: friendship._id,
        status: 'accepted',
        acceptedAt: friendship.respondedAt
      }
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'خطأ في قبول طلب الصداقة' });
  }
});

// فحص حالة الصداقة
app.get('/api/friends/check/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;

    if (!friendId) {
      return res.status(400).json({ message: 'معرف الصديق مطلوب' });
    }

    // البحث عن علاقة صداقة مقبولة
    const friendship = await Friendship.findOne({
      $or: [
        { requester: req.user.userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: req.user.userId, status: 'accepted' }
      ]
    });

    res.json({
      isFriend: !!friendship,
      friendshipId: friendship?._id || null
    });
  } catch (error) {
    console.error('Check friendship error:', error);
    res.status(500).json({ message: 'خطأ في فحص حالة الصداقة' });
  }
});



// البحث عن مستخدم برقم اللاعب
app.get('/api/users/search-by-id/:playerId', authenticateToken, async (req, res) => {
  try {
    const { playerId } = req.params;

    // التحقق من صحة Player ID (يجب أن يكون رقم صحيح)
    if (!playerId || !/^\d+$/.test(playerId)) {
      return res.status(400).json({ message: 'رقم اللاعب يجب أن يكون رقم صحيح' });
    }

    // البحث عن المستخدم برقم اللاعب
    const user = await User.findOne({ playerId });
    if (!user) {
      return res.status(404).json({ message: 'لم يتم العثور على لاعب بهذا الرقم' });
    }

    // التحقق من أن المستخدم لا يبحث عن نفسه
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({ message: 'لا يمكنك إضافة نفسك كصديق' });
    }

    // إرجاع بيانات المستخدم الأساسية
    res.json({
      id: user._id,
      username: user.username,
      playerId: user.playerId,
      profileImage: user.profileImage,
      level: user.level
    });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ message: 'خطأ في البحث عن المستخدم' });
  }
});

// تحويل الذهب إلى لآلئ
app.post('/api/profile/exchange-gold-to-pearls', authenticateToken, async (req, res) => {
  try {
    const { goldAmount } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (!goldAmount || goldAmount < 10000) {
      return res.status(400).json({ message: 'الحد الأدنى للتحويل هو 10,000 عملة ذهبية' });
    }

    if (goldAmount % 10000 !== 0) {
      return res.status(400).json({ message: 'يجب أن تكون الكمية مضاعفات 10,000' });
    }

    if (user.goldCoins < goldAmount) {
      return res.status(400).json({ message: 'رصيد العملات الذهبية غير كافي' });
    }

    // حساب عدد اللآلئ (10,000 ذهب = 1 لؤلؤة)
    const pearlsToAdd = goldAmount / 10000;

    // تحديث الرصيد
    user.goldCoins -= goldAmount;
    user.pearls += pearlsToAdd;
    await user.save();

    // حفظ سجل المعاملة
    const transaction = new Transaction({
      user: req.user.userId,
      type: 'exchange',
      amount: -goldAmount,
      currency: 'gold',
      description: `تحويل ${goldAmount} عملة ذهبية إلى ${pearlsToAdd} لؤلؤة`,
      status: 'completed'
    });
    await transaction.save();

    // حفظ سجل اللآلئ المضافة
    const pearlTransaction = new Transaction({
      user: req.user.userId,
      type: 'exchange',
      amount: pearlsToAdd,
      currency: 'pearls',
      description: `استلام ${pearlsToAdd} لؤلؤة من تحويل ${goldAmount} عملة ذهبية`,
      status: 'completed'
    });
    await pearlTransaction.save();

    res.json({
      message: `تم تحويل ${goldAmount} عملة ذهبية إلى ${pearlsToAdd} لؤلؤة بنجاح`,
      newBalance: {
        goldCoins: user.goldCoins,
        pearls: user.pearls
      },
      exchangeDetails: {
        goldSpent: goldAmount,
        pearlsReceived: pearlsToAdd,
        exchangeRate: '10,000 🪙 = 1 🦪'
      }
    });
  } catch (error) {
    console.error('Exchange gold to pearls error:', error);
    res.status(500).json({ message: 'خطأ في تحويل العملات' });
  }
});

// إرسال عنصر
app.post('/api/profile/send-item', authenticateToken, async (req, res) => {
  try {
    const { toUserId, itemType, message } = req.body;
    const fromUser = await User.findById(req.user.userId);

    if (!fromUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    if (!itemType) {
      return res.status(400).json({ message: 'نوع العنصر مطلوب' });
    }

    // قائمة العناصر المتاحة مع تأثيراتها
    const itemEffects = {
      // العناصر الضارة (تخصم من الذهب فقط)
      'bomb': { type: 'harmful', goldEffect: -2000, pearlsEffect: 0, name: 'قنبلة مدمرة 💣' },
      'bat': { type: 'harmful', goldEffect: -1000, pearlsEffect: 0, name: 'خفاش مؤذي 🦇' },
      'snake': { type: 'harmful', goldEffect: -1500, pearlsEffect: 0, name: 'ثعبان سام 🐍' },

      // العناصر المفيدة (تضيف للرصيد)
      'gem': { type: 'beneficial', goldEffect: 3000, pearlsEffect: 8, name: 'جوهرة نادرة 💎' },
      'star': { type: 'beneficial', goldEffect: 2500, pearlsEffect: 6, name: 'نجمة ذهبية ⭐' },
      'coin': { type: 'beneficial', goldEffect: 1500, pearlsEffect: 4, name: 'عملة خاصة 🪙' },

      // العملات (تضيف للرصيد)
      'gold': { type: 'beneficial', goldEffect: 1000, pearlsEffect: 0, name: 'عملات ذهبية 🪙' }
    };

    if (!itemEffects[itemType]) {
      return res.status(400).json({ message: 'نوع العنصر غير صحيح' });
    }

    const itemEffect = itemEffects[itemType];

    // تطبيق تأثير العنصر على المستقبل
    let effectMessage = '';
    if (itemEffect.goldEffect !== 0) {
      toUser.goldCoins = Math.max(0, toUser.goldCoins + itemEffect.goldEffect);
      if (itemEffect.goldEffect > 0) {
        effectMessage += `+${itemEffect.goldEffect} عملة ذهبية `;
      } else {
        effectMessage += `${itemEffect.goldEffect} عملة ذهبية `;
      }
    }

    if (itemEffect.pearlsEffect !== 0) {
      toUser.pearls = Math.max(0, toUser.pearls + itemEffect.pearlsEffect);
      if (itemEffect.pearlsEffect > 0) {
        effectMessage += `+${itemEffect.pearlsEffect} لؤلؤة `;
      } else {
        effectMessage += `${itemEffect.pearlsEffect} لؤلؤة `;
      }
    }

    await toUser.save();

    // حفظ سجل إرسال العنصر
    const itemGift = new Gift({
      sender: req.user.userId,
      recipient: toUserId,
      giftType: 'item',
      amount: 1,
      message: message || `عنصر ${itemType}`,
      itemType: itemType,
      status: 'sent'
    });
    await itemGift.save();

    // حفظ سجل المعاملة للمرسل
    const senderTransaction = new Transaction({
      user: req.user.userId,
      type: 'gift_sent',
      amount: -1,
      currency: 'gold', // مؤقت
      description: `إرسال عنصر ${itemType} إلى ${toUser.username}`,
      relatedUser: toUserId
    });

    // حفظ سجل المعاملة للمستقبل
    const recipientTransaction = new Transaction({
      user: toUserId,
      type: 'gift_received',
      amount: 1,
      currency: 'gold', // مؤقت
      description: `استلام عنصر ${itemType} من ${fromUser.username}`,
      relatedUser: req.user.userId
    });

    await senderTransaction.save();
    await recipientTransaction.save();

    // إنشاء إشعار للمستقبل مع التأثير
    const notificationTitle = itemEffect.type === 'harmful' ? '⚠️ تأثير ضار!' : '🎁 عنصر مفيد!';
    const notificationMessage = `${fromUser.username} أرسل لك ${itemEffect.name}${effectMessage ? ` (${effectMessage.trim()})` : ''}`;

    await createNotification(
      toUserId,
      'item_received',
      notificationTitle,
      notificationMessage,
      {
        itemType,
        itemGiftId: itemGift._id,
        effect: effectMessage.trim(),
        newBalance: {
          goldCoins: toUser.goldCoins,
          pearls: toUser.pearls
        }
      },
      req.user.userId
    );

    res.json({
      message: `تم إرسال ${itemEffect.name} إلى ${toUser.username} بنجاح${effectMessage ? ` (${effectMessage.trim()})` : ''}`,
      itemGift: {
        id: itemGift._id,
        itemType,
        itemName: itemEffect.name,
        recipient: toUser.username,
        effect: effectMessage.trim(),
        recipientNewBalance: {
          goldCoins: toUser.goldCoins,
          pearls: toUser.pearls
        },
        sentAt: itemGift.createdAt
      }
    });
  } catch (error) {
    console.error('Send item error:', error);
    res.status(500).json({ message: 'خطأ في إرسال العنصر' });
  }
});

// جلب الإشعارات
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    // الحصول على Player ID للمستخدم الحالي
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // البحث عن الإشعارات باستخدام Player ID
    const notifications = await Notification.find({ userPlayerId: currentUser.playerId })
      .populate('fromUser', 'username profileImage playerId')
      .sort({ createdAt: -1 })
      .limit(50);

    // تسجيل مبسط للإشعارات
    if (notifications.length > 0) {
      console.log(`📬 Found ${notifications.length} notifications for player ${currentUser.playerId}`);
    }
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'خطأ في جلب الإشعارات' });
  }
});

// تحديد إشعار واحد كمقروء
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'الإشعار غير موجود' });
    }

    res.json({ message: 'تم تحديث الإشعار كمقروء', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'خطأ في تحديث الإشعار' });
  }
});

// تحديد جميع الإشعارات كمقروءة
app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    // الحصول على Player ID للمستخدم الحالي
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث الإشعارات باستخدام Player ID
    await Notification.updateMany(
      { userPlayerId: currentUser.playerId },
      { isRead: true }
    );

    console.log(`📖 Marked all notifications as read for player ${currentUser.playerId}`);
    res.json({ message: 'تم تحديث جميع الإشعارات كمقروءة' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'خطأ في تحديث الإشعارات' });
  }
});

// تحديد الإشعارات كمقروءة (API القديم للتوافق)
app.put('/api/notifications/mark-read', authenticateToken, async (req, res) => {
  try {
    const { notificationIds } = req.body;

    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        user: req.user.userId
      },
      { isRead: true }
    );

    res.json({ message: 'تم تحديد الإشعارات كمقروءة' });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ message: 'خطأ في تحديث الإشعارات' });
  }
});

// حذف المحادثات القديمة يدوياً (للمشرفين)
app.delete('/api/messages/cleanup', authenticateToken, async (req, res) => {
  try {
    // التحقق من أن المستخدم مشرف
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'غير مصرح لك بهذا الإجراء' });
    }

    const { days = 3 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await Message.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    res.json({
      message: `تم حذف ${result.deletedCount} رسالة أقدم من ${days} أيام`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ message: 'خطأ في حذف المحادثات' });
  }
});

// حذف محادثة محددة بين مستخدمين
app.delete('/api/messages/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    const result = await Message.deleteMany({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    });

    res.json({
      message: `تم حذف ${result.deletedCount} رسالة من المحادثة`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'خطأ في حذف المحادثة' });
  }
});

// جلب المحادثات
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // الحصول على Player ID للمستخدم الحالي
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديد ما إذا كان userId هو ObjectId أم Player ID
    let targetUser;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      targetUser = await User.findById(userId);
    } else {
      targetUser = await User.findOne({ playerId: userId });
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    // البحث عن الرسائل باستخدام Player IDs
    const messages = await Message.find({
      $or: [
        { senderPlayerId: currentUser.playerId, recipientPlayerId: targetUser.playerId },
        { senderPlayerId: targetUser.playerId, recipientPlayerId: currentUser.playerId }
      ]
    })
    .populate('sender', 'username profileImage playerId')
    .populate('recipient', 'username profileImage playerId')
    .sort({ createdAt: 1 });

    console.log(`💬 Found ${messages.length} messages between ${currentUser.playerId} and ${targetUser.playerId}`);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'خطأ في جلب الرسائل' });
  }
});

// إرسال رسالة مع ضمان التزامن
app.post('/api/messages', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { recipientId, content, messageType = 'text' } = req.body;

    if (!recipientId || !content) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'معرف المستقبل والمحتوى مطلوبان' });
    }

    if (content.length > 500) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'الرسالة طويلة جداً (الحد الأقصى 500 حرف)' });
    }

    // الحصول على بيانات المرسل
    const sender = await User.findById(req.user.userId).session(session);
    if (!sender) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'خطأ في بيانات المرسل' });
    }

    // التحقق من عدم حظر المحادثة
    if (sender.isChatBanned) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'تم حظرك من المحادثة' });
    }

    // تحديد ما إذا كان recipientId هو ObjectId أم Player ID
    let recipient;
    if (mongoose.Types.ObjectId.isValid(recipientId)) {
      recipient = await User.findById(recipientId).session(session);
    } else {
      recipient = await User.findOne({ playerId: recipientId }).session(session);
    }

    if (!recipient) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    // التحقق من حدود الإرسال (مكافحة الإزعاج)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentMessages = await Message.countDocuments({
      sender: req.user.userId,
      createdAt: { $gte: oneMinuteAgo }
    }).session(session);

    if (recentMessages >= 10) {
      await session.abortTransaction();
      return res.status(429).json({ message: 'تم إرسال رسائل كثيرة. انتظر قليلاً' });
    }

    const message = new Message({
      sender: req.user.userId, // MongoDB ObjectId للتوافق
      senderPlayerId: sender.playerId, // Player ID الصغير
      recipient: recipient._id, // MongoDB ObjectId للتوافق
      recipientPlayerId: recipient.playerId, // Player ID الصغير
      content: content.trim(),
      messageType
    });

    await message.save({ session });

    // تحديث آخر نشاط للمستخدمين
    await Promise.all([
      User.findByIdAndUpdate(req.user.userId, { lastActive: new Date() }, { session }),
      User.findByIdAndUpdate(recipient._id, { lastActive: new Date() }, { session })
    ]);

    // تأكيد المعاملة
    await session.commitTransaction();

    // جلب الرسالة مع البيانات المطلوبة
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username profileImage playerId')
      .populate('recipient', 'username profileImage playerId');

    // إرسال فوري عبر WebSocket للمرسل والمستقبل
    const messageData = {
      id: populatedMessage._id,
      sender: {
        id: populatedMessage.sender._id,
        username: populatedMessage.sender.username,
        profileImage: populatedMessage.sender.profileImage,
        playerId: populatedMessage.sender.playerId
      },
      recipient: {
        id: populatedMessage.recipient._id,
        username: populatedMessage.recipient.username,
        profileImage: populatedMessage.recipient.profileImage,
        playerId: populatedMessage.recipient.playerId
      },
      content: populatedMessage.content,
      messageType: populatedMessage.messageType,
      isRead: populatedMessage.isRead,
      createdAt: populatedMessage.createdAt,
      timestamp: new Date().toISOString()
    };

    // إرسال للمرسل والمستقبل
    [req.user.userId, recipient._id.toString()].forEach(userId => {
      broadcastToUser(userId, {
        type: 'new_private_message',
        data: messageData
      });
    });

    // تسجيل النشاط
    eventMonitor.logUserActivity(req.user.userId, 'send_message', {
      recipientId: recipient._id.toString(),
      messageLength: content.length,
      messageType: messageType
    });

    // تسجيل في نظام التحليلات
    analyticsSystem.trackEvent('social', 'message_sent', messageType, content.length, req.user.userId);
    analyticsSystem.trackEvent('social', 'message_received', messageType, content.length, recipient._id.toString());

    // تسجيل للمراقبة
    console.log(`💬 رسالة خاصة - من: ${sender.username} إلى: ${recipient.username} | الطول: ${content.length}`);

    res.json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      messageData: messageData
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ خطأ في إرسال الرسالة:', error);

    // تسجيل مفصل للخطأ
    console.error('تفاصيل خطأ الرسالة:', {
      senderId: req.user.userId,
      recipientId: req.body.recipientId,
      contentLength: req.body.content?.length,
      error: error.message
    });

    eventMonitor.updateSystemMetrics('error', 1);

    res.status(500).json({
      message: 'خطأ في إرسال الرسالة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// جلب الهدايا
app.get('/api/profile/gifts', authenticateToken, async (req, res) => {
  try {
    // في المستقبل يمكن إضافة نظام الهدايا من قاعدة البيانات
    // حالياً نرجع قائمة فارغة
    res.json([]);
  } catch (error) {
    console.error('Get gifts error:', error);
    res.status(500).json({ message: 'خطأ في جلب الهدايا' });
  }
});

// إرسال هدية مع ضمان ACID
app.post('/api/profile/send-gift', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { toUserId, giftType, amount, message } = req.body;

    // التحقق من صحة البيانات
    if (!toUserId || !giftType || !amount) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'بيانات غير مكتملة' });
    }

    if (amount <= 0 || amount > 100000) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'مبلغ الهدية غير صحيح (1-100000)' });
    }

    if (!['gold', 'pearls'].includes(giftType)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'نوع الهدية غير صحيح' });
    }

    // البحث عن المستخدمين مع قفل للقراءة
    const fromUser = await User.findById(req.user.userId).session(session);
    const toUser = await User.findById(toUserId).session(session);

    if (!fromUser) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (!toUser) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    if (fromUser._id.toString() === toUser._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'لا يمكن إرسال هدية لنفسك' });
    }

    // التحقق من الرصيد
    const currentBalance = giftType === 'gold' ? fromUser.goldCoins : fromUser.pearls;
    if (currentBalance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `رصيد غير كافي. الرصيد الحالي: ${currentBalance}`,
        currentBalance: currentBalance,
        required: amount
      });
    }

    // التحقق من حدود الإرسال اليومية لمنع الغش
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyGifts = await Gift.aggregate([
      {
        $match: {
          sender: fromUser._id,
          createdAt: { $gte: today },
          status: 'sent'
        }
      },
      {
        $group: {
          _id: '$giftType',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]).session(session);

    const dailyLimit = giftType === 'gold' ? 50000 : 100; // حد يومي
    const todayTotal = dailyGifts.find(g => g._id === giftType)?.totalAmount || 0;

    if (todayTotal + amount > dailyLimit) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `تجاوزت الحد اليومي للهدايا (${dailyLimit} ${giftType})`,
        dailyUsed: todayTotal,
        dailyLimit: dailyLimit
      });
    }

    // تحديث الأرصدة
    const fromUserUpdate = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: giftType === 'gold' ? { goldCoins: -amount } : { pearls: -amount },
        $set: { lastActive: new Date() }
      },
      { new: true, session: session }
    );

    const toUserUpdate = await User.findByIdAndUpdate(
      toUserId,
      {
        $inc: giftType === 'gold' ? { goldCoins: amount } : { pearls: amount },
        $set: { lastActive: new Date() }
      },
      { new: true, session: session }
    );

    if (!fromUserUpdate || !toUserUpdate) {
      await session.abortTransaction();
      return res.status(500).json({ message: 'فشل في تحديث الأرصدة' });
    }

    // حفظ سجل الهدية
    const gift = new Gift({
      sender: req.user.userId,
      recipient: toUserId,
      giftType,
      amount,
      message: message || '',
      status: 'sent'
    });
    await gift.save({ session });

    // حفظ سجل المعاملات
    const senderTransaction = new Transaction({
      user: req.user.userId,
      type: 'gift_sent',
      amount: amount,
      currency: giftType,
      description: `هدية مرسلة إلى ${toUser.username} - ${message || 'بدون رسالة'}`,
      relatedUser: toUserId,
      status: 'completed'
    });

    const recipientTransaction = new Transaction({
      user: toUserId,
      type: 'gift_received',
      amount: amount,
      currency: giftType,
      description: `هدية مستلمة من ${fromUser.username} - ${message || 'بدون رسالة'}`,
      relatedUser: req.user.userId,
      status: 'completed'
    });

    await senderTransaction.save({ session });
    await recipientTransaction.save({ session });

    // تأكيد المعاملة
    await session.commitTransaction();

    // إرسال تحديثات فورية عبر WebSocket
    broadcastToUser(req.user.userId, {
      type: 'balance_update',
      data: {
        newBalance: giftType === 'gold' ? fromUserUpdate.goldCoins : fromUserUpdate.pearls,
        change: -amount,
        currency: giftType,
        reason: 'gift_sent',
        timestamp: new Date().toISOString()
      }
    });

    broadcastToUser(toUserId, {
      type: 'gift_received',
      data: {
        gift: {
          id: gift._id,
          sender: {
            id: fromUser._id,
            username: fromUser.username,
            avatar: fromUser.avatar
          },
          giftType,
          amount,
          message: message || '',
          timestamp: new Date().toISOString()
        },
        newBalance: giftType === 'gold' ? toUserUpdate.goldCoins : toUserUpdate.pearls
      }
    });

    // إنشاء إشعار للمستقبل
    await createNotification(
      toUserId,
      'gift_received',
      '🎁 هدية جديدة!',
      `استلمت ${amount} ${giftType === 'gold' ? 'عملة ذهبية' : 'لؤلؤة'} من ${fromUser.username}`,
      {
        giftType,
        amount,
        giftId: gift._id,
        message: message || ''
      },
      req.user.userId
    );

    // تسجيل في نظام التحليلات
    analyticsSystem.trackEvent('financial', 'gift_sent', giftType, amount, req.user.userId);
    analyticsSystem.trackEvent('social', 'gift_interaction', 'sent', amount, req.user.userId);
    analyticsSystem.trackEvent('financial', 'gift_received', giftType, amount, toUserId);
    analyticsSystem.trackEvent('social', 'gift_interaction', 'received', amount, toUserId);

    // تسجيل للمراقبة
    console.log(`🎁 هدية مرسلة - من: ${fromUser.username} إلى: ${toUser.username} | النوع: ${giftType} | المبلغ: ${amount}`);

    res.json({
      success: true,
      message: `تم إرسال ${amount} ${giftType === 'gold' ? 'عملة ذهبية' : 'لؤلؤة'} إلى ${toUser.username}`,
      fromUserBalance: {
        goldCoins: fromUserUpdate.goldCoins,
        pearls: fromUserUpdate.pearls
      },
      giftId: gift._id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ خطأ في إرسال الهدية:', error);

    // تسجيل مفصل للخطأ
    console.error('تفاصيل خطأ الهدية:', {
      fromUserId: req.user.userId,
      toUserId: req.body.toUserId,
      giftType: req.body.giftType,
      amount: req.body.amount,
      error: error.message
    });

    res.status(500).json({
      message: 'خطأ في إرسال الهدية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// استلام هدية
app.post('/api/profile/claim-gift', authenticateToken, async (req, res) => {
  try {
    const { giftId } = req.body;

    if (!giftId) {
      return res.status(400).json({ message: 'معرف الهدية مطلوب' });
    }

    // البحث عن الهدية
    const gift = await Gift.findById(giftId);
    if (!gift) {
      return res.status(404).json({ message: 'الهدية غير موجودة' });
    }

    // التحقق من أن المستخدم الحالي هو المستقبل
    if (gift.recipient.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'ليس لديك صلاحية لاستلام هذه الهدية' });
    }

    // التحقق من أن الهدية لم تُستلم بعد
    if (gift.status === 'received') {
      return res.status(400).json({ message: 'تم استلام هذه الهدية بالفعل' });
    }

    // تحديث حالة الهدية
    gift.status = 'received';
    await gift.save();

    res.json({
      message: 'تم استلام الهدية بنجاح',
      gift: {
        id: gift._id,
        giftType: gift.giftType,
        amount: gift.amount,
        message: gift.message,
        status: 'received'
      }
    });
  } catch (error) {
    console.error('Claim gift error:', error);
    res.status(500).json({ message: 'خطأ في استلام الهدية' });
  }
});

// جلب العناصر والدروع
app.get('/api/profile/items', authenticateToken, async (req, res) => {
  try {
    // في المستقبل يمكن إضافة نظام العناصر
    // حالياً نرجع قائمة فارغة
    res.json([]);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ message: 'خطأ في جلب العناصر' });
  }
});

// جلب عناصر مستخدم محدد (للمكون المحمول)
app.get('/api/user-items/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // في المستقبل: جلب العناصر الفعلية من قاعدة البيانات
    // حالياً: إرجاع عناصر افتراضية للاختبار
    const defaultItems = {
      gems: Math.floor(Math.random() * 10),
      stars: Math.floor(Math.random() * 15),
      coins: Math.floor(Math.random() * 20),
      bombs: Math.floor(Math.random() * 5),
      bats: Math.floor(Math.random() * 8),
      snakes: Math.floor(Math.random() * 3)
    };

    res.json({
      success: true,
      items: defaultItems
    });
  } catch (error) {
    console.error('Get user items error:', error);
    res.status(500).json({ message: 'خطأ في جلب عناصر المستخدم' });
  }
});

// جلب حالة الدرع للمستخدم
app.get('/api/profile/shield/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب الدرع النشط من قاعدة البيانات
    const activeShield = await Shield.findOne({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (activeShield) {
      const remainingTime = activeShield.expiresAt.getTime() - Date.now();
      res.json({
        shield: {
          id: activeShield._id,
          isActive: true,
          type: activeShield.type,
          expiresAt: activeShield.expiresAt,
          remainingTime: Math.max(0, remainingTime),
          activatedAt: activeShield.activatedAt
        }
      });
    } else {
      res.json({
        shield: {
          isActive: false,
          type: null,
          expiresAt: null,
          remainingTime: 0
        }
      });
    }
  } catch (error) {
    console.error('Get shield error:', error);
    res.status(500).json({ message: 'خطأ في جلب معلومات الدرع' });
  }
});

// تفعيل الدرع الواقي
app.post('/api/profile/activate-shield', authenticateToken, async (req, res) => {
  try {
    const { shieldType } = req.body; // 'gold' or 'usd'
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديد تكلفة الدرع
    const costs = {
      gold: 5000,  // 5000 عملة ذهبية
      usd: 1       // 1 دولار (يحتاج نظام دفع)
    };

    if (shieldType === 'gold') {
      if (user.goldCoins < costs.gold) {
        return res.status(400).json({
          message: `تحتاج إلى ${costs.gold} عملة ذهبية لتفعيل الدرع الواقي`
        });
      }

      // خصم العملات
      user.goldCoins -= costs.gold;
      await user.save();

      // حفظ الدرع في قاعدة البيانات
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة
      const shield = new Shield({
        user: req.user.userId,
        type: 'gold',
        isActive: true,
        expiresAt,
        cost: costs.gold,
        currency: 'gold'
      });
      await shield.save();

      // حفظ سجل المعاملة
      const transaction = new Transaction({
        user: req.user.userId,
        type: 'shield_purchase',
        amount: -costs.gold,
        currency: 'gold',
        description: 'شراء درع واقي لمدة 24 ساعة',
        status: 'completed'
      });
      await transaction.save();

      res.json({
        message: 'تم تفعيل الدرع الواقي لمدة 24 ساعة',
        shield: {
          id: shield._id,
          isActive: true,
          type: 'gold',
          expiresAt,
          remainingTime: 24 * 60 * 60 * 1000
        },
        newBalance: user.goldCoins
      });
    } else if (shieldType === 'usd') {
      // في المستقبل: تكامل مع نظام الدفع
      res.status(501).json({
        message: 'الدفع بالدولار غير متاح حالياً. استخدم العملات الذهبية.'
      });
    } else {
      res.status(400).json({ message: 'نوع الدرع غير صحيح' });
    }
  } catch (error) {
    console.error('Activate shield error:', error);
    res.status(500).json({ message: 'خطأ في تفعيل الدرع الواقي' });
  }
});

// جلب المعاملات
app.get('/api/profile/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ user: req.user.userId })
      .populate('relatedUser', 'username playerId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({ user: req.user.userId });

    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      status: transaction.status,
      relatedUser: transaction.relatedUser ? {
        id: transaction.relatedUser._id,
        username: transaction.relatedUser.username,
        playerId: transaction.relatedUser.playerId
      } : null,
      createdAt: transaction.createdAt
    }));

    res.json({
      transactions: formattedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'خطأ في جلب المعاملات' });
  }
});

// التحقق من الشحن المجاني المتاح
app.get('/api/profile/free-charges', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // التحقق من الشحن المجاني المستخدم
    const usedCharges = await FreeCharge.find({ user: userId });
    const usedTypes = usedCharges.map(charge => charge.chargeType);

    const availableCharges = {
      '1_dollar': !usedTypes.includes('1_dollar'),
      '5_dollar': !usedTypes.includes('5_dollar')
    };

    res.json({
      availableCharges,
      usedCharges: usedCharges.map(charge => ({
        type: charge.chargeType,
        amount: charge.amount,
        usedAt: charge.usedAt
      }))
    });
  } catch (error) {
    console.error('Get free charges error:', error);
    res.status(500).json({ message: 'خطأ في جلب معلومات الشحن المجاني' });
  }
});

// شحن الرصيد
app.post('/api/profile/charge-balance', authenticateToken, async (req, res) => {
  try {
    const { amount, isFree, chargeType } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ الشحن غير صحيح' });
    }

    let description = `شحن رصيد - ${amount} عملة ذهبية`;

    // إذا كان شحن مجاني
    if (isFree && chargeType) {
      // التحقق من أن المستخدم لم يستخدم هذا النوع من الشحن المجاني من قبل
      const existingFreeCharge = await FreeCharge.findOne({
        user: req.user.userId,
        chargeType
      });

      if (existingFreeCharge) {
        return res.status(400).json({
          message: 'لقد استخدمت الشحن المجاني لهذه الفئة من قبل'
        });
      }

      // التحقق من صحة المبلغ للشحن المجاني
      const validAmounts = {
        '1_dollar': 5000,
        '5_dollar': 27200
      };

      if (amount !== validAmounts[chargeType]) {
        return res.status(400).json({
          message: 'مبلغ الشحن المجاني غير صحيح'
        });
      }

      // حفظ سجل الشحن المجاني
      const freeCharge = new FreeCharge({
        user: req.user.userId,
        chargeType,
        amount
      });
      await freeCharge.save();

      description = `شحن مجاني - ${amount} عملة ذهبية (${chargeType})`;
    }

    // تحديث رصيد المستخدم
    user.goldCoins += amount;
    await user.save();

    // حفظ سجل المعاملة في قاعدة البيانات
    const transaction = new Transaction({
      user: req.user.userId,
      type: 'charge',
      amount,
      currency: 'gold',
      description,
      status: 'completed'
    });
    await transaction.save();

    res.json({
      message: `تم شحن ${amount} عملة ذهبية بنجاح`,
      newBalance: user.goldCoins,
      isFree,
      transaction: {
        id: transaction._id,
        type: 'charge',
        amount,
        timestamp: transaction.createdAt,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Charge balance error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'لقد استخدمت الشحن المجاني لهذه الفئة من قبل' });
    } else {
      res.status(500).json({ message: 'خطأ في شحن الرصيد' });
    }
  }
});

// تفعيل عنصر
app.post('/api/profile/activate-item', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.body;

    // في المستقبل: جلب العنصر من قاعدة البيانات وتفعيله
    // حالياً: محاكاة تفعيل العنصر

    res.json({
      message: 'تم تفعيل العنصر بنجاح',
      item: {
        id: itemId,
        isActive: true,
        activatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Activate item error:', error);
    res.status(500).json({ message: 'خطأ في تفعيل العنصر' });
  }
});

// ========== GAME SETTINGS ENDPOINTS ==========

// جلب إعدادات اللعبة
app.get('/api/game/settings', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    // إعدادات افتراضية للعبة
    const defaultSettings = {
      boxCount: 20,
      winRate: 0.3,
      gameSpeed: 1,
      difficulty: 'medium'
    };

    res.json(defaultSettings);
  } catch (error) {
    console.error('Get game settings error:', error);
    res.status(500).json({ message: 'خطأ في جلب إعدادات اللعبة' });
  }
});

// تحديث إعدادات اللعبة
app.post('/api/game/settings', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { boxCount, winRate, gameSpeed, difficulty } = req.body;

    // في المستقبل يمكن حفظ هذه الإعدادات في قاعدة البيانات
    // حالياً نرجع رسالة نجاح
    res.json({
      message: 'تم تحديث إعدادات اللعبة بنجاح',
      settings: { boxCount, winRate, gameSpeed, difficulty }
    });
  } catch (error) {
    console.error('Update game settings error:', error);
    res.status(500).json({ message: 'خطأ في تحديث إعدادات اللعبة' });
  }
});

// ========== ADMIN ANALYTICS ENDPOINTS ==========

// جلب النشاطات المشبوهة
app.get('/api/admin/suspicious-activities', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    // في المستقبل يمكن إضافة منطق لرصد النشاطات المشبوهة
    // حالياً نرجع قائمة فارغة
    res.json([]);
  } catch (error) {
    console.error('Get suspicious activities error:', error);
    res.status(500).json({ message: 'خطأ في جلب النشاطات المشبوهة' });
  }
});

// جلب معرف اللاعب
app.get('/api/admin/users/:userId/player-id', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({ playerId: user.playerId });
  } catch (error) {
    console.error('Get player ID error:', error);
    res.status(500).json({ message: 'خطأ في جلب معرف اللاعب' });
  }
});

// جلب جميع المستخدمين مع الصور (للأدمن)
app.get('/api/users/admin/users-with-ids', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // بناء استعلام البحث
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { playerId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // جلب المستخدمين مع التصفح
    const users = await User.find(query)
      .select('_id username playerId profileImage goldCoins pearls level isAdmin lastActive')
      .sort({ lastActive: -1 })
      .skip(skip)
      .limit(limit);

    // عدد المستخدمين الإجمالي
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users: users.map(user => ({
        id: user._id,
        userId: user._id, // إضافة userId للتوافق مع الواجهة الأمامية
        username: user.username,
        playerId: user.playerId,
        profileImage: user.profileImage,
        goldCoins: user.goldCoins,
        pearls: user.pearls,
        level: user.level,
        isAdmin: user.isAdmin,
        lastActive: user.lastActive
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users with IDs error:', error);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// تحديث معرف اللاعب (للأدمن فقط)
app.put('/api/admin/users/:userId/player-id', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { userId } = req.params;
    const { playerId } = req.body;

    // التحقق من صحة userId (يجب أن يكون ObjectId صحيح)
    if (!userId || userId.length < 12) {
      console.log(`❌ Invalid userId format: ${userId}`);
      return res.status(400).json({ message: 'معرف المستخدم غير صحيح' });
    }

    // التحقق من أن userId هو ObjectId صحيح
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.log(`❌ Invalid ObjectId format: ${userId}`);
      return res.status(400).json({ message: 'معرف المستخدم غير صحيح - يجب أن يكون ObjectId صحيح' });
    }

    // التحقق من صحة Player ID الجديد (يجب أن يكون رقم صحيح من 1 إلى ما لا نهاية)
    if (!playerId || !/^\d+$/.test(playerId) || parseInt(playerId) < 1) {
      return res.status(400).json({ message: 'Player ID يجب أن يكون رقم صحيح أكبر من أو يساوي 1' });
    }

    console.log(`🔍 Looking for user with ObjectId: ${userId}`);
    const user = await User.findById(userId);
    if (!user) {
      console.log(`❌ User not found with ObjectId: ${userId}`);
      return res.status(404).json({ message: 'المستخدم غير موجود في قاعدة البيانات الحالية' });
    }

    // التحقق من عدم وجود معرف اللاعب مع مستخدم آخر
    const existingUser = await User.findOne({ playerId, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({
        message: `معرف اللاعب ${playerId} موجود بالفعل مع المستخدم: ${existingUser.username}`
      });
    }

    // حفظ Player ID القديم للسجل
    const oldPlayerId = user.playerId;

    // تحديث معرف اللاعب
    user.playerId = playerId;
    await user.save();

    console.log(`✅ Updated playerId for user: ${user.username} (${userId}) -> ${oldPlayerId} => ${playerId}`);
    res.json({
      message: `تم تحديث معرف اللاعب بنجاح من ${oldPlayerId} إلى ${playerId}`,
      user: {
        id: user._id,
        username: user.username,
        oldPlayerId: oldPlayerId,
        newPlayerId: user.playerId
      }
    });
  } catch (error) {
    console.error('Update player ID error:', error);

    // إذا كان الخطأ متعلق بـ ObjectId
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({
        message: 'معرف المستخدم غير صحيح - لا يمكن العثور على هذا المستخدم في قاعدة البيانات الحالية',
        details: `المعرف المطلوب: ${req.params.userId} غير موجود`
      });
    }

    res.status(500).json({ message: 'خطأ في تحديث معرف اللاعب' });
  }
});

// تحديث بيانات المستخدم (للأدمن فقط) - endpoint جديد
app.put('/api/users/admin/update/:userId', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { userId } = req.params;
    const updates = req.body;

    // التحقق من صحة userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('❌ Invalid userId in update request:', userId);
      return res.status(400).json({
        message: 'معرف المستخدم غير صحيح',
        details: `المعرف المرسل: ${userId}`
      });
    }

    // التحقق من صحة ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error('❌ Invalid ObjectId format:', userId);
      return res.status(400).json({
        message: 'معرف المستخدم غير صحيح - يجب أن يكون ObjectId صحيح',
        details: `المعرف المرسل: ${userId}`
      });
    }

    console.log(`🔄 Updating user ${userId} with:`, updates);
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث البيانات المسموحة
    const allowedUpdates = ['username', 'email', 'goldCoins', 'pearls', 'coins', 'level', 'isAdmin'];
    const updateData = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }

    // التحقق من اسم المستخدم الجديد إذا تم تغييره
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await User.findOne({ username: updateData.username });
      if (existingUser) {
        return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
      }
    }

    // تطبيق التحديثات
    Object.assign(user, updateData);
    await user.save();

    res.json({
      message: 'تم تحديث المستخدم بنجاح',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        goldCoins: user.goldCoins,
        pearls: user.pearls,
        coins: user.coins,
        level: user.level,
        isAdmin: user.isAdmin,
        playerId: user.playerId
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المستخدم' });
  }
});

// عرض جميع المستخدمين مع معرفاتهم (للتشخيص)
app.get('/api/admin/debug/all-users', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const users = await User.find({}).select('_id username playerId email createdAt');

    console.log(`📊 Total users in database: ${users.length}`);
    users.forEach(user => {
      console.log(`👤 User: ${user.username} | ObjectId: ${user._id} | PlayerId: ${user.playerId || 'N/A'}`);
    });

    res.json({
      message: 'جميع المستخدمين في قاعدة البيانات الحالية',
      totalUsers: users.length,
      users: users.map(user => ({
        objectId: user._id,
        username: user.username,
        playerId: user.playerId || 'N/A',
        email: user.email,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// حذف مستخدم (للأدمن فقط)
app.delete('/api/users/admin/delete/:userId', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { userId } = req.params;

    // التحقق من صحة ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({ message: 'معرف المستخدم غير صحيح' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // منع حذف المشرف الحالي
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({ message: 'لا يمكن حذف حسابك الخاص' });
    }

    // حذف المستخدم
    await User.findByIdAndDelete(userId);

    console.log(`🗑️ Deleted user: ${user.username} (${userId})`);
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'خطأ في حذف المستخدم' });
  }
});

// حذف صورة مستخدم (للأدمن)
app.delete('/api/users/admin/delete-image/:userId', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // حذف الصورة
    user.profileImage = null;
    await user.save();

    res.json({ message: 'تم حذف الصورة بنجاح' });
  } catch (error) {
    console.error('Delete user image error:', error);
    res.status(500).json({ message: 'خطأ في حذف الصورة' });
  }
});

// إدارة صورة المستخدم (للأدمن) - endpoint عام
app.put('/api/users/admin/manage-user-image', authenticateToken, async (req, res) => {
  try {
    // التحقق من صلاحيات الأدمن
    const admin = await User.findById(req.user.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'صلاحيات المشرف مطلوبة' });
    }

    const { targetUserId, action, imageData, imageType } = req.body;

    console.log('🖼️ Image management request:', {
      targetUserId,
      action,
      hasImageData: !!imageData,
      imageType
    });

    if (!targetUserId || !action) {
      console.error('❌ Missing required fields:', { targetUserId, action });
      return res.status(400).json({ message: 'معرف المستخدم والإجراء مطلوبان' });
    }

    // التحقق من صحة ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(targetUserId)) {
      console.error('❌ Invalid ObjectId format:', targetUserId);
      return res.status(400).json({
        message: 'معرف المستخدم غير صحيح',
        details: `المعرف المرسل: ${targetUserId}`
      });
    }

    console.log('🔍 Looking for user with ID:', targetUserId);
    const user = await User.findById(targetUserId);
    if (!user) {
      console.error('❌ User not found:', targetUserId);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    console.log('✅ Found user:', user.username);

    switch (action) {
      case 'delete':
      case 'remove_avatar':
      case 'remove_profile_image':
        console.log('🗑️ Removing image for user:', user.username);
        user.profileImage = null;
        await user.save();
        console.log('✅ Image removed successfully');
        res.json({ message: 'تم حذف الصورة بنجاح' });
        break;

      case 'update':
      case 'change_avatar':
      case 'change_profile_image':
        if (imageData) {
          console.log('📤 Updating image for user:', user.username);
          console.log('📊 Image data size:', imageData.length, 'characters');
          user.profileImage = imageData;
          await user.save();
          console.log('✅ Image updated successfully');
          res.json({ message: 'تم تحديث الصورة بنجاح' });
        } else {
          console.error('❌ No image data provided for update action');
          res.status(400).json({ message: 'بيانات الصورة مطلوبة' });
        }
        break;

      default:
        console.error('❌ Invalid action:', action);
        res.status(400).json({ message: `إجراء غير صحيح: ${action}` });
    }
  } catch (error) {
    console.error('Manage user image error:', error);
    res.status(500).json({ message: 'خطأ في إدارة الصورة' });
  }
});

// ========== GAME ECONOMY ENDPOINTS ==========

// تحديث رصيد اللاعب مع ضمان ACID
app.post('/api/users/update-balance', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { balanceChange, gameType, sessionId, gameResult } = req.body;

    // التحقق من صحة البيانات
    if (!balanceChange || !gameType || !sessionId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'بيانات غير مكتملة' });
    }

    // التحقق من صحة sessionId لمنع التلاعب
    if (!sessionId.match(/^[a-zA-Z0-9_-]+$/)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'معرف الجلسة غير صحيح' });
    }

    // البحث عن المستخدم مع قفل للقراءة
    const user = await User.findById(req.user.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من الرصيد الحالي
    const currentBalance = user.goldCoins || 0;
    const newBalance = currentBalance + balanceChange;

    if (newBalance < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'رصيد غير كافي',
        currentBalance: currentBalance,
        requestedChange: balanceChange
      });
    }

    // التحقق من حدود الربح/الخسارة لمنع الغش
    const maxChangeAllowed = Math.min(currentBalance * 0.5, 50000); // حد أقصى 50% من الرصيد أو 50,000
    if (Math.abs(balanceChange) > maxChangeAllowed) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'التغيير المطلوب يتجاوز الحد المسموح',
        maxAllowed: maxChangeAllowed,
        requested: Math.abs(balanceChange)
      });
    }

    // التحقق من عدم وجود معاملة مكررة لنفس الجلسة
    const existingTransaction = await Transaction.findOne({
      user: req.user.userId,
      description: { $regex: sessionId }
    }).session(session);

    if (existingTransaction) {
      await session.abortTransaction();
      return res.status(409).json({ message: 'معاملة مكررة - تم رفض الطلب' });
    }

    // تحديث الرصيد
    const updateResult = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: { goldCoins: balanceChange },
        $set: { lastActive: new Date() }
      },
      {
        new: true,
        session: session,
        runValidators: true
      }
    );

    if (!updateResult) {
      await session.abortTransaction();
      return res.status(500).json({ message: 'فشل في تحديث الرصيد' });
    }

    // حفظ سجل المعاملة
    const transactionType = balanceChange > 0 ? 'game_win' : 'game_loss';
    const transaction = new Transaction({
      user: req.user.userId,
      type: transactionType,
      amount: Math.abs(balanceChange),
      currency: 'gold',
      description: `${gameType} - جلسة: ${sessionId} - ${balanceChange > 0 ? 'ربح' : 'خسارة'}`,
      status: 'completed'
    });

    await transaction.save({ session });

    // حفظ إحصائيات اللعبة
    const gameStats = new GameStats({
      userId: req.user.userId,
      gameType: gameType,
      sessionId: sessionId,
      startTime: new Date(),
      betAmount: gameResult?.lossAmount || 0,
      winAmount: gameResult?.winAmount || 0,
      lossAmount: gameResult?.lossAmount || 0,
      netResult: balanceChange,
      playerScore: gameResult?.playerScore || 0,
      skillFactor: gameResult?.skillFactor || 0,
      economicFactor: gameResult?.economicFactor || 0,
      winProbability: gameResult?.probability || 0
    });

    await gameStats.save({ session });

    // تأكيد المعاملة
    await session.commitTransaction();

    // إرسال تحديث فوري عبر WebSocket لجميع جلسات المستخدم
    broadcastToUser(req.user.userId, {
      type: 'balance_update',
      data: {
        newBalance: updateResult.goldCoins,
        change: balanceChange,
        gameType: gameType,
        transactionId: transaction._id,
        timestamp: new Date().toISOString()
      }
    });

    // تسجيل النشاط في المراقب
    eventMonitor.logUserActivity(req.user.userId, 'balance_update', {
      amount: balanceChange,
      gameType: gameType,
      newBalance: updateResult.goldCoins,
      sessionId: sessionId
    });

    // تسجيل في نظام التحليلات
    analyticsSystem.trackEvent('game', balanceChange > 0 ? 'game_win' : 'game_loss', gameType, Math.abs(balanceChange), req.user.userId);
    analyticsSystem.trackEvent('financial', balanceChange > 0 ? 'deposit' : 'withdrawal', 'gold', Math.abs(balanceChange), req.user.userId);

    // تسجيل المعاملة للمراقبة
    console.log(`💰 تحديث رصيد - المستخدم: ${user.username} | التغيير: ${balanceChange} | الرصيد الجديد: ${updateResult.goldCoins} | اللعبة: ${gameType}`);

    res.json({
      success: true,
      newBalance: updateResult.goldCoins,
      change: balanceChange,
      transactionId: transaction._id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ خطأ في تحديث الرصيد:', error);

    // تسجيل مفصل للخطأ
    console.error('تفاصيل الخطأ:', {
      userId: req.user.userId,
      balanceChange: req.body.balanceChange,
      gameType: req.body.gameType,
      sessionId: req.body.sessionId,
      error: error.message
    });

    res.status(500).json({
      message: 'خطأ في تحديث الرصيد',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// جلب بيانات الملف الشخصي للألعاب
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({
      id: user._id,
      username: user.username,
      playerId: user.playerId,
      coins: user.goldCoins || 0,
      pearls: user.pearls || 0,
      profileImage: user.profileImage,
      level: user.level || 1,
      experience: user.experience || 0
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات الملف الشخصي:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات الملف الشخصي' });
  }
});



// إنهاء جلسة اللعب
app.post('/api/games/session-end', authenticateToken, async (req, res) => {
  try {
    const sessionData = req.body;

    // تحديث إحصائيات الجلسة
    await GameStats.findOneAndUpdate(
      { sessionId: sessionData.sessionId, userId: req.user.userId },
      {
        endTime: new Date(sessionData.endTime),
        duration: sessionData.duration,
        gamesPlayed: sessionData.gamesPlayed,
        netResult: sessionData.netResult
      },
      { upsert: true }
    );

    res.json({ success: true });

  } catch (error) {
    console.error('خطأ في إنهاء الجلسة:', error);
    res.status(500).json({ message: 'خطأ في إنهاء الجلسة' });
  }
});

// جلب إحصائيات اللاعب
app.get('/api/games/player-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await GameStats.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: '$gamesPlayed' },
          totalWinnings: { $sum: '$winAmount' },
          totalLosses: { $sum: '$lossAmount' },
          netResult: { $sum: '$netResult' },
          avgSkillFactor: { $avg: '$skillFactor' },
          avgWinProbability: { $avg: '$winProbability' }
        }
      }
    ]);

    const overallStats = await GameStats.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      {
        $group: {
          _id: null,
          totalGames: { $sum: '$gamesPlayed' },
          totalWinnings: { $sum: '$winAmount' },
          totalLosses: { $sum: '$lossAmount' },
          netResult: { $sum: '$netResult' },
          totalSessions: { $sum: 1 }
        }
      }
    ]);

    res.json({
      gameStats: stats,
      overallStats: overallStats[0] || {
        totalGames: 0,
        totalWinnings: 0,
        totalLosses: 0,
        netResult: 0,
        totalSessions: 0
      }
    });

  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({ message: 'خطأ في جلب الإحصائيات' });
  }
});



// إعادة توجيه أي طلب غير API إلى index.html لتطبيق React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// معالج الأخطاء العام
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
});

// معالج الطرق غير الموجودة
app.use('*', (req, res) => {
  res.status(404).json({ message: 'الطريق غير موجود' });
});

// أنشئ خادم HTTP يدويًا لإرفاق WebSocket
const httpServer = http.createServer(app);

// إعداد WebSocket على المسار /ws مع تحسينات
const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws',
  perMessageDeflate: false, // تحسين الأداء
  maxPayload: 1024 * 1024, // 1MB حد أقصى للرسالة
  clientTracking: true
});

// نظام Heartbeat لمنع انقطاع الاتصالات
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      console.log('💔 Terminating dead connection');
      return socket.terminate();
    }

    socket.isAlive = false;
    socket.ping();
  });
}, 30000); // كل 30 ثانية

// تنظيف عند إغلاق الخادم
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// تخزين معلومات العملاء المتصلين
const connectedClients = new Map(); // userId -> { socket, currentRoomId, userInfo }

// دالة إرسال رسالة لمستخدم محدد عبر جميع جلساته
function broadcastToUser(userId, message) {
  try {
    let sentCount = 0;

    // البحث عن جميع الاتصالات للمستخدم
    connectedClients.forEach((clientInfo, clientUserId) => {
      if (clientUserId === userId && clientInfo.socket && clientInfo.socket.readyState === 1) {
        clientInfo.socket.send(JSON.stringify(message));
        sentCount++;
      }
    });

    // إرسال للجميع إذا لم نجد اتصالات مباشرة (fallback)
    if (sentCount === 0) {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            ...message,
            targetUserId: userId
          }));
        }
      });
    }

    console.log(`📡 رسالة مرسلة للمستخدم ${userId} عبر ${sentCount} اتصال`);
    return sentCount;
  } catch (error) {
    console.error('خطأ في إرسال الرسالة للمستخدم:', error);
    return 0;
  }
}

// دالة إرسال رسالة لجميع المستخدمين المتصلين
function broadcastToAll(message, excludeUserId = null) {
  try {
    let sentCount = 0;

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // تخطي المستخدم المستبعد إذا كان محدداً
        if (excludeUserId) {
          const clientUserId = Array.from(connectedClients.entries())
            .find(([userId, clientInfo]) => clientInfo.socket === client)?.[0];

          if (clientUserId === excludeUserId) {
            return;
          }
        }

        client.send(JSON.stringify(message));
        sentCount++;
      }
    });

    console.log(`📡 رسالة مرسلة لجميع المتصلين (${sentCount} عميل)`);
    return sentCount;
  } catch (error) {
    console.error('خطأ في الإرسال العام:', error);
    return 0;
  }
}

wss.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected');
  eventMonitor.updateSystemMetrics('connection', 1);

  // إعداد heartbeat لمنع انقطاع الاتصال
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.send(JSON.stringify({
    type: 'connection_established',
    timestamp: new Date().toISOString()
  }));

  // متغير لتخزين معلومات المستخدم لهذا الاتصال
  let currentUserId = null;
  let currentRoomId = null;

  socket.on('message', (data) => {
    try {
      const textData = typeof data === 'string' ? data : data.toString();
      const message = JSON.parse(textData);

      console.log('📨 WebSocket message received:', message.type);

      // تسجيل معلومات المستخدم
      if (message.type === 'user_connected') {
        currentUserId = message.data.userId;
        connectedClients.set(currentUserId, {
          socket,
          userInfo: message.data.userInfo,
          currentRoomId: null,
          connectedAt: new Date()
        });

        // تسجيل النشاط في المراقب
        eventMonitor.logUserActivity(currentUserId, 'websocket_connected', {
          userAgent: message.data.userInfo?.userAgent,
          timestamp: new Date().toISOString()
        });

        console.log(`👤 User ${currentUserId} connected via WebSocket`);
      }

      // رسائل المحادثة الخاصة - محسنة للتزامن
      if (message.type === 'private_message') {
        const broadcastMessage = {
          type: 'new_message',
          messageData: message.data.messageData,
          recipientId: message.data.recipientId,
          senderId: message.data.messageData.sender._id,
          timestamp: new Date().toISOString()
        };

        console.log('📤 Broadcasting private message:', {
          recipientId: broadcastMessage.recipientId,
          senderId: broadcastMessage.senderId,
          content: message.data.messageData.content?.substring(0, 50) + '...'
        });

        // إرسال للمرسل والمستقبل فقط (محسن)
        let sentCount = 0;
        const targetUserIds = [broadcastMessage.senderId, broadcastMessage.recipientId];

        targetUserIds.forEach(userId => {
          const userSentCount = broadcastToUser(userId, broadcastMessage);
          sentCount += userSentCount;
        });

        // Fallback: إرسال للجميع إذا لم نجد الأهداف المحددة
        if (sentCount === 0) {
          wss.clients.forEach((client) => {
            if (client.readyState === 1) {
              client.send(JSON.stringify(broadcastMessage));
              sentCount++;
            }
          });
        }

        console.log(`📡 Private message sent to ${sentCount} clients`);
      }

      // رسائل الغرفة الصوتية
      else if (message.type === 'voice_room_message') {
        // بث رسالة الغرفة الصوتية لجميع المتصلين
        const broadcastMessage = {
          type: 'voice_room_message',
          data: message.data
        };

        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(broadcastMessage));
            sentCount++;
          }
        });

        console.log(`🎤 Voice room message sent to ${sentCount} clients`);
      }

      // تحديثات المقاعد الصوتية
      else if (message.type === 'voice_room_update') {
        // بث تحديث الغرفة الصوتية لجميع المتصلين
        const broadcastMessage = {
          type: 'voice_room_update',
          data: message.data
        };

        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(broadcastMessage));
            sentCount++;
          }
        });

        console.log(`🔄 Voice room update sent to ${sentCount} clients`);
      }

      // نشاط الصوت (Voice Activity)
      else if (message.type === 'voice_activity') {
        // بث نشاط الصوت لجميع المتصلين
        const broadcastMessage = {
          type: 'voice_activity',
          data: message.data
        };

        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(broadcastMessage));
            sentCount++;
          }
        });

        // تسجيل مبسط فقط للتغييرات المهمة
        // (تم تقليل logs لتجنب الإزعاج)
      }

      // تحديثات الإجراءات الإدارية المحسنة
      else if (message.type === 'admin_action_update') {
        const broadcastMessage = {
          type: 'admin_action_update',
          data: message.data
        };

        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(broadcastMessage));
            sentCount++;
          }
        });

        console.log(`🛡️ Admin action update sent to ${sentCount} clients`);
      }

      // إشارات WebRTC للصوت
      else if (message.type === 'webrtc_offer' || message.type === 'webrtc_answer' || message.type === 'webrtc_ice_candidate') {
        // إرسال إشارات WebRTC للمستخدم المحدد
        const targetUserId = message.data.targetUserId;
        const targetClient = connectedClients.get(targetUserId);

        if (targetClient && targetClient.socket.readyState === 1) {
          targetClient.socket.send(JSON.stringify({
            type: message.type,
            data: {
              ...message.data,
              fromUserId: currentUserId
            }
          }));
          console.log(`🔊 WebRTC signal sent from ${currentUserId} to ${targetUserId}`);
        }
      }

      // النشاط الصوتي (التحدث) - محسن مع التأثيرات البصرية
      else if (message.type === 'voice_activity') {
        // بث حالة التحدث مع جميع البيانات للتأثيرات البصرية
        const voiceRoomClients = Array.from(connectedClients.values()).filter(client =>
          client.isInVoiceRoom && client.userId !== currentUserId
        );

        voiceRoomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'voice_activity',
              data: {
                userId: currentUserId,
                username: message.data.username,
                role: message.data.role,
                isAdmin: message.data.isAdmin,
                isSpeaking: message.data.isSpeaking,
                isMuted: message.data.isMuted,
                level: message.data.level,
                seatNumber: message.data.seatNumber
              }
            }));
          }
        });

        // Voice activity logs reduced for better performance
      }

      // ========== WEBRTC SIGNALING ==========

      // انضمام لغرفة صوتية
      else if (message.type === 'join_voice_room') {
        const { roomId, userId } = message.data;

        // تحديث currentUserId إذا لم يكن محدد
        if (!currentUserId && userId) {
          currentUserId = userId;
          console.log(`🔧 Updated currentUserId to: ${currentUserId}`);
        }

        console.log(`📥 Received join_voice_room from ${currentUserId} for room: ${roomId}`);

        // تحديث حالة العميل
        if (connectedClients.has(currentUserId)) {
          connectedClients.get(currentUserId).voiceRoomId = roomId;
          console.log(`✅ Updated client ${currentUserId} voiceRoomId to: ${roomId}`);
        } else if (currentUserId) {
          // إنشاء client جديد إذا لم يكن موجود
          connectedClients.set(currentUserId, {
            socket,
            userId: currentUserId,
            voiceRoomId: roomId,
            isInVoiceRoom: true
          });
          console.log(`✅ Created new client entry for ${currentUserId}`);
        }

        // إشعار المستخدمين الآخرين في نفس الغرفة
        const roomClients = Array.from(connectedClients.values()).filter(client =>
          client.voiceRoomId === roomId && client.userId !== currentUserId
        );

        console.log(`🔍 Found ${roomClients.length} other users in room ${roomId}`);

        roomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            console.log(`📤 Notifying ${client.userId} about ${currentUserId} joining`);
            client.socket.send(JSON.stringify({
              type: 'user_joined_voice',
              data: { userId: currentUserId }
            }));
          }
        });

        console.log(`🎤 User ${currentUserId} joined voice room: ${roomId}`);
      }

      // مغادرة غرفة صوتية
      else if (message.type === 'leave_voice_room') {
        const { roomId, userId } = message.data;

        // إشعار المستخدمين الآخرين في نفس الغرفة
        const roomClients = Array.from(connectedClients.values()).filter(client =>
          client.voiceRoomId === roomId && client.userId !== currentUserId
        );

        roomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'user_left_voice',
              data: { userId: currentUserId }
            }));
          }
        });

        // إزالة من الغرفة
        if (connectedClients.has(currentUserId)) {
          connectedClients.get(currentUserId).voiceRoomId = null;
        }

        console.log(`🔇 User ${currentUserId} left voice room: ${roomId}`);
      }

      // WebRTC Offer
      else if (message.type === 'webrtc_offer') {
        const { offer, targetUserId, fromUserId } = message.data;
        console.log(`📥 Received WebRTC offer from ${fromUserId} to ${targetUserId}`);

        const targetClient = Array.from(connectedClients.values()).find(client =>
          client.userId === targetUserId
        );

        if (targetClient && targetClient.socket.readyState === 1) {
          targetClient.socket.send(JSON.stringify({
            type: 'webrtc_offer',
            data: { offer, fromUserId }
          }));
          console.log(`📤 WebRTC offer sent from ${fromUserId} to ${targetUserId}`);
        } else {
          console.warn(`⚠️ Target client ${targetUserId} not found or not connected`);
        }
      }

      // WebRTC Answer
      else if (message.type === 'webrtc_answer') {
        const { answer, targetUserId, fromUserId } = message.data;

        const targetClient = Array.from(connectedClients.values()).find(client =>
          client.userId === targetUserId
        );

        if (targetClient && targetClient.socket.readyState === 1) {
          targetClient.socket.send(JSON.stringify({
            type: 'webrtc_answer',
            data: { answer, fromUserId }
          }));
          console.log(`📤 WebRTC answer sent from ${fromUserId} to ${targetUserId}`);
        }
      }

      // WebRTC ICE Candidate
      else if (message.type === 'webrtc_ice_candidate') {
        const { candidate, targetUserId, fromUserId } = message.data;

        const targetClient = Array.from(connectedClients.values()).find(client =>
          client.userId === targetUserId
        );

        if (targetClient && targetClient.socket.readyState === 1) {
          targetClient.socket.send(JSON.stringify({
            type: 'webrtc_ice_candidate',
            data: { candidate, fromUserId }
          }));
          console.log(`📤 ICE candidate sent from ${fromUserId} to ${targetUserId}`);
        }
      }

      else {
        // رسائل أخرى - بث عادي
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(textData);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      // في حالة الخطأ، بث الرسالة كما هي
      const textData = typeof data === 'string' ? data : data.toString();
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(textData);
        }
      });
    }
  });

  // دالة إزالة المستخدم من المقعد الصوتي
  async function removeUserFromVoiceSeat(userId) {
    try {
      const room = await getOrCreateDefaultVoiceRoom();

      // البحث عن مقعد المستخدم
      const userSeat = room.seats.find(seat =>
        seat.user && seat.user.toString() === userId
      );

      if (userSeat) {
        // إزالة المستخدم من المقعد
        userSeat.user = null;
        userSeat.userPlayerId = null;
        userSeat.isSpeaking = false;
        userSeat.isMuted = false;
        userSeat.joinedAt = null;

        await room.save();

        console.log(`🗑️ Removed user ${userId} from voice seat ${userSeat.seatNumber}`);

        // إشعار جميع المستخدمين بالتحديث
        const connectedClientsArray = Array.from(connectedClients.values());
        const voiceRoomClients = connectedClientsArray.filter(client => client.isInVoiceRoom);

        voiceRoomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'voice_room_update',
              data: {
                action: 'seat_left',
                userId: userId,
                seatNumber: userSeat.seatNumber
              }
            }));
          }
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing user from voice seat:', error);
      return false;
    }
  }

  socket.on('close', async () => {
    console.log('🛑 WebSocket client disconnected');

    if (currentUserId) {
      try {
        // إزالة المستخدم من المقعد الصوتي إذا كان جالساً
        await removeUserFromVoiceSeat(currentUserId);

        // إشعار المستخدمين الآخرين بمغادرة المستخدم
        const connectedClientsArray = Array.from(connectedClients.values());
        const voiceRoomClients = connectedClientsArray.filter(client => client.isInVoiceRoom);

        voiceRoomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'user_left_voice',
              data: { userId: currentUserId }
            }));
          }
        });

        // إرسال تحديث الغرفة الصوتية
        voiceRoomClients.forEach(client => {
          if (client.socket.readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'voice_room_update',
              data: { action: 'user_disconnected', userId: currentUserId }
            }));
          }
        });

        connectedClients.delete(currentUserId);
        console.log(`🗑️ Removed user ${currentUserId} from connected clients and voice seat`);
      } catch (error) {
        console.error('Error removing user from voice seat on disconnect:', error);
        // حتى لو فشل في إزالة المستخدم من المقعد، نزيله من العملاء المتصلين
        connectedClients.delete(currentUserId);
      }
    } else {
      // إزالة العميل من القائمة حتى لو لم يكن لديه userId
      const clientToRemove = Array.from(connectedClients.entries()).find(([id, client]) => client.socket === socket);
      if (clientToRemove) {
        connectedClients.delete(clientToRemove[0]);
        console.log(`🗑️ Removed anonymous client from connected clients`);
      }
    }
  });
});

// دالة حذف المحادثات القديمة (أكثر من 3 أيام)
const deleteOldMessages = async () => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result = await Message.deleteMany({
      createdAt: { $lt: threeDaysAgo }
    });

    if (result.deletedCount > 0) {
      console.log(`🗑️ Deleted ${result.deletedCount} old messages (older than 3 days)`);
    }
  } catch (error) {
    console.error('Error deleting old messages:', error);
  }
};

// تشغيل مهمة حذف المحادثات القديمة كل يوم في الساعة 2:00 صباحاً
cron.schedule('0 2 * * *', () => {
  console.log('🕐 Running daily cleanup of old messages...');
  deleteOldMessages();
});

// تشغيل حذف المحادثات القديمة عند بدء تشغيل السيرفر
console.log('🧹 Running initial cleanup of old messages...');
deleteOldMessages();

// إنشاء الغرفة الصوتية الافتراضية عند بدء تشغيل السيرفر
const initializeDefaultVoiceRoom = async () => {
  try {
    await getOrCreateDefaultVoiceRoom();
    console.log('🎤 Default voice room initialized');
  } catch (error) {
    console.error('❌ Error initializing default voice room:', error);
  }
};

initializeDefaultVoiceRoom();


// نظام حذف رسائل الغرفة الصوتية كل 10 دقائق
setInterval(async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // حذف الرسائل القديمة من جميع الغرف الصوتية
    const rooms = await VoiceRoom.find({});
    let totalDeleted = 0;

    for (const room of rooms) {
      const initialCount = room.textMessages.length;
      room.textMessages = room.textMessages.filter(
        message => message.timestamp > tenMinutesAgo
      );
      const deletedCount = initialCount - room.textMessages.length;
      totalDeleted += deletedCount;

      if (deletedCount > 0) {
        await room.save();
      }
    }

    if (totalDeleted > 0) {
      console.log(`🗑️ تم حذف ${totalDeleted} رسالة قديمة من الغرف الصوتية`);
    }
  } catch (error) {
    console.error('خطأ في حذف رسائل الغرف الصوتية:', error);
  }
}, 10 * 60 * 1000); // كل 10 دقائق

// معالجة الإشارات لضمان إغلاق آمن للتطبيق
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // إغلاق خادم HTTP
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // إغلاق خادم WebSocket
  wss.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // إغلاق اتصال MongoDB (Mongoose 7+ لا يقبل callback)
  mongoose.connection.close().then(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Error closing MongoDB connection:', error);
    process.exit(1);
  });
  
  // إجبار الإغلاق بعد 10 ثوانٍ إذا لم يتم الإغلاق بشكل طبيعي
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// استماع لإشارات الإغلاق
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('📅 Message cleanup scheduled: Daily at 2:00 AM (messages older than 3 days will be deleted)');
  console.log('🗑️ Voice room messages auto-delete every 10 minutes');
  console.log('👥 Voice room capacity: 100 users');
});