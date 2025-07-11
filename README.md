# تطبيق الويب التفاعلي

تطبيق ويب شامل يتضمن واجهة مستخدم تفاعلية وخادم خلفي مع دعم الدردشة الصوتية.

## 🚀 المميزات

- **واجهة مستخدم تفاعلية** - React + TypeScript
- **خادم خلفي قوي** - Express.js + MongoDB
- **دردشة صوتية** - WebSocket + WebRTC
- **نظام مصادقة** - JWT + bcrypt
- **إدارة المستخدمين** - ملفات شخصية + أصدقاء
- **نظام العملات** - عملات افتراضية + هدايا
- **ألعاب تفاعلية** - ألعاب متنوعة
- **واجهة إدارية** - لوحة تحكم للمديرين

## 🛠️ التقنيات المستخدمة

### الفرونت إند
- **React 18** - مكتبة واجهة المستخدم
- **TypeScript** - لغة البرمجة الآمنة
- **Vite** - أداة البناء السريعة
- **Tailwind CSS** - إطار العمل للتصميم
- **Radix UI** - مكونات واجهة المستخدم
- **Framer Motion** - الرسوم المتحركة

### الباك إند
- **Express.js** - إطار العمل للخادم
- **MongoDB** - قاعدة البيانات
- **Mongoose** - ODM لقاعدة البيانات
- **WebSocket** - للاتصال المباشر
- **JWT** - للمصادقة
- **bcrypt** - لتشفير كلمات المرور

### النشر
- **Docker** - حاويات البرامج
- **Nginx** - خادم الويب العكسي
- **Docker Compose** - إدارة الخدمات

## 📦 التثبيت والتشغيل

### المتطلبات
- Node.js 18+
- npm أو yarn
- Docker (اختياري للنشر)

### التثبيت المحلي

1. **استنساخ المشروع**
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

2. **تثبيت التبعيات**
```bash
npm install
```

3. **إعداد متغيرات البيئة**
```bash
cp .env.example .env
# عدّل ملف .env بإعداداتك
```

4. **تشغيل التطبيق**
```bash
# للتطوير
npm run dev

# للإنتاج
npm run build
npm start
```

### النشر مع Docker

1. **بناء وتشغيل التطبيق**
```bash
# مع Nginx
docker-compose -f docker-compose-with-nginx.yml up -d

# بدون Nginx
docker-compose up -d
```

2. **الوصول للتطبيق**
```
http://localhost
```

## 🔧 الأوامر المتاحة

```bash
# التطوير
npm run dev          # تشغيل خادم التطوير
npm run build        # بناء التطبيق للإنتاج
npm run check        # فحص TypeScript

# Docker
docker-compose up -d                    # تشغيل التطبيق
docker-compose -f docker-compose-with-nginx.yml up -d  # مع Nginx
docker-compose down                     # إيقاف التطبيق

# الإدارة
npm run create-admin  # إنشاء حساب مدير
```

## 📁 بنية المشروع

```
proj/
├── client/                 # الفرونت إند (React)
│   ├── src/
│   │   ├── components/    # مكونات React
│   │   ├── services/      # خدمات API
│   │   └── types/         # أنواع TypeScript
│   └── public/            # الملفات الثابتة
├── dist/                  # ملفات البناء النهائية
├── server.js              # خادم Express
├── package.json           # تبعيات المشروع
├── vite.config.ts         # إعدادات Vite
├── Dockerfile             # صورة Docker للتطبيق
├── Dockerfile.nginx       # صورة Docker لـ Nginx
└── docker-compose.yml     # إعدادات Docker Compose
```

## 🌐 النشر

### Render (موصى به)
- يدعم Docker
- مجاني للمشاريع الصغيرة
- سهل الإعداد

### Railway
- يدعم Node.js
- مجاني للمشاريع الصغيرة
- إعداد سريع

### Vercel (للفرونت إند فقط)
- ممتاز للفرونت إند
- يحتاج خادم منفصل للباك إند

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ فرع جديد (`git checkout -b feature/amazing-feature`)
3. اكتب التغييرات (`git commit -m 'Add amazing feature'`)
4. ادفع للفرع (`git push origin feature/amazing-feature`)
5. أنشئ Pull Request

## 📄 الرخصة

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## 📞 الدعم

إذا واجهت أي مشكلة، يرجى إنشاء issue في GitHub أو التواصل معنا.

---

**تم التطوير بـ ❤️ باستخدام React و Express.js**
# infinity-box225
# infinity-box225
# infinity-box225
