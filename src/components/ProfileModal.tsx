import React, { useState } from 'react';
import { 
  X, Calendar, Heart, MessageSquare, Bell, Settings, 
  HelpCircle, Trash2, MapPin, Clock, CheckCircle2, Shield, Building, User, LogOut 
} from 'lucide-react';
import { Booking, UserRole } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenMessages: () => void;
  currentRole: UserRole;
  userName: string;
  userEmail: string;
  onChangeRole: (role: UserRole) => void;
  onOpenOwnerCabinet?: () => void;
  onOpenModeratorCabinet?: () => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  bookings,
  onCancelBooking,
  favoritesCount,
  onOpenFavorites,
  onOpenMessages,
  currentRole,
  userName,
  userEmail,
  onChangeRole,
  onOpenOwnerCabinet,
  onOpenModeratorCabinet,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'settings'>('bookings');

  if (!isOpen) return null;

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'АП';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
            Личный кабинет и профиль
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-5 bg-gradient-to-r from-[#EEEAFB] to-[#F7F6FC] border-b border-[#E5E4F2] flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-base text-[#1F1B3D] truncate">{userName}</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                currentRole === 'owner'
                  ? 'bg-[#6545C6]/15 text-[#6545C6]'
                  : currentRole === 'moderator'
                  ? 'bg-[#E11D48]/15 text-[#E11D48]'
                  : 'bg-[#059669]/15 text-[#059669]'
              }`}>
                {currentRole === 'owner' ? 'Владелец' : currentRole === 'moderator' ? 'Модератор' : 'Участник'}
              </span>
            </div>
            <p className="text-xs text-[#5B5870] truncate">{userEmail}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6545C6] font-semibold">
              <MapPin className="w-3.5 h-3.5" />
              <span>Тирасполь, ПМР</span>
            </div>
          </div>
        </div>

        {/* Quick Cabinet Access if Owner or Moderator */}
        {currentRole === 'owner' && onOpenOwnerCabinet && (
          <div className="p-3 bg-[#FAF8FE] border-b border-[#E5E4F2] px-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Building className="w-4 h-4 text-[#6545C6]" />
              <span className="font-bold text-[#1F1B3D]">Кабинет владельца секции</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenOwnerCabinet();
              }}
              className="px-3 py-1.5 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Управление анкеты ➔
            </button>
          </div>
        )}

        {currentRole === 'moderator' && onOpenModeratorCabinet && (
          <div className="p-3 bg-[#FFF5F6] border-b border-[#E5E4F2] px-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Shield className="w-4 h-4 text-[#E11D48]" />
              <span className="font-bold text-[#1F1B3D]">Кабинет модератора платформы</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenModeratorCabinet();
              }}
              className="px-3 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Проверка анкет ➔
            </button>
          </div>
        )}

        {/* Quick Menu Links */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b border-[#E5E4F2] bg-white">
          <button
            onClick={() => {
              onClose();
              onOpenFavorites();
            }}
            className="p-2.5 rounded-xl bg-[#F7F6FC] hover:bg-[#EEEAFB] flex items-center gap-2.5 text-left transition-colors"
          >
            <Heart className="w-4 h-4 text-[#FF4444]" />
            <div className="text-xs">
              <span className="font-bold text-[#1F1B3D] block">Избранное</span>
              <span className="text-[#858394] text-[11px]">{favoritesCount} секций</span>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenMessages();
            }}
            className="p-2.5 rounded-xl bg-[#F7F6FC] hover:bg-[#EEEAFB] flex items-center gap-2.5 text-left transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#6545C6]" />
            <div className="text-xs">
              <span className="font-bold text-[#1F1B3D] block">Сообщения</span>
              <span className="text-[#858394] text-[11px]">3 диалога</span>
            </div>
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center border-b border-[#E5E4F2] px-5">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-3 text-xs font-bold border-b-2 mr-6 transition-all ${
              activeTab === 'bookings'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Мои записи ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Настройки аккаунта
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'bookings' && (
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#858394]">
                  У вас пока нет активных записей. Запишитесь на первое пробное занятие!
                </div>
              ) : (
                bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-3.5 rounded-2xl border border-[#E5E4F2] bg-[#F7F6FC] hover:border-[#A998EA] transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1F1B3D]">
                        {booking.activityTitle}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#EAF7EE] text-[#1E9E4A] font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Подтверждено
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#5B5870]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#6545C6]" />
                        <span>{booking.date} в {booking.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#6545C6] shrink-0" />
                        <span className="truncate">{booking.address}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E4F2]/60 text-xs">
                      <span className="font-extrabold text-[#1F1B3D]">
                        {booking.format === 'trial' ? 'Бесплатное пробное' : `${booking.price} ₽`}
                      </span>

                      <button
                        onClick={() => onCancelBooking(booking.id)}
                        className="text-[11px] font-semibold text-[#FF4444] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Отменить</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs text-[#5B5870]">
              <div className="space-y-2">
                <label className="font-bold text-[#1F1B3D] block">Город проживания</label>
                <select className="w-full p-2.5 rounded-xl border border-[#E5E4F2] bg-[#F7F6FC] font-semibold text-[#1F1B3D]">
                  <option>Тирасполь</option>
                  <option>Бендеры</option>
                  <option>Рыбница</option>
                  <option>Дубоссары</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-[#1F1B3D] block">Уведомления в Telegram / Viber (IDC)</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#6545C6]" />
                  <span>Напоминания о предстоящих занятиях за 2 часа</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#6545C6]" />
                  <span>Уведомления об ответах преподавателей</span>
                </label>
              </div>

              {/* Закулисье: переключение роли зарегистрированного пользователя */}
              <div className="pt-3 border-t border-[#E5E4F2] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-[#1F1B3D]">
                    Закулисье: переключение роли
                  </span>
                  <span className="text-[10px] text-[#858394]">
                    3 зарегистрированных роли
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeRole('user')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      currentRole === 'user'
                        ? 'border-[#6545C6] bg-[#EEEAFB]/60 font-bold text-[#6545C6] ring-1 ring-[#6545C6]'
                        : 'border-[#E5E4F2] bg-white hover:bg-[#F7F6FC] text-[#5B5870]'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <User className="w-3 h-3 text-[#6545C6]" />
                      <span className="text-xs">Участник</span>
                    </div>
                    <span className="text-[10px] text-[#858394] block leading-tight">
                      Родитель / ученик
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeRole('owner')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      currentRole === 'owner'
                        ? 'border-[#6545C6] bg-[#EEEAFB]/60 font-bold text-[#6545C6] ring-1 ring-[#6545C6]'
                        : 'border-[#E5E4F2] bg-white hover:bg-[#F7F6FC] text-[#5B5870]'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Building className="w-3 h-3 text-[#6545C6]" />
                      <span className="text-xs">Владелец</span>
                    </div>
                    <span className="text-[10px] text-[#858394] block leading-tight">
                      Секция / студия
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeRole('moderator')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      currentRole === 'moderator'
                        ? 'border-[#E11D48] bg-[#FFF1F2] font-bold text-[#E11D48] ring-1 ring-[#E11D48]'
                        : 'border-[#E5E4F2] bg-white hover:bg-[#F7F6FC] text-[#5B5870]'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Shield className="w-3 h-3 text-[#E11D48]" />
                      <span className="text-xs">Модератор</span>
                    </div>
                    <span className="text-[10px] text-[#858394] block leading-tight">
                      Проверка анкет
                    </span>
                  </button>
                </div>
              </div>

              {/* Выход из аккаунта (возврат в статус Гостя) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-[#FF4444] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти из аккаунта (стать Гостем)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
