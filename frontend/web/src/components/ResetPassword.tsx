import React, { useState, useEffect } from 'react';
import { X, Lock, Check, AlertCircle, Mail, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResetPasswordProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({
  isOpen,
  onClose,
}) => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Extract token from URL on mount
  useEffect(() => {
    if (isOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      if (tokenFromUrl) {
        setToken(tokenFromUrl);
      } else {
        setError('Ссылка для восстановления пароля недействительна. Отсутствует токен.');
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Токен не найден. Перейдите по ссылке из письма ещё раз.');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/password-reset/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400) {
          if (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_USED') {
            setError('Ссылка просрочена или уже использована. Запросите восстановление пароля заново.');
          } else if (data.code === 'INVALID_TOKEN') {
            setError('Недействительная ссылка. Запросите восстановление пароля заново.');
          } else {
            setError(data.message || 'Ошибка при сбросе пароля. Попробуйте ещё раз.');
          }
        } else {
          setError('Ошибка сервера. Попробуйте позже.');
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Ошибка сети. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    onClose();
    // The LoginModal will be opened by the parent component
    // We need to trigger the forgot password mode
    window.dispatchEvent(new CustomEvent('open-forgot-password'));
  };

  const handleGoToLogin = () => {
    onClose();
    window.location.href = '/login'; // Or trigger login modal
    // Since we don't have routing, we'll just close and let parent handle
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E4F2] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-xl text-[#858394] hover:text-[#1F1B3D] hover:bg-[#F7F6FC] transition-colors cursor-pointer"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {!success ? (
            <div key="form" className="p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEEAFB] flex items-center justify-center text-[#6545C6]">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 id="reset-password-title" className="text-2xl font-black text-[#1F1B3D]">
                  {token ? 'Новый пароль' : 'Ссылка недействительна'}
                </h2>
                <p className="text-sm text-[#5B5870]">
                  {token
                    ? 'Введите новый пароль для вашего аккаунта. Пароль должен быть не короче 8 символов.'
                    : 'Токен восстановления не найден в ссылке.'}
                </p>
              </div>

              {error && (
                <div
                  className="p-3 bg-[#FFF1F2] border border-[#FECACA] rounded-xl flex items-start gap-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4.5 h-4.5 text-[#E11D48] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#E11D48]">{error}</p>
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="font-bold text-[#1F1B3D] block text-sm">
                      Новый пароль
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#858394]" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        placeholder="Введите новый пароль"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full pl-10 pr-12 py-3 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-sm disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858394] hover:text-[#1F1B3D] cursor-pointer"
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="font-bold text-[#1F1B3D] block text-sm">
                      Подтвердите пароль
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#858394]" />
                      <input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Повторите новый пароль"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="w-full pl-10 pr-3 py-3 bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] focus:bg-white transition-all text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || password.length < 8 || password !== confirmPassword}
                    className="w-full py-3.5 bg-[#6545C6] hover:bg-[#5337A8] text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RotateCcw className="w-5 h-5 animate-spin" />
                        <span>Сохраняем...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Сохранить пароль</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {!token && (
                <div className="space-y-3 pt-4">
                  <button
                    onClick={handleRequestNewLink}
                    className="w-full py-3.5 bg-[#6545C6] hover:bg-[#5337A8] text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Запросить новую ссылку</span>
                  </button>
                  <button
                    onClick={handleGoToLogin}
                    className="w-full py-3.5 bg-white border border-[#E5E4F2] text-[#1F1B3D] font-bold rounded-xl cursor-pointer hover:bg-[#FAF9FD] transition-colors"
                  >
                    Вернуться ко входу
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div key="success" className="p-6 sm:p-8 space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#1E9E4A]">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-[#1F1B3D]">Пароль успешно изменён!</h3>
              <p className="text-sm text-[#5B5870] max-w-xs mx-auto leading-relaxed">
                Теперь вы можете войти в аккаунт с новым паролем.
              </p>
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleGoToLogin}
                  className="w-full py-3.5 bg-[#6545C6] hover:bg-[#5337A8] text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Перейти ко входу
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};