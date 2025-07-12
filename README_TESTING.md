# 🧪 دليل الاختبار والتشغيل - INFINITY BOX

## 🚀 التشغيل السريع

### 1. تثبيت المتطلبات
```bash
# تثبيت dependencies
npm install

# تثبيت dependencies الاختبارات
npm install --save-dev jest supertest @babel/preset-env babel-jest
```

### 2. إعداد قاعدة البيانات
```bash
# تشغيل MongoDB
mongod

# إنشاء قاعدة بيانات الاختبار
mongo
use infinitybox_test
```

### 3. تشغيل الخادم
```bash
# تشغيل عادي
npm start

# تشغيل للتطوير
npm run dev
```

## 🧪 تشغيل الاختبارات

### اختبارات شاملة
```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل مع مراقبة التغييرات
npm run test:watch

# تشغيل مع تقرير التغطية
npm run test:coverage

# تشغيل اختبارات التكامل فقط
npm run test:integration
```

### اختبارات محددة
```bash
# اختبار نظام المصادقة
npm test -- --testNamePattern="نظام المصادقة"

# اختبار نظام الأرصدة
npm test -- --testNamePattern="نظام الأرصدة"

# اختبار نظام الهدايا
npm test -- --testNamePattern="نظام الهدايا"
```

## 📊 مراقبة النظام

### endpoints المراقبة
```bash
# فحص صحة النظام
curl http://localhost:3000/health

# إحصائيات النظام (للمديرين)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/system-metrics

# إحصائيات الكاش
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/cache-stats

# البيانات الفورية
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/analytics/realtime
```

### إدارة النسخ الاحتياطية
```bash
# قائمة النسخ الاحتياطية
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/backups

# إنشاء نسخة احتياطية فورية
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/backup/create

# استعادة من نسخة احتياطية (خطير!)
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"backupId":"backup_123456789","confirmationCode":"RESTORE_CONFIRM_2024"}' \
     http://localhost:3000/api/admin/backup/restore
```

## 🔧 أدوات التطوير

### تنظيف الكاش
```bash
# مسح جميع الكاش
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"target":"all"}' \
     http://localhost:3000/api/admin/cache-clear

# مسح كاش مستخدم محدد
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"target":"user","userId":"USER_ID"}' \
     http://localhost:3000/api/admin/cache-clear
```

### تسجيل أحداث مخصصة
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"category":"test","action":"custom_event","label":"test_label","value":100}' \
     http://localhost:3000/api/analytics/track
```

## 📈 تقارير الأداء

### مقاييس الأداء المتوقعة
- **تحديث الرصيد**: < 200ms
- **إرسال الرسائل**: < 100ms
- **تحديث البروفايل**: < 300ms
- **جلب البيانات**: < 150ms

### مقاييس الموثوقية
- **نجاح المعاملات**: > 99.9%
- **تزامن البيانات**: 100%
- **وقت التشغيل**: > 99.5%
- **دقة البيانات**: > 99.99%

## 🐛 استكشاف الأخطاء

### مشاكل شائعة وحلولها

#### 1. فشل الاتصال بقاعدة البيانات
```bash
# التحقق من تشغيل MongoDB
sudo systemctl status mongod

# إعادة تشغيل MongoDB
sudo systemctl restart mongod

# فحص الاتصال
mongo --eval "db.adminCommand('ismaster')"
```

#### 2. فشل الاختبارات
```bash
# تنظيف قاعدة بيانات الاختبار
mongo infinitybox_test --eval "db.dropDatabase()"

# إعادة تثبيت dependencies
rm -rf node_modules package-lock.json
npm install

# تشغيل اختبار واحد للتشخيص
npm test -- --testNamePattern="تسجيل مستخدم جديد"
```

#### 3. مشاكل الأداء
```bash
# فحص استخدام الذاكرة
node --inspect server.js

# مراقبة العمليات
top -p $(pgrep node)

# فحص إحصائيات الكاش
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/cache-stats
```

#### 4. مشاكل التزامن
```bash
# فحص WebSocket connections
netstat -an | grep :3000

# مراقبة الأحداث الفورية
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/admin/analytics/realtime

# فحص سجلات الأخطاء
tail -f logs/error.log
```

## 📝 سجلات النظام

### مواقع السجلات
- **سجلات عامة**: `console.log`
- **سجلات الأخطاء**: `console.error`
- **سجلات التحليلات**: `analytics/`
- **سجلات النسخ الاحتياطية**: `backups/`

### مستويات السجلات
- **INFO**: معلومات عامة
- **WARN**: تحذيرات
- **ERROR**: أخطاء
- **DEBUG**: تفاصيل التطوير

## 🔒 اختبارات الأمان

### فحص الثغرات
```bash
# فحص dependencies
npm audit

# إصلاح الثغرات
npm audit fix

# فحص متقدم
npm audit --audit-level high
```

### اختبار حدود الطلبات
```bash
# اختبار rate limiting
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"username":"test","password":"wrong"}' &
done
```

## 📊 تقارير التغطية

### عرض تقرير التغطية
```bash
# إنشاء تقرير التغطية
npm run test:coverage

# عرض التقرير في المتصفح
open coverage/lcov-report/index.html
```

### أهداف التغطية
- **الخطوط**: > 80%
- **الدوال**: > 85%
- **الفروع**: > 75%
- **البيانات**: > 90%

## 🎯 نصائح للتطوير

### أفضل الممارسات
1. **تشغيل الاختبارات قبل كل commit**
2. **مراقبة الأداء باستمرار**
3. **فحص السجلات بانتظام**
4. **إنشاء نسخ احتياطية دورية**

### أدوات مفيدة
- **Postman**: لاختبار APIs
- **MongoDB Compass**: لإدارة قاعدة البيانات
- **Node Inspector**: لتشخيص الأداء
- **Artillery**: لاختبار الحمولة

## 📞 الدعم

### في حالة المشاكل
1. راجع السجلات أولاً
2. تحقق من حالة النظام
3. شغل الاختبارات للتشخيص
4. راجع الوثائق

### معلومات الاتصال
- **الوثائق**: `SYNC_IMPROVEMENTS.md`
- **الاختبارات**: `tests/comprehensive-tests.js`
- **الإعداد**: `tests/setup.js`

---

**🎉 نظام محسن وجاهز للإنتاج!**

*تم إعداده بواسطة: Augment Agent*
