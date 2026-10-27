import React, { useState } from 'react';
import { X, CheckCircle, Calendar, Clock, Phone, User, Check, ArrowLeft } from 'lucide-react';
import { ActivityItem, Booking } from '../types';

interface BookingModalProps {
  activity: ActivityItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (newBooking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  activity,
  isOpen,
  onClose,
  onConfirmBooking,
}) => {
  const [format, setFormat] = useState<'trial' | 'subscription'>('trial');
  const [selectedDate, setSelectedDate] = useState('Пн 12 мая');
  const [selectedTime, setSelectedTime] = useState('16:00');
  const [userName, setUserName] = useState('Анна Петрова');
  const [userPhone, setUserPhone] = useState('+373 777 12 345');
  const [userComment, setUserComment] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState('');

  if (!isOpen || !activity) return null;

  const currentPrice = activity.groups[0]?.priceFrom || 0;
  const currentPeriod = activity.groups[0]?.period || 'месяц';
  const currentCity = activity.locations[0]?.city || 'Тирасполь';
  const currentAddress = activity.locations[0]?.address || 'ул. 25 Октября';
  const currentDistrict = activity.locations[0]?.district || '';

  const dates = [
    { day: 'Пн', date: '12 мая' },
    { day: 'Ср', date: '14 мая' },
    { day: 'Пт', date: '16 мая' },
    { day: 'Пн', date: '19 мая' },
    { day: 'Ср', date: '21 мая' },
  ];

  const timeSlots = ['16:00', '17:00', '18:00', '19:00'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bookingId = 'BK-' + Math.floor(100000 + Math.random() * 900000);
    const booking: Booking = {
      id: bookingId,
      activityId: activity.id,
      activityTitle: activity.title,
      format,
      date: selectedDate,
      time: selectedTime,
      name: userName,
      phone: userPhone,
      comment: userComment,
      status: 'confirmed',
      price: format === 'trial' ? 0 : currentPrice,
      createdAt: 'Сегодня, 12:45',
      address: `${currentCity}, ${currentAddress}`,
    };

    onConfirmBooking(booking);
    setConfirmedBookingId(bookingId);
    setIsSuccess(true);
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAndClose}
              className="p-1 rounded-lg text-[#5B5870] hover:bg-[#EEEAFB] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
              {isSuccess ? 'Запись оформлена!' : 'Запись на занятие'}
            </h3>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#EAF7EE] flex items-center justify-center text-[#1E9E4A] mb-2 animate-in zoom-in-50">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h4 className="text-xl font-black text-[#1F1B3D]">
              Вы успешно записаны!
            </h4>
            <p className="text-xs sm:text-sm text-[#5B5870] max-w-xs leading-relaxed">
              Ждем вас на занятии в студии <span className="font-bold text-[#1F1B3D]">«{activity.title}»</span>. Детали отправлены в раздел «Мои записи».
            </p>

            <div className="w-full bg-[#F7F6FC] rounded-2xl p-4 border border-[#E5E4F2] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#858394]">Номер записи:</span>
                <span className="font-bold text-[#6545C6] font-mono">{confirmedBookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#858394]">Дата и время:</span>
                <span className="font-bold text-[#1F1B3D]">{selectedDate} в {selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#858394]">Формат:</span>
                <span className="font-bold text-[#1F1B3D]">
                  {format === 'trial' ? 'Пробное (Бесплатно)' : `Абонемент (${currentPrice} ₽)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#858394]">Адрес:</span>
                <span className="font-bold text-[#1F1B3D] truncate max-w-[180px]">{currentAddress}</span>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#6545C6]/20 cursor-pointer mt-2"
            >
              Отлично, понятно
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Mini Activity Card preview */}
            <div className="flex items-center gap-3 p-3 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2]">
              <img
                src={activity.photos[0]}
                alt={activity.title}
                className="w-14 h-14 rounded-xl object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-[#1F1B3D] truncate">
                  {activity.title}
                </h4>
                <p className="text-xs text-[#6545C6] font-bold">
                  от {currentPrice.toLocaleString()} руб. ПМР / {currentPeriod}
                </p>
                <p className="text-[11px] text-[#858394] truncate">
                  {currentCity}, {currentDistrict}
                </p>
              </div>
            </div>

            {/* Step 1: Format Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1F1B3D] block">
                Выберите формат
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('trial')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    format === 'trial'
                      ? 'border-[#6545C6] bg-[#EEEAFB]/60 ring-2 ring-[#6545C6]'
                      : 'border-[#E5E4F2] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#1F1B3D]">Пробное занятие</span>
                    {format === 'trial' && <Check className="w-3.5 h-3.5 text-[#6545C6]" />}
                  </div>
                  <span className="text-xs text-[#1E9E4A] font-semibold">Бесплатно</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('subscription')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    format === 'subscription'
                      ? 'border-[#6545C6] bg-[#EEEAFB]/60 ring-2 ring-[#6545C6]'
                      : 'border-[#E5E4F2] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#1F1B3D]">Абонемент</span>
                    {format === 'subscription' && <Check className="w-3.5 h-3.5 text-[#6545C6]" />}
                  </div>
                  <span className="text-xs text-[#6545C6] font-semibold">
                    от {currentPrice.toLocaleString()} ₽ / {currentPeriod}
                  </span>
                </button>
              </div>
            </div>

            {/* Step 2: Date Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1F1B3D] block">
                Выберите дату
              </label>
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                {dates.map((d) => {
                  const dateStr = `${d.day} ${d.date}`;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`px-3 py-2 rounded-xl text-center shrink-0 transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-[#6545C6] bg-[#6545C6] text-white shadow-sm'
                          : 'border-[#E5E4F2] bg-[#F7F6FC] text-[#5B5870] hover:bg-[#EEEAFB]'
                      }`}
                    >
                      <span className="text-[10px] block opacity-80">{d.day}</span>
                      <span className="text-xs font-bold whitespace-nowrap">{d.date}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Time Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1F1B3D] block">
                Выберите время
              </label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((t) => {
                  const isSelected = selectedTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-[#6545C6] bg-[#6545C6] text-white shadow-sm'
                          : 'border-[#E5E4F2] bg-[#F7F6FC] text-[#5B5870] hover:bg-[#EEEAFB]'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: User Info */}
            <div className="space-y-3 pt-2 border-t border-[#E5E4F2]">
              <label className="text-xs font-bold text-[#1F1B3D] block">
                Ваши данные
              </label>

              <div>
                <label className="text-[11px] text-[#858394] block mb-1">Имя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-[#1F1B3D] bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#858394] block mb-1">
                  Телефон (ПМР: +373 77X XX XXX)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                  <input
                    type="tel"
                    required
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+373 777 12 345"
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-[#1F1B3D] bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#858394] block mb-1">
                  Комментарий (необязательно)
                </label>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Например, опыт ребенка или пожелания..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs text-[#1F1B3D] bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6] resize-none"
                />
              </div>
            </div>

            {/* Confirm CTA */}
            <button
              type="submit"
              className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#6545C6]/20 cursor-pointer"
            >
              Подтвердить запись
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
