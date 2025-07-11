# 🎮 InfinityBox25 - منصة الألعاب التفاعلية مع المحادثة الصوتية

## 📖 الوصف
منصة ألعاب تفاعلية متطورة تتضمن لعبة تخمين الحيوانات مع نظام محادثة صوتية مباشرة باستخدام تقنية Agora، وميزات اجتماعية متقدمة.

## ✨ الميزات الرئيسية

### 🎯 الألعاب
- 🦁 لعبة تخمين الحيوانات التفاعلية
- 🎲 نظام نقاط ومستويات متقدم
- 🏆 إنجازات وتحديات يومية
- 📊 إحصائيات مفصلة للأداء

### 🎤 المحادثة الصوتية
- 🔊 محادثة صوتية عالية الجودة مع Agora RTC
- 🎙️ كشف النشاط الصوتي في الوقت الفعلي
- 🔇 تحكم في كتم/إلغاء كتم المايك
- 👥 دعم محادثات جماعية متعددة المستخدمين
- 🌍 دعم عالمي مع خوادم موزعة

### 👥 الميزات الاجتماعية
- 📝 ملفات شخصية مخصصة
- 💬 دردشة نصية مباشرة
- 🏠 غرف صوتية متعددة
- 👑 نظام إدارة الغرف
- 📱 تصميم متجاوب لجميع الأجهزة

### 🔐 الأمان والمصادقة
- 🛡️ نظام مصادقة JWT آمن
- 🔑 إدارة tokens ديناميكية لـ Agora
- 🚫 حماية من CORS والهجمات الشائعة
- 📊 تسجيل شامل للأنشطة

## 🛠️ التقنيات المستخدمة

### Frontend
- **React 18** + **TypeScript** - واجهة مستخدم تفاعلية
- **Tailwind CSS** - تصميم عصري ومتجاوب
- **Agora RTC SDK** - محادثة صوتية عالية الجودة
- **WebSocket** - اتصال مباشر للدردشة
- **Vite** - أداة بناء سريعة

### Backend
- **Node.js** + **Express** - خادم API قوي
- **MongoDB** + **Mongoose** - قاعدة بيانات مرنة
- **Agora Token Server** - إدارة آمنة للـ tokens
- **WebSocket** - اتصالات مباشرة
- **JWT** - مصادقة آمنة

### DevOps
- **Docker** - حاويات للنشر
- **Docker Compose** - إدارة الخدمات
- **GitHub Actions** - CI/CD (قريباً)

## 🚀 التثبيت والتشغيل

### المتطلبات الأساسية
- **Node.js** 18+ 
- **MongoDB** 4.4+
- **npm** أو **yarn**
- حساب **Agora** (مجاني)

### ⚡ التثبيت السريع

1. **استنساخ المشروع**
```bash
git clone https://github.com/your-username/infinitybox25.git
cd infinitybox25
```

2. **تثبيت التبعيات**
```bash
npm install
```

3. **إعداد متغيرات البيئة**
```bash
cp env.example .env
```

4. **تكوين Agora**
   - أنشئ حساب مجاني في [Agora Console](https://console.agora.io/)
   - أنشئ مشروع جديد
   - انسخ App ID و App Certificate إلى ملف `.env`

5. **بناء وتشغيل المشروع**
```bash
npm run build
npm start
```

6. **افتح المتصفح**
```
http://localhost:5000
```

## 🐳 تشغيل باستخدام Docker

### البناء والتشغيل
```bash
# بناء الصورة
docker build -t infinitybox25-agora:latest .

# تشغيل الحاوية
docker run -d -p 5001:5000 --name infinitybox25-container infinitybox25-agora:latest
```

### استخدام Docker Compose
```bash
docker-compose up -d
```

## 🔧 إعداد Agora

### 1. إنشاء مشروع Agora
1. اذهب إلى [Agora Console](https://console.agora.io/)
2. أنشئ حساب مجاني
3. أنشئ مشروع جديد
4. اختر "Secure Mode" للإنتاج أو "Testing Mode" للتطوير

### 2. الحصول على المفاتيح
```bash
# في ملف .env
AGORA_APP_ID=your-app-id-here
AGORA_APP_CERTIFICATE=your-app-certificate-here
```

### 3. اختبار الاتصال
- اذهب إلى `/agora-test` لاختبار المحادثة الصوتية
- تأكد من عمل المايك والسماعات

## 📁 هيكل المشروع

```
infinitybox25/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # مكونات React
│   │   ├── services/       # خدمات API و Agora
│   │   └── types/          # تعريفات TypeScript
├── server.js              # خادم Express الرئيسي
├── package.json           # تبعيات المشروع
├── Dockerfile            # إعداد Docker
├── docker-compose.yml    # إعداد Docker Compose
└── README.md             # هذا الملف
```

## 🎮 كيفية اللعب

### لعبة الحيوانات
1. سجل دخول أو أنشئ حساب جديد
2. اختر لعبة الحيوانات من القائمة الرئيسية
3. شاهد صورة الحيوان واختر الاسم الصحيح
4. اجمع النقاط وارتقِ في المستويات

### المحادثة الصوتية
1. اذهب إلى قسم "الغرف الصوتية"
2. اختر غرفة أو أنشئ غرفة جديدة
3. اضغط على مقعد للانضمام
4. تحدث مع اللاعبين الآخرين

## 🔧 التطوير

### تشغيل في وضع التطوير
```bash
# تشغيل الخادم
npm run dev

# تشغيل Frontend (في terminal منفصل)
cd client
npm run dev
```

### بناء للإنتاج
```bash
npm run build
```

### اختبار الجودة
```bash
npm run test
npm run lint
```

## 🤝 المساهمة

نرحب بجميع المساهمات! يرجى:

1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى Branch (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## 📝 التحديثات القادمة

- [ ] 🎵 مؤثرات صوتية للألعاب
- [ ] 📹 دعم الفيديو في المحادثات
- [ ] 🏅 نظام بطولات وتحديات
- [ ] 🌐 دعم لغات متعددة
- [ ] 📱 تطبيق موبايل

## 🐛 الإبلاغ عن المشاكل

إذا واجهت أي مشكلة، يرجى:
1. التحقق من [Issues الموجودة](https://github.com/your-username/infinitybox25/issues)
2. إنشاء Issue جديد مع تفاصيل المشكلة
3. تضمين معلومات النظام والمتصفح

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

## 👨‍💻 المطور

تم تطوير هذا المشروع بواسطة فريق InfinityBox25

---

⭐ إذا أعجبك المشروع، لا تنس إعطاؤه نجمة على GitHub!
