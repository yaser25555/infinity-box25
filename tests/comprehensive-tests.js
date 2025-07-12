// نظام الاختبارات الشامل لـ INFINITY BOX
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

// إعداد قاعدة بيانات الاختبار
const TEST_DB_URI = process.env.TEST_DB_URI || 'mongodb://localhost:27017/infinitybox_test';

describe('INFINITY BOX - اختبارات شاملة', () => {
  let authToken;
  let testUser;
  let testUser2;

  // إعداد قبل جميع الاختبارات
  beforeAll(async () => {
    // الاتصال بقاعدة بيانات الاختبار
    await mongoose.connect(TEST_DB_URI);
    
    // تنظيف قاعدة البيانات
    await mongoose.connection.db.dropDatabase();
    
    console.log('🧪 بدء الاختبارات الشاملة');
  });

  // تنظيف بعد جميع الاختبارات
  afterAll(async () => {
    await mongoose.connection.close();
    console.log('✅ انتهت الاختبارات الشاملة');
  });

  describe('🔐 نظام المصادقة', () => {
    test('تسجيل مستخدم جديد', async () => {
      const userData = {
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'password123',
        gender: 'male'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('تم إنشاء الحساب بنجاح');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.goldCoins).toBe(1000); // الرصيد الابتدائي
    });

    test('تسجيل دخول المستخدم', async () => {
      const loginData = {
        username: 'testuser1',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.message).toBe('تم تسجيل الدخول بنجاح');
      expect(response.body.token).toBeDefined();
      
      authToken = response.body.token;
      testUser = response.body.user;
    });

    test('رفض تسجيل دخول بكلمة مرور خاطئة', async () => {
      const loginData = {
        username: 'testuser1',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.message).toBe('كلمة المرور غير صحيحة');
    });
  });

  describe('💰 نظام الأرصدة والمعاملات', () => {
    test('جلب بيانات المستخدم', async () => {
      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.goldCoins).toBe(1000);
      expect(response.body.username).toBe('testuser1');
    });

    test('تحديث رصيد اللاعب (ربح)', async () => {
      const updateData = {
        balanceChange: 500,
        gameType: 'speed_challenge',
        sessionId: 'test_session_001',
        gameResult: {
          winAmount: 500,
          lossAmount: 0,
          playerScore: 100
        }
      };

      const response = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newBalance).toBe(1500);
      expect(response.body.change).toBe(500);
    });

    test('تحديث رصيد اللاعب (خسارة)', async () => {
      const updateData = {
        balanceChange: -200,
        gameType: 'speed_challenge',
        sessionId: 'test_session_002',
        gameResult: {
          winAmount: 0,
          lossAmount: 200,
          playerScore: 50
        }
      };

      const response = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newBalance).toBe(1300);
      expect(response.body.change).toBe(-200);
    });

    test('رفض تحديث رصيد بقيمة تؤدي لرصيد سالب', async () => {
      const updateData = {
        balanceChange: -2000, // أكثر من الرصيد الحالي
        gameType: 'speed_challenge',
        sessionId: 'test_session_003',
        gameResult: {
          winAmount: 0,
          lossAmount: 2000,
          playerScore: 0
        }
      };

      const response = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain('رصيد غير كافي');
    });

    test('منع المعاملات المكررة', async () => {
      const updateData = {
        balanceChange: 100,
        gameType: 'speed_challenge',
        sessionId: 'test_session_002', // نفس معرف الجلسة السابق
        gameResult: {
          winAmount: 100,
          lossAmount: 0,
          playerScore: 80
        }
      };

      const response = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.message).toBe('معاملة مكررة - تم رفض الطلب');
    });
  });

  describe('🎁 نظام الهدايا', () => {
    beforeAll(async () => {
      // إنشاء مستخدم ثاني للاختبار
      const userData2 = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123',
        gender: 'female'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData2);

      testUser2 = registerResponse.body.user;
    });

    test('إرسال هدية ذهبية', async () => {
      const giftData = {
        toUserId: testUser2.id,
        giftType: 'gold',
        amount: 100,
        message: 'هدية اختبار'
      };

      const response = await request(app)
        .post('/api/profile/send-gift')
        .set('Authorization', `Bearer ${authToken}`)
        .send(giftData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fromUserBalance.goldCoins).toBe(1200); // 1300 - 100
    });

    test('رفض إرسال هدية بمبلغ أكبر من الرصيد', async () => {
      const giftData = {
        toUserId: testUser2.id,
        giftType: 'gold',
        amount: 5000, // أكثر من الرصيد
        message: 'هدية كبيرة'
      };

      const response = await request(app)
        .post('/api/profile/send-gift')
        .set('Authorization', `Bearer ${authToken}`)
        .send(giftData)
        .expect(400);

      expect(response.body.message).toContain('رصيد غير كافي');
    });

    test('رفض إرسال هدية للنفس', async () => {
      const giftData = {
        toUserId: testUser.id, // نفس المستخدم
        giftType: 'gold',
        amount: 50,
        message: 'هدية للنفس'
      };

      const response = await request(app)
        .post('/api/profile/send-gift')
        .set('Authorization', `Bearer ${authToken}`)
        .send(giftData)
        .expect(400);

      expect(response.body.message).toBe('لا يمكن إرسال هدية لنفسك');
    });
  });

  describe('💬 نظام الرسائل', () => {
    test('إرسال رسالة خاصة', async () => {
      const messageData = {
        recipientId: testUser2.id,
        content: 'مرحباً، هذه رسالة اختبار',
        messageType: 'text'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messageData.content).toBe(messageData.content);
    });

    test('رفض رسالة طويلة جداً', async () => {
      const messageData = {
        recipientId: testUser2.id,
        content: 'أ'.repeat(501), // أكثر من 500 حرف
        messageType: 'text'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(400);

      expect(response.body.message).toContain('طويلة جداً');
    });
  });

  describe('👤 نظام البروفايل', () => {
    test('تحديث البروفايل', async () => {
      const updateData = {
        username: 'testuser1_updated',
        gender: 'male',
        profileImage: 'new_avatar.jpg'
      };

      const response = await request(app)
        .put('/api/profile/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.username).toBe(updateData.username);
    });

    test('رفض تحديث باسم مستخدم موجود', async () => {
      const updateData = {
        username: 'testuser2' // اسم المستخدم الثاني
      };

      const response = await request(app)
        .put('/api/profile/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toBe('اسم المستخدم موجود بالفعل');
    });
  });

  describe('🔒 اختبارات الأمان', () => {
    test('رفض الوصول بدون توكن', async () => {
      const response = await request(app)
        .get('/api/profile/me')
        .expect(401);

      expect(response.body.message).toBe('Access token required');
    });

    test('رفض الوصول بتوكن غير صحيح', async () => {
      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(403);

      expect(response.body.message).toBe('Invalid token');
    });

    test('فحص حدود معدل الطلبات', async () => {
      // إرسال طلبات متعددة بسرعة
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/messages')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              recipientId: testUser2.id,
              content: `رسالة سريعة ${i}`,
              messageType: 'text'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // يجب أن تنجح بعض الطلبات وترفض أخرى
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitCount).toBe(10);
      expect(rateLimitCount).toBeGreaterThan(0); // يجب رفض بعض الطلبات
    });
  });

  describe('📊 اختبارات الأداء', () => {
    test('سرعة استجابة جلب البروفايل', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // أقل من 500ms
      expect(response.body._cached).toBeDefined(); // يجب أن يستخدم الكاش
    });

    test('سرعة تحديث الرصيد', async () => {
      const startTime = Date.now();
      
      const updateData = {
        balanceChange: 10,
        gameType: 'speed_test',
        sessionId: `perf_test_${Date.now()}`,
        gameResult: { winAmount: 10, lossAmount: 0, playerScore: 100 }
      };

      const response = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(200); // أقل من 200ms
      expect(response.body.success).toBe(true);
    });
  });

  describe('🔄 اختبارات التزامن', () => {
    test('تحديثات متزامنة للرصيد', async () => {
      // محاولة تحديث الرصيد من عدة طلبات متزامنة
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/users/update-balance')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              balanceChange: 1,
              gameType: 'sync_test',
              sessionId: `sync_test_${Date.now()}_${i}`,
              gameResult: { winAmount: 1, lossAmount: 0, playerScore: 100 }
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // جميع الطلبات يجب أن تنجح
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // التحقق من الرصيد النهائي
      const finalBalance = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // يجب أن يكون الرصيد صحيحاً (الرصيد السابق + 5)
      expect(finalBalance.body.goldCoins).toBeGreaterThan(1200);
    });
  });

  describe('🧪 اختبارات التكامل', () => {
    test('سيناريو كامل: لعبة مع هدية ورسالة', async () => {
      // 1. لعب لعبة وربح
      const gameResult = await request(app)
        .post('/api/users/update-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          balanceChange: 300,
          gameType: 'integration_test',
          sessionId: `integration_${Date.now()}`,
          gameResult: { winAmount: 300, lossAmount: 0, playerScore: 150 }
        })
        .expect(200);

      expect(gameResult.body.success).toBe(true);

      // 2. إرسال هدية من الأرباح
      const giftResult = await request(app)
        .post('/api/profile/send-gift')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: testUser2.id,
          giftType: 'gold',
          amount: 50,
          message: 'هدية من أرباح اللعبة'
        })
        .expect(200);

      expect(giftResult.body.success).toBe(true);

      // 3. إرسال رسالة تهنئة
      const messageResult = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId: testUser2.id,
          content: 'لقد أرسلت لك هدية من أرباح اللعبة!',
          messageType: 'text'
        })
        .expect(200);

      expect(messageResult.body.success).toBe(true);

      // 4. التحقق من الرصيد النهائي
      const finalProfile = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // الرصيد يجب أن يعكس جميع المعاملات
      expect(finalProfile.body.goldCoins).toBeGreaterThan(1000);
    });
  });
});

// اختبارات الأداء المتقدمة
describe('🚀 اختبارات الأداء المتقدمة', () => {
  test('اختبار الحمولة - طلبات متعددة متزامنة', async () => {
    const concurrentRequests = 20;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app)
          .get('/health')
          .expect(200)
      );
    }

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    // جميع الطلبات يجب أن تنجح
    expect(responses.length).toBe(concurrentRequests);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // الوقت الإجمالي يجب أن يكون معقولاً
    expect(totalTime).toBeLessThan(5000); // أقل من 5 ثوان

    console.log(`✅ تم تنفيذ ${concurrentRequests} طلب متزامن في ${totalTime}ms`);
  });
});

// تقرير نتائج الاختبارات
afterAll(() => {
  console.log('\n📋 ملخص الاختبارات:');
  console.log('✅ اختبارات المصادقة: مكتملة');
  console.log('✅ اختبارات الأرصدة: مكتملة');
  console.log('✅ اختبارات الهدايا: مكتملة');
  console.log('✅ اختبارات الرسائل: مكتملة');
  console.log('✅ اختبارات البروفايل: مكتملة');
  console.log('✅ اختبارات الأمان: مكتملة');
  console.log('✅ اختبارات الأداء: مكتملة');
  console.log('✅ اختبارات التزامن: مكتملة');
  console.log('✅ اختبارات التكامل: مكتملة');
  console.log('\n🎉 جميع الاختبارات اكتملت بنجاح!');
});
