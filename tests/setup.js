// إعداد الاختبارات
const mongoose = require('mongoose');

// إعداد المهلة الزمنية للاختبارات
jest.setTimeout(30000);

// إعداد متغيرات البيئة للاختبار
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/infinitybox_test';

// تنظيف قاعدة البيانات قبل كل اختبار
beforeEach(async () => {
  // يمكن إضافة تنظيف إضافي هنا إذا لزم الأمر
});

// إغلاق الاتصالات بعد الاختبارات
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// تجاهل تحذيرات معينة
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes('DeprecationWarning')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// إعداد مساعدات الاختبار
global.testHelpers = {
  // إنشاء مستخدم اختبار
  createTestUser: (overrides = {}) => ({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    gender: 'male',
    ...overrides
  }),

  // إنشاء بيانات لعبة اختبار
  createGameData: (overrides = {}) => ({
    balanceChange: 100,
    gameType: 'test_game',
    sessionId: `test_${Date.now()}`,
    gameResult: {
      winAmount: 100,
      lossAmount: 0,
      playerScore: 100
    },
    ...overrides
  }),

  // إنشاء بيانات هدية اختبار
  createGiftData: (toUserId, overrides = {}) => ({
    toUserId,
    giftType: 'gold',
    amount: 50,
    message: 'هدية اختبار',
    ...overrides
  }),

  // إنشاء بيانات رسالة اختبار
  createMessageData: (recipientId, overrides = {}) => ({
    recipientId,
    content: 'رسالة اختبار',
    messageType: 'text',
    ...overrides
  }),

  // انتظار لفترة قصيرة
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // إنشاء توكن اختبار
  createTestToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, username: 'testuser' },
      process.env.JWT_SECRET || 'test_secret_key',
      { expiresIn: '1h' }
    );
  }
};

console.log('🧪 إعداد الاختبارات جاهز');
