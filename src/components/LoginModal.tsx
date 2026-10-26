import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (name: string, email: string) => void;
  onOpenTerms: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  onOpenTerms,
}) => {
  const [email, setEmail] = useState('anna.petrova@mail.ru');
  const [password, setPassword] = useState('••••••••');
  const [name, setName] = useState('Анна Петрова');
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) return;
    onSuccessLogin(name, email);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#6545C6]" />
            <h3 className="font-extrabold text-base text-[#1F1B3D]">
              Вход и регистрация в Talentro
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-[#5B5870] leading-relaxed">
            Войдите, чтобы сохранять понравившиеся кружки в <strong>Избранное</strong>, голосовать (+ / -) и оставлять отзывы.
          </p>

          <div className="space-y-1">
            <label className="font-bold text-[#1F1B3D]">Ваше имя</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border rounded-xl font-semibold"
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
                className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6FC] border rounded-xl font-semibold"
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
              className="w-full px-3 py-2.5 bg-[#F7F6FC] border rounded-xl font-semibold"
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
            Войти как участник
          </button>
        </form>
      </div>
    </div>
  );
};
