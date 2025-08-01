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

// middleware للمصادقة
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'infinitybox_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
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

// تحديث الملف الشخصي للمستخدم الحالي
app.put('/api/profile/update', authenticateToken, async (req, res) => {
  try {
    const { profileImage, gender, username, email } = req.body;

    console.log('🔄 Profile update request for user:', req.user.userId);
    console.log('📝 Update data:', {
      hasProfileImage: !!profileImage,
      gender,
      username,
      email
    });

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث البيانات المرسلة فقط
    if (profileImage !== undefined) {
      user.profileImage = profileImage;
      console.log('📸 Profile image updated');
    }

    if (gender !== undefined) {
      user.gender = gender;
      console.log('👤 Gender updated to:', gender);
    }

    if (username !== undefined) {
      // التحقق من عدم وجود اسم المستخدم مع مستخدم آخر
      const existingUser = await User.findOne({ username, _id: { $ne: req.user.userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
      }
      user.username = username;
      console.log('📝 Username updated to:', username);
    }

    if (email !== undefined) {
      // التحقق من عدم وجود البريد الإلكتروني مع مستخدم آخر
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'البريد الإلكتروني موجود بالفعل' });
      }
      user.email = email;
      console.log('📧 Email updated to:', email);
    }

    // حفظ التغييرات
    await user.save();
    console.log('✅ Profile updated successfully for user:', user.username);

    // إرجاع البيانات المحدثة
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
    console.error('❌ Profile update error:', error);
    res.status(500).json({ message: 'خطأ في تحديث الملف الشخصي' });
  }
});

// جلب البيانات الكاملة للمستخدم الحالي
app.get('/api/profile/me', authenticateToken, async (req, res) => {
  try {
    console.log('📡 GET /api/profile/me called for user:', req.user.userId);
    const user = await User.findById(req.user.userId);
    if (!user) {
      console.log('❌ User not found:', req.user.userId);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    console.log('✅ User found, sending complete data for:', user.username);

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
      popularity: user.popularity || 0
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
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

// إرسال رسالة
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content, messageType = 'text' } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'معرف المستقبل والمحتوى مطلوبان' });
    }

    // الحصول على بيانات المرسل
    const sender = await User.findById(req.user.userId);
    if (!sender) {
      return res.status(404).json({ message: 'خطأ في بيانات المرسل' });
    }

    // تحديد ما إذا كان recipientId هو ObjectId أم Player ID
    let recipient;
    if (mongoose.Types.ObjectId.isValid(recipientId)) {
      recipient = await User.findById(recipientId);
    } else {
      recipient = await User.findOne({ playerId: recipientId });
    }

    if (!recipient) {
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    const message = new Message({
      sender: req.user.userId, // MongoDB ObjectId للتوافق
      senderPlayerId: sender.playerId, // Player ID الصغير
      recipient: recipient._id, // MongoDB ObjectId للتوافق
      recipientPlayerId: recipient.playerId, // Player ID الصغير
      content,
      messageType
    });
    await message.save();

    // لا نرسل إشعار للرسائل العادية - المحادثة متزامنة

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username profileImage playerId')
      .populate('recipient', 'username profileImage playerId');

    // WebSocket سيتم إرساله من العميل بعد نجاح الحفظ

    res.json({
      message: 'تم إرسال الرسالة بنجاح',
      messageData: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'خطأ في إرسال الرسالة' });
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

// إرسال هدية
app.post('/api/profile/send-gift', authenticateToken, async (req, res) => {
  try {
    const { toUserId, giftType, amount, message } = req.body;
    const fromUser = await User.findById(req.user.userId);

    if (!fromUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'المستخدم المستهدف غير موجود' });
    }

    // التحقق من الرصيد
    if (giftType === 'gold' && fromUser.goldCoins < amount) {
      return res.status(400).json({ message: 'رصيد العملات الذهبية غير كافي' });
    }

    if (giftType === 'pearls' && fromUser.pearls < amount) {
      return res.status(400).json({ message: 'رصيد اللآلئ غير كافي' });
    }

    // تحويل الهدية
    if (giftType === 'gold') {
      fromUser.goldCoins -= amount;
      toUser.goldCoins += amount;
    } else if (giftType === 'pearls') {
      fromUser.pearls -= amount;
      toUser.pearls += amount;
    }

    await fromUser.save();
    await toUser.save();

    // حفظ سجل الهدية في قاعدة البيانات
    const gift = new Gift({
      sender: req.user.userId,
      recipient: toUserId,
      giftType,
      amount,
      message,
      status: 'sent'
    });
    await gift.save();

    // حفظ سجل المعاملات
    const senderTransaction = new Transaction({
      user: req.user.userId,
      type: 'gift_sent',
      amount: -amount,
      currency: giftType,
      description: `هدية مرسلة إلى ${toUser.username}`,
      relatedUser: toUserId
    });

    const recipientTransaction = new Transaction({
      user: toUserId,
      type: 'gift_received',
      amount: amount,
      currency: giftType,
      description: `هدية مستلمة من ${fromUser.username}`,
      relatedUser: req.user.userId
    });

    await senderTransaction.save();
    await recipientTransaction.save();

    // إنشاء إشعار للمستقبل
    await createNotification(
      toUserId,
      'gift_received',
      '🎁 هدية جديدة!',
      `استلمت ${amount} ${giftType === 'gold' ? 'عملة ذهبية' : 'لؤلؤة'} من ${fromUser.username}`,
      {
        giftType,
        amount,
        giftId: gift._id
      },
      req.user.userId
    );

    res.json({
      message: `تم إرسال ${amount} ${giftType === 'gold' ? 'عملة ذهبية' : 'لؤلؤة'} إلى ${toUser.username}`,
      fromUserBalance: {
        goldCoins: fromUser.goldCoins,
        pearls: fromUser.pearls
      },
      giftId: gift._id
    });
  } catch (error) {
    console.error('Send gift error:', error);
    res.status(500).json({ message: 'خطأ في إرسال الهدية' });
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

// تحديث رصيد اللاعب مع تحسينات المزامنة
app.post('/api/users/update-balance', authenticateToken, async (req, res) => {
  try {
    const { balanceChange, gameType, sessionId, gameResult, currentBalance, timestamp } = req.body;
    
    console.log('💰 تحديث الرصيد:', {
      userId: req.user.userId,
      balanceChange,
      gameType,
      sessionId,
      currentBalance,
      timestamp: new Date(timestamp)
    });

    const user = await User.findById(req.user.userId);

    if (!user) {
      console.error('❌ المستخدم غير موجود:', req.user.userId);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من صحة التغيير
    const currentServerBalance = user.goldCoins || 0;
    const newBalance = currentServerBalance + balanceChange;
    
    if (newBalance < 0) {
      console.error('❌ رصيد غير كافي:', {
        currentBalance: currentServerBalance,
        change: balanceChange,
        newBalance
      });
      return res.status(400).json({ 
        message: 'رصيد غير كافي',
        currentBalance: currentServerBalance,
        requiredChange: balanceChange
      });
    }

    // التحقق من التزامن إذا تم إرسال الرصيد الحالي
    if (currentBalance !== undefined && Math.abs(currentServerBalance - currentBalance) > 0.01) {
      console.warn('⚠️ اختلاف في الرصيد:', {
        clientBalance: currentBalance,
        serverBalance: currentServerBalance,
        difference: currentServerBalance - currentBalance
      });
      
      // إرجاع الرصيد الحالي من الخادم للتصحيح
      return res.status(409).json({
        message: 'اختلاف في الرصيد، يرجى التحديث',
        currentBalance: currentServerBalance,
        clientBalance: currentBalance,
        needsSync: true
      });
    }

    // تحديث الرصيد مع التحقق من التزامن
    const updateResult = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        $set: { goldCoins: newBalance },
        $inc: { 
          totalGamesPlayed: 1,
          totalCoinsEarned: Math.max(0, balanceChange),
          totalCoinsSpent: Math.abs(Math.min(0, balanceChange))
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!updateResult) {
      throw new Error('فشل في تحديث الرصيد في قاعدة البيانات');
    }

    // حفظ إحصائيات اللعبة
    const gameStats = new GameStats({
      userId: req.user.userId,
      gameType: gameType,
      sessionId: sessionId,
      startTime: new Date(timestamp || Date.now()),
      betAmount: gameResult?.lossAmount || 0,
      winAmount: gameResult?.winAmount || 0,
      lossAmount: gameResult?.lossAmount || 0,
      netResult: balanceChange,
      playerScore: gameResult?.playerScore || 0,
      skillFactor: gameResult?.skillFactor || 0,
      economicFactor: gameResult?.economicFactor || 0,
      winProbability: gameResult?.probability || 0,
      isWin: balanceChange > 0
    });

    await gameStats.save();

    console.log('✅ تم تحديث الرصيد بنجاح:', {
      userId: req.user.userId,
      oldBalance: currentServerBalance,
      change: balanceChange,
      newBalance: newBalance,
      gameType
    });

    res.json({
      success: true,
      newBalance: newBalance,
      change: balanceChange,
      timestamp: Date.now(),
      confirmed: true
    });

  } catch (error) {
    console.error('❌ خطأ في تحديث الرصيد:', error);
    res.status(500).json({ 
      message: 'خطأ في تحديث الرصيد',
      error: error.message 
    });
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
      experience: user.experience || 0,
      totalGamesPlayed: user.totalGamesPlayed || 0,
      totalCoinsEarned: user.totalCoinsEarned || 0,
      totalCoinsSpent: user.totalCoinsSpent || 0,
      lastUpdated: user.updatedAt
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات الملف الشخصي:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات الملف الشخصي' });
  }
});

// التحقق من صحة الرصيد
app.get('/api/users/balance/validate', authenticateToken, async (req, res) => {
  try {
    const { currentBalance } = req.query;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const serverBalance = user.goldCoins || 0;
    const clientBalance = parseFloat(currentBalance) || 0;
    const difference = Math.abs(serverBalance - clientBalance);

    const needsSync = difference > 0.01;

    console.log('🔍 التحقق من الرصيد:', {
      userId: req.user.userId,
      clientBalance,
      serverBalance,
      difference,
      needsSync
    });

    res.json({
      needsSync,
      serverBalance,
      clientBalance,
      difference,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ خطأ في التحقق من الرصيد:', error);
    res.status(500).json({ message: 'خطأ في التحقق من الرصيد' });
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

// إعداد WebSocket على المسار /ws
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// تخزين معلومات العملاء المتصلين
const connectedClients = new Map(); // userId -> { socket, currentRoomId, userInfo }

wss.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected');
  socket.send(JSON.stringify({ type: 'connection_established' }));

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
          currentRoomId: null
        });
        console.log(`👤 User ${currentUserId} connected via WebSocket`);
      }

      // رسائل المحادثة الخاصة
      if (message.type === 'private_message') {
        // رسالة خاصة - بث للجميع (سيتم تصفيتها في العميل)
        const broadcastMessage = {
          type: 'new_message',
          messageData: message.data.messageData,
          recipientId: message.data.recipientId,
          senderId: message.data.messageData.sender._id
        };

        console.log('📤 Broadcasting message to all clients:', {
          recipientId: broadcastMessage.recipientId,
          senderId: broadcastMessage.senderId,
          content: message.data.messageData.content
        });

        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(broadcastMessage));
            sentCount++;
          }
        });

        console.log(`📡 Message sent to ${sentCount} connected clients`);
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