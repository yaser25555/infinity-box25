import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Box, Infinity, Phone } from 'lucide-react';
import { apiService } from '../services/api';

interface LoginFormProps {
  onLoginSuccess: (userData: any) => void;
  onSwitchToRegister: () => void;
}

// نظام الترجمات
const translations = {
  ar: {
    login: "تسجيل الدخول",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    loginButton: "دخول",
    switchToRegister: "ليس لديك حساب؟ إنشاء حساب",
    requiredFields: "الرجاء إدخال اسم المستخدم وكلمة المرور",
    loginFailed: "فشل في تسجيل الدخول"
  },
  en: {
    login: "Login",
    username: "Username",
    password: "Password",
    loginButton: "Login",
    switchToRegister: "Don't have an account? Register",
    requiredFields: "Please enter username and password",
    loginFailed: "Login failed"
  },
  ur: {
    login: "لاگ ان",
    username: "صارف نام",
    password: "پاس ورڈ",
    loginButton: "داخل ہوں",
    switchToRegister: "اکاؤنٹ نہیں ہے؟ رجسٹر کریں",
    requiredFields: "براہ کرم صارف نام اور پاس ورڈ درج کریں",
    loginFailed: "لاگ ان ناکام"
  },
  es: {
    login: "Iniciar Sesión",
    username: "Nombre de Usuario",
    password: "Contraseña",
    loginButton: "Entrar",
    switchToRegister: "¿No tienes cuenta? Regístrate",
    requiredFields: "Por favor ingresa nombre de usuario y contraseña",
    loginFailed: "Error al iniciar sesión"
  }
};

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // الحصول على اللغة الحالية
  const currentLanguage = localStorage.getItem('selectedLanguage') || 'ar';

  // وظيفة الترجمة
  const translate = (key: string) => {
    return (translations as any)[currentLanguage]?.[key] || (translations as any)['ar'][key] || key;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim() || !formData.password.trim()) {
      setError(translate('requiredFields'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.login(formData.username, formData.password);
      onLoginSuccess(response);
    } catch (error: any) {
      setError(error.message || translate('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto">
        <div className="relative group">
          {/* هالة متوهجة خلف النموذج - أصغر وأقل وضوحاً */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-800/10 via-blue-900/15 to-slate-800/10 rounded-2xl blur-md group-hover:blur-lg transition-all duration-500 animate-pulse"></div>

          <div className="relative bg-gradient-to-br from-blue-900/40 via-blue-800/30 to-slate-800/40 backdrop-blur-2xl rounded-2xl p-5 border border-blue-400/30 shadow-xl hover:shadow-blue-500/30 transition-all duration-500 hover:border-blue-300/50">

            <div className="relative z-10">
            <div className="text-center mb-6">
              {/* الشعار المدور كالقمر داخل الحاوية الزرقاء */}
              <div className="relative mx-auto mb-6">
                <div className="relative group">
                  {/* القمر المدور - تصميم كروي مثل القمر */}
                  <div className="w-28 h-28 rounded-full flex items-center justify-center relative group-hover:scale-110 transition-all duration-500 mx-auto overflow-hidden">
                    
                    {/* خلفية القمر - تدرج دائري */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-full shadow-2xl"></div>
                    
                    {/* تأثيرات القمر */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/20 rounded-full"></div>
                    <div className="absolute top-2 left-2 w-4 h-4 bg-white/40 rounded-full blur-sm"></div>
                    <div className="absolute top-4 right-4 w-2 h-2 bg-white/60 rounded-full"></div>
                    <div className="absolute bottom-3 left-4 w-3 h-3 bg-white/30 rounded-full"></div>
                    
                    {/* النص داخل القمر */}
                    <div className="text-center relative z-10">
                      <div className="text-gray-800 font-black text-sm leading-tight mb-1 drop-shadow-lg">
                        INFINITY
                      </div>
                      <div className="text-gray-800 font-black text-sm leading-tight drop-shadow-lg">
                        BOX
                      </div>
                    </div>

                    {/* أيقونة اللانهاية - تدور حول القمر */}
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-spin" style={{ animationDuration: '8s' }}>
                      <Infinity className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* هالة القمر - توهج خفيف */}
                  <div className="absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }}></div>

                  {/* حلقات مدارية حول القمر */}
                  <div className="absolute -inset-4 rounded-full border border-white/10 animate-spin" style={{ animationDuration: '20s' }}></div>
                  <div className="absolute -inset-6 rounded-full border border-white/5 animate-spin" style={{ animationDuration: '30s', animationDirection: 'reverse' }}></div>
                </div>
              </div>

              <h2 className="text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-2 drop-shadow-lg">
                {translate('login')}
              </h2>
            </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {/* حقل اسم المستخدم */}
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                  <Mail className="h-4 w-4 text-blue-300 group-focus-within:text-white transition-colors duration-300" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder={translate('username')}
                  className="w-full bg-blue-900/20 border border-blue-400/30 rounded-xl px-4 py-3 pr-10 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 hover:border-blue-300/50 transition-all duration-300 text-sm backdrop-blur-sm"
                  autoComplete="username"
                  required
                />
                {/* تأثير التوهج عند التركيز */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-600/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>

              {/* حقل كلمة المرور */}
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                  <Lock className="h-4 w-4 text-blue-300 group-focus-within:text-white transition-colors duration-300" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={translate('password')}
                  className="w-full bg-blue-900/20 border border-blue-400/30 rounded-xl px-4 py-3 pr-10 pl-10 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 hover:border-blue-300/50 transition-all duration-300 text-sm backdrop-blur-sm"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center z-10 group/eye"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-blue-300 hover:text-white group-hover/eye:scale-110 transition-all duration-300" />
                  ) : (
                    <Eye className="h-4 w-4 text-blue-300 hover:text-white group-hover/eye:scale-110 transition-all duration-300" />
                  )}
                </button>
                {/* تأثير التوهج عند التركيز */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-600/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full group overflow-hidden"
            >
              {/* خلفية متدرجة - أزرق غامق ثابت */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 rounded-xl transition-all duration-500 group-hover:from-blue-600 group-hover:via-blue-700 group-hover:to-blue-800"></div>

              {/* تأثير التوهج */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>

              {/* المحتوى */}
              <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-500 hover:via-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm shadow-xl">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="animate-pulse">{translate('loggingIn') || 'جاري تسجيل الدخول...'}</span>
                  </>
                ) : (
                  <>
                    <Box className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="group-hover:tracking-wider transition-all duration-300">
                      🚀 {translate('loginButton')}
                    </span>
                  </>
                )}
              </div>

              {/* تأثير الضوء المتحرك */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>
            </button>
          </form>

          <div className="mt-5 space-y-4">
            {/* قسم التسجيل */}
            <div className="text-center">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <p className="text-blue-200 mb-2 text-sm">
                  {translate('switchToRegister')}
                </p>
                <button
                  onClick={onSwitchToRegister}
                  className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-blue-800/20 to-blue-900/20 hover:from-blue-700/30 hover:to-blue-800/30 text-blue-300 hover:text-white font-bold py-2 px-4 rounded-lg border border-blue-400/30 hover:border-blue-300/60 transition-all duration-300 hover:scale-105"
                >
                  <User className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="group-hover:tracking-wider transition-all duration-300 text-sm">
                    ✨ إنشاء حساب جديد
                  </span>
                </button>
              </div>
            </div>

            {/* معلومات التواصل */}
            <div className="bg-gradient-to-br from-blue-800/20 via-blue-900/15 to-slate-800/20 backdrop-blur-sm rounded-xl p-4 border border-blue-400/20">
              <div className="text-center space-y-3">
                <h3 className="text-blue-200 font-bold text-sm mb-3">
                  📞 للاستفسار وشحن العملات في INFINITY BOX
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-blue-300 text-xs">
                    <Mail className="w-3 h-3" />
                    <span className="font-medium">YASER.HAROON79@GMAIL.COM</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-blue-300 text-xs">
                    <Phone className="w-3 h-3" />
                    <span className="font-medium">00966554593007</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-400/20">
                  <p className="text-blue-400/70 text-xs">
                    © 2024 INFINITY BOX - جميع الحقوق محفوظة
                  </p>
                </div>
              </div>
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;