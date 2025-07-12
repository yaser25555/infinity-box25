# Dockerfile محسن لـ INFINITY BOX على Render
FROM node:18-alpine

# إضافة metadata
LABEL maintainer="INFINITY BOX Team"
LABEL description="INFINITY BOX - Gaming Platform with Real-time Sync"

# تثبيت dependencies النظام الأساسية فقط
RUN apk add --no-cache python3 make g++

# تعيين مجلد العمل
WORKDIR /app

# إنشاء مستخدم غير root للأمان
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# نسخ ملفات التبعيات أولاً للاستفادة من Docker layer caching
COPY package*.json ./

# تثبيت dependencies
RUN npm install --silent

# نسخ ملفات المشروع
COPY --chown=nextjs:nodejs . .

# إنشاء المجلدات المطلوبة
RUN mkdir -p uploads backups analytics logs && \
    chown -R nextjs:nodejs uploads backups analytics logs

# بناء التطبيق إذا كان مطلوباً
RUN if [ -f "vite.config.ts" ]; then \
        npm run build; \
    fi

# تنظيف cache
RUN npm cache clean --force

# التبديل للمستخدم غير root
USER nextjs

# فتح المنفذ
EXPOSE 3000

# إعداد متغيرات البيئة
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=512"

# إعداد health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# تشغيل التطبيق مع معالجة محسنة للإشارات
CMD ["node", "server.js"]