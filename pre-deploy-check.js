#!/usr/bin/env node

// سكريبت فحص ما قبل النشر لـ INFINITY BOX
const fs = require('fs');
const path = require('path');

console.log('🔍 بدء فحص ما قبل النشر...\n');

let errors = [];
let warnings = [];
let passed = 0;

// دالة فحص وجود ملف
function checkFile(filePath, required = true) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`✅ ${filePath}`);
    passed++;
    return true;
  } else {
    const message = `❌ ملف مفقود: ${filePath}`;
    if (required) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    console.log(message);
    return false;
  }
}

// دالة فحص محتوى ملف
function checkFileContent(filePath, searchText, description) {
  if (!fs.existsSync(filePath)) {
    errors.push(`❌ ${description}: ملف ${filePath} غير موجود`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchText)) {
    console.log(`✅ ${description}`);
    passed++;
    return true;
  } else {
    errors.push(`❌ ${description}: لم يتم العثور على "${searchText}" في ${filePath}`);
    return false;
  }
}

// دالة فحص package.json
function checkPackageJson() {
  console.log('\n📦 فحص package.json...');
  
  if (!checkFile('package.json')) return;
  
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // فحص السكريبتات المطلوبة
  const requiredScripts = ['start', 'build', 'test'];
  requiredScripts.forEach(script => {
    if (pkg.scripts && pkg.scripts[script]) {
      console.log(`✅ سكريبت ${script} موجود`);
      passed++;
    } else {
      errors.push(`❌ سكريبت ${script} مفقود في package.json`);
    }
  });
  
  // فحص التبعيات المطلوبة
  const requiredDeps = ['express', 'mongoose', 'jsonwebtoken', 'ws'];
  requiredDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      console.log(`✅ تبعية ${dep} موجودة`);
      passed++;
    } else {
      errors.push(`❌ تبعية ${dep} مفقودة في package.json`);
    }
  });
}

// دالة فحص ملفات Docker
function checkDockerFiles() {
  console.log('\n🐳 فحص ملفات Docker...');
  
  checkFile('Dockerfile');
  checkFile('docker-compose.yml');
  checkFile('.dockerignore');
  
  // فحص محتوى Dockerfile
  checkFileContent('Dockerfile', 'FROM node:', 'Dockerfile يحتوي على base image');
  checkFileContent('Dockerfile', 'EXPOSE 3000', 'Dockerfile يفتح المنفذ 3000');
  checkFileContent('Dockerfile', 'CMD', 'Dockerfile يحتوي على أمر التشغيل');
}

// دالة فحص ملفات Render
function checkRenderFiles() {
  console.log('\n🚀 فحص ملفات Render...');
  
  checkFile('render.yaml');
  
  if (fs.existsSync('render.yaml')) {
    checkFileContent('render.yaml', 'type: web', 'render.yaml يحتوي على نوع الخدمة');
    checkFileContent('render.yaml', 'env: docker', 'render.yaml يستخدم Docker');
    checkFileContent('render.yaml', 'healthCheckPath:', 'render.yaml يحتوي على health check');
  }
}

// دالة فحص الملفات الأساسية
function checkCoreFiles() {
  console.log('\n📁 فحص الملفات الأساسية...');
  
  checkFile('server.js');
  checkFile('client/index.html', false);
  checkFile('client/src/App.tsx', false);
  
  // فحص محتوى server.js
  checkFileContent('server.js', 'express', 'server.js يستخدم Express');
  checkFileContent('server.js', 'mongoose', 'server.js يستخدم Mongoose');
  checkFileContent('server.js', '/health', 'server.js يحتوي على health check endpoint');
}

// دالة فحص متغيرات البيئة
function checkEnvironmentVariables() {
  console.log('\n🔧 فحص متغيرات البيئة...');
  
  checkFile('.env.production', false);
  checkFile('env.example', false);
  
  // فحص المتغيرات المطلوبة في server.js
  const serverContent = fs.readFileSync('server.js', 'utf8');
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
  
  requiredEnvVars.forEach(envVar => {
    if (serverContent.includes(envVar)) {
      console.log(`✅ متغير البيئة ${envVar} مستخدم`);
      passed++;
    } else {
      warnings.push(`⚠️ متغير البيئة ${envVar} قد يكون مطلوباً`);
    }
  });
}

// دالة فحص الأمان
function checkSecurity() {
  console.log('\n🔒 فحص الأمان...');
  
  // فحص عدم وجود ملفات حساسة
  const sensitiveFiles = ['.env', 'config/database.js', 'private.key'];
  sensitiveFiles.forEach(file => {
    if (fs.existsSync(file)) {
      errors.push(`❌ ملف حساس موجود: ${file} (يجب إضافته لـ .gitignore)`);
    } else {
      console.log(`✅ ملف حساس غير موجود: ${file}`);
      passed++;
    }
  });
  
  // فحص .gitignore
  if (checkFile('.gitignore', false)) {
    checkFileContent('.gitignore', 'node_modules', '.gitignore يتجاهل node_modules');
    checkFileContent('.gitignore', '.env', '.gitignore يتجاهل ملفات .env');
  }
}

// دالة فحص البنية
function checkStructure() {
  console.log('\n🏗️ فحص بنية المشروع...');
  
  const requiredDirs = ['client', 'public'];
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ مجلد ${dir} موجود`);
      passed++;
    } else {
      warnings.push(`⚠️ مجلد ${dir} مفقود`);
    }
  });
}

// دالة فحص الاختبارات
function checkTests() {
  console.log('\n🧪 فحص الاختبارات...');
  
  checkFile('tests/comprehensive-tests.js', false);
  checkFile('tests/setup.js', false);
  
  // فحص سكريبت الاختبار
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.scripts && pkg.scripts.test) {
    console.log('✅ سكريبت الاختبار موجود');
    passed++;
  } else {
    warnings.push('⚠️ سكريبت الاختبار مفقود');
  }
}

// تشغيل جميع الفحوصات
async function runAllChecks() {
  checkPackageJson();
  checkDockerFiles();
  checkRenderFiles();
  checkCoreFiles();
  checkEnvironmentVariables();
  checkSecurity();
  checkStructure();
  checkTests();
  
  // عرض النتائج
  console.log('\n' + '='.repeat(50));
  console.log('📊 نتائج الفحص:');
  console.log('='.repeat(50));
  
  console.log(`✅ نجح: ${passed} فحص`);
  console.log(`⚠️ تحذيرات: ${warnings.length}`);
  console.log(`❌ أخطاء: ${errors.length}`);
  
  if (warnings.length > 0) {
    console.log('\n⚠️ التحذيرات:');
    warnings.forEach(warning => console.log(warning));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    errors.forEach(error => console.log(error));
    console.log('\n🚫 يجب إصلاح الأخطاء قبل النشر!');
    process.exit(1);
  } else {
    console.log('\n🎉 جميع الفحوصات نجحت! المشروع جاهز للنشر على Render.');
    
    // نصائح إضافية
    console.log('\n💡 نصائح للنشر:');
    console.log('1. تأكد من إعداد متغيرات البيئة في Render Dashboard');
    console.log('2. تأكد من إعداد قاعدة بيانات MongoDB');
    console.log('3. تأكد من إعداد Agora SDK للغرف الصوتية');
    console.log('4. راجع ملف deploy-to-render.md للتفاصيل');
    
    process.exit(0);
  }
}

// تشغيل الفحص
runAllChecks().catch(error => {
  console.error('❌ خطأ في تشغيل الفحص:', error);
  process.exit(1);
});
