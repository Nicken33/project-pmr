import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, Building, Shield } from 'lucide-react';
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
  const [selectedRole, setSelectedRole] = useState<'user' | 'owner' | 'moderator'>('user');
  const [email, setEmail] = useState('anna.petrova@mail.ru');
  const [password, setPassword] = useState('••••••••');
  const [name, setName] = useState('Анна Петрова');
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!isOpen) return null;

  const handleRoleSelect = (role: 'user' | 'owner' | 'moderator') => {
    setSelectedRole(role);
    if (role === 'user') {
      setName('Анна Петрова');
      setEmail('anna.petrova@mail.ru');
    } else if (role === 'owner') {
      setName('Художественная студия «Палитра»');
      setEmail('palitra.pmr@mail.ru');
    } else {
      setName('Модератор Talentro');
      setEmail('moderator@talentro-pmr.org');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) return;
    onSuccessLogin(name, email, selectedRole);
    onClose();
  };

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
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#6545C6]" />
            <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
              Вход и регистрация в Talentro
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Quick Demo Switcher (3 варианта регистрации) */}
          <div className="p-3 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2] space-y-2">
            <span className="text-[11px] font-bold text-[#858394] uppercase tracking-wider block">
              Выберите тип аккаунта (3 зарегистрированных профиля):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('user')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRole === 'user'
                    ? 'border-[#6545C6] bg-white shadow-sm ring-2 ring-[#6545C6]/20'
                    : 'border-[#E5E4F2] bg-white/60 hover:bg-white text-[#5B5870]'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-[#6545C6]" />
                  <span className="font-extrabold text-xs text-[#1F1B3D]">Участник</span>
                </div>
                <span className="text-[10px] text-[#858394] leading-tight">
                  Поиск, избранное, отзывы, запись
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('owner')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRole === 'owner'
                    ? 'border-[#6545C6] bg-white shadow-sm ring-2 ring-[#6545C6]/20'
                    : 'border-[#E5E4F2] bg-white/60 hover:bg-white text-[#5B5870]'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Building className="w-3.5 h-3.5 text-[#6545C6]" />
                  <span className="font-extrabold text-xs text-[#1F1B3D]">Владелец</span>
                </div>
                <span className="text-[10px] text-[#858394] leading-tight">
                  Анкеты секций, залы, кабинет
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('moderator')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRole === 'moderator'
                    ? 'border-[#E11D48] bg-white shadow-sm ring-2 ring-[#E11D48]/20'
                    : 'border-[#E5E4F2] bg-white/60 hover:bg-white text-[#5B5870]'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span className="font-extrabold text-xs text-[#1F1B3D]">Модератор</span>
                </div>
                <span className="text-[10px] text-[#858394] leading-tight">
                  Очередь анкет, жалобы, правки
                </span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="font-bold text-[#1F1B3D]">Имя / Название организации</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#1F1B3D]">Электронная почта</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#1F1B3D]">Пароль</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6]"
              />
            </div>

            <label className="flex items-start gap-2 pt-1 text-[11px] text-[#5B5870] cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 rounded text-[#6545C6] mt-0.5"
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
              className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              Войти как {selectedRole === 'user' ? 'Участник' : selectedRole === 'owner' ? 'Владелец секции' : 'Модератор'}
            </button>
          </form>

          {/* 1-click Quick Login shortcuts */}
          <div className="pt-2 border-t border-[#E5E4F2] space-y-1.5 text-center">
            <span className="text-[11px] text-[#858394] block">Быстрый тестовый вход в 1 клик:</span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('user')}
                className="px-2.5 py-1 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Анна (Участник)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('owner')}
                className="px-2.5 py-1 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Палитра (Владелец)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('moderator')}
                className="px-2.5 py-1 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48] rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Модератор
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
