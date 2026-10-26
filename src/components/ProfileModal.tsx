import React, { useState } from 'react';
import { 
  X, Calendar, Heart, MessageSquare, Bell, Settings, 
  HelpCircle, Trash2, MapPin, Clock, CheckCircle2 
} from 'lucide-react';
import { Booking } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenMessages: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  bookings,
  onCancelBooking,
  favoritesCount,
  onOpenFavorites,
  onOpenMessages,
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'settings'>('bookings');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
            Личный кабинет
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-5 bg-gradient-to-r from-[#EEEAFB] to-[#F7F6FC] border-b border-[#E5E4F2] flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center text-white font-black text-xl shadow-md">
            АП
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-base text-[#1F1B3D]">Анна Петрова</h4>
            <p className="text-xs text-[#5B5870]">anna.petrova@mail.ru</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6545C6] font-semibold">
              <MapPin className="w-3.5 h-3.5" />
              <span>Тирасполь, Центр</span>
            </div>
          </div>
        </div>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
