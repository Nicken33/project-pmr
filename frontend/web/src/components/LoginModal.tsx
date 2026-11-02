import React, { useState } from 'react';
import { X, Lock, Mail, User, Building, Shield, Sparkles, Check, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (name: string, email: string, role: UserRole) => void;
  onOpenTerms: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  onOpenTerms,
}) => {
  // Mode: 'login' (Вход) or 'register' (Регистрация)
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('anna.petrova@mail.ru');
  const [loginPassword, setLoginPassword] = useState('••••••••');
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [registerRole, setRegisterRole] = useState<'user' | 'owner'>('user');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!isOpen) return null;

  // Handle standard Login (Email + Password only - NO role picker per user requirement!)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;

    // Auto-detect role by account email or credentials
    const lowerEmail = loginEmail.toLowerCase().trim();
    let detectedRole: UserRole = 'user';
    let detectedName = loginEmail.split('@')[0] || 'Пользователь';

    if (lowerEmail === 'palitra.pmr@mail.ru' || lowerEmail.includes('owner') || lowerEmail.includes('palitra')) {
      detectedRole = 'owner';
      detectedName = 'Художественная студия «Палитра»';
    } else if (lowerEmail === 'moderator@talentro-pmr.org' || lowerEmail.includes('moderator')) {
      detectedRole = 'moderator';
      detectedName = 'Модератор Talentro';
    } else if (lowerEmail === 'anna.petrova@mail.ru') {
      detectedRole = 'user';
      detectedName = 'Анна Петрова';
    }

    onSuccessLogin(detectedName, loginEmail, detectedRole);
    onClose();
  };

  // Handle Registration
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms || !regEmail.trim()) return;

    const finalName = regName.trim() || (registerRole === 'owner' ? 'Новая секция' : 'Новый участник');
    onSuccessLogin(finalName, regEmail, registerRole);
    onClose();
  };

  // Quick 1-click test login for convenience
  const handleQuickLogin = (role: 'user' | 'owner' | 'moderator') => {
    if (role === 'user') {
      onSuccessLogin('Анна Петрова', 'anna.petrova@mail.ru', 'user');
    } else if (role === 'owner') {
      onSuccessLogin('Художественная студия «Палитра»', 'palitra.pmr@mail.ru', 'owner');
    } else {
      onSuccessLogin('Модератор Talentro', 'moderator@talentro-pmr.org', 'moderator');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between bg-gradient-to-r from-[#FAF9FE] to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEEAFB] flex items-center justify-center text-[#6545C6]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D] leading-tight">
                {modalMode === 'login' ? 'Вход в Talentro' : 'Регистрация в Talentro'}
              </h3>
              <p className="text-[11px] text-[#858394]">
                {modalMode === 'login' ? 'Авторизация по логину и паролю' : 'Создайте новый профиль в системе'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Вход / Регистрация */}
        <div className="px-5 pt-4 pb-1">
          <div className="grid grid-cols-2 p-1 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2]">
            <button
              type="button"
              onClick={() => setModalMode('login')}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                modalMode === 'login'
                  ? 'bg-white text-[#1F1B3D] shadow-sm font-extrabold'
                  : 'text-[#858394] hover:text-[#1F1B3D]'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setModalMode('register')}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                modalMode === 'register'
                  ? 'bg-white text-[#1F1B3D] shadow-sm font-extrabold'
                  : 'text-[#858394] hover:text-[#1F1B3D]'
              }`}
            >
              Регистрация
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* ===================== MODE: LOGIN (ВХОД) ===================== */}
          {modalMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-[#1F1B3D] block text-xs">Электронная почта</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="email"
                    required
                    placeholder="name@mail.ru"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#1F1B3D] block text-xs">Пароль</label>
                  <button
                    type="button"
                    onClick={() => alert('Ссылка для восстановления отправлена на почту.')}
                    className="text-[11px] text-[#6545C6] hover:underline font-semibold"
                  >
                    Забыли пароль?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#5B5870]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#6545C6] cursor-pointer"
                  />
                  <span>Запомнить меня на этом устройстве</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#6545C6] hover:bg-[#5337A8] text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <span>Войти в аккаунт</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 text-[11px] text-[#858394]">
                Нет учётной записи?{' '}
                <button
                  type="button"
                  onClick={() => setModalMode('register')}
                  className="text-[#6545C6] font-bold hover:underline cursor-pointer"
                >
                  Зарегистрироваться
                </button>
              </div>
            </form>
          )}

          {/* ===================== MODE: REGISTER (РЕГИСТРАЦИЯ) ===================== */}
          {modalMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Distinct Color Account Type Selector for Registration */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#1F1B3D] block text-xs">
                  Выберите тип создаваемого аккаунта:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Participant Card (Purple Theme) */}
                  <button
                    type="button"
                    onClick={() => setRegisterRole('user')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      registerRole === 'user'
                        ? 'border-[#6545C6] bg-[#EEEAFB] ring-2 ring-[#6545C6]/30 shadow-sm'
                        : 'border-[#E5E4F2] bg-white hover:bg-[#FAF9FE] text-[#5B5870]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center shadow-xs">
                        <User className="w-4 h-4 text-[#6545C6]" />
                      </div>
                      {registerRole === 'user' && (
                        <span className="w-5 h-5 rounded-full bg-[#6545C6] text-white flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-[#1F1B3D] block">Участник</span>
                      <span className="text-[10px] text-[#6545C6] font-medium leading-tight">
                        Ищу кружки и секции
                      </span>
                    </div>
                  </button>

                  {/* Owner Card (Blue Theme) */}
                  <button
                    type="button"
                    onClick={() => setRegisterRole('owner')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      registerRole === 'owner'
                        ? 'border-[#0284C7] bg-[#E0F2FE] ring-2 ring-[#0284C7]/30 shadow-sm'
                        : 'border-[#E5E4F2] bg-white hover:bg-[#F0F9FF] text-[#5B5870]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center shadow-xs">
                        <Building className="w-4 h-4 text-[#0284C7]" />
                      </div>
                      {registerRole === 'owner' && (
                        <span className="w-5 h-5 rounded-full bg-[#0284C7] text-white flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-[#1F1B3D] block">Владелец</span>
                      <span className="text-[10px] text-[#0284C7] font-medium leading-tight">
                        Размещаю свои секции
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1F1B3D] block text-xs">
                  {registerRole === 'owner' ? 'Название организации / секции' : 'Ваше имя и фамилия'}
                </label>
                <div className="relative">
                  {registerRole === 'owner' ? (
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0284C7]" />
                  ) : (
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6545C6]" />
                  )}
                  <input
                    type="text"
                    required
                    placeholder={registerRole === 'owner' ? 'Например: Академия «Грация»' : 'Например: Иван Смирнов'}
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1F1B3D] block text-xs">Электронная почта</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="email"
                    required
                    placeholder="name@mail.ru"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1F1B3D] block text-xs">Пароль (от 6 символов)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="password"
                    required
                    placeholder="Придумайте пароль"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 text-[11px] text-[#5B5870] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6545C6] mt-0.5 cursor-pointer"
                />
                <span>
                  Согласен с{' '}
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="text-[#6545C6] underline font-bold"
                  >
                    Условиями пользования
                  </button>{' '}
                  и обработкой персональных данных
                </span>
              </label>

              <button
                type="submit"
                disabled={!acceptedTerms}
                className={`w-full py-3 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 ${
                  registerRole === 'owner'
                    ? 'bg-[#0284C7] hover:bg-[#0369A1]'
                    : 'bg-[#6545C6] hover:bg-[#5337A8]'
                }`}
              >
                <span>
                  Зарегистрироваться как {registerRole === 'owner' ? 'Владелец' : 'Участник'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 text-[11px] text-[#858394]">
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={() => setModalMode('login')}
                  className="text-[#6545C6] font-bold hover:underline cursor-pointer"
                >
                  Войти
                </button>
              </div>
            </form>
          )}

          {/* ===================== QUICK 1-CLICK TEST LOGIN ===================== */}
          {/* Distinct color for each role: Purple for User, Blue for Owner, Rose for Moderator */}
          <div className="pt-3 border-t border-[#E5E4F2] space-y-2 text-center">
            <span className="text-[11px] font-semibold text-[#858394] block">
              Быстрый тестовый вход в 1 клик:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {/* Participant: Purple */}
              <button
                type="button"
                onClick={() => handleQuickLogin('user')}
                className="px-2 py-2 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] border border-purple-200 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs hover:scale-[1.02]"
                title="Войти как Участник (Анна)"
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#6545C6]"></span>
                  <span className="truncate">Участник</span>
                </div>
                <span className="text-[9px] text-[#6545C6]/70 truncate">Анна</span>
              </button>

              {/* Owner: Blue / Sky */}
              <button
                type="button"
                onClick={() => handleQuickLogin('owner')}
                className="px-2 py-2 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0284C7] border border-sky-200 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs hover:scale-[1.02]"
                title="Войти как Владелец секции (Палитра)"
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#0284C7]"></span>
                  <span className="truncate">Владелец</span>
                </div>
                <span className="text-[9px] text-[#0284C7]/70 truncate">Палитра</span>
              </button>

              {/* Moderator: Rose / Red */}
              <button
                type="button"
                onClick={() => handleQuickLogin('moderator')}
                className="px-2 py-2 bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-rose-200 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs hover:scale-[1.02]"
                title="Войти как Модератор"
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#E11D48]"></span>
                  <span className="truncate">Модератор</span>
                </div>
                <span className="text-[9px] text-[#E11D48]/70 truncate">Talentro</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
