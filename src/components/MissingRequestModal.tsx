import React, { useState } from 'react';
import { X, SearchCheck, CheckCircle2 } from 'lucide-react';
import { MissingRequest } from '../types';
import { CITIES } from '../data/mockData';

interface MissingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitRequest: (req: MissingRequest) => void;
}

export const MissingRequestModal: React.FC<MissingRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitRequest,
}) => {
  const [queryText, setQueryText] = useState('');
  const [city, setCity] = useState('Тирасполь');
  const [email, setEmail] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim().length < 5) return;

    const newReq: MissingRequest = {
      id: 'req-' + Date.now(),
      queryText: queryText.trim(),
      city,
      email: email.trim() || undefined,
      createdAt: 'Сегодня, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'new',
    };

    onSubmitRequest(newReq);
    setIsSuccess(true);
  };

  const handleClose = () => {
    setIsSuccess(false);
    setQueryText('');
    setEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
              Не нашли нужное занятие?
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#EAF7EE] text-[#1E9E4A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-black text-base text-[#1F1B3D]">
              Заявка принята в работу!
            </h4>
            <p className="text-xs text-[#5B5870] leading-relaxed">
              Команда Talentro проверит контакты секций в Приднестровье и добавит их в каталог.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-[#6545C6] text-white text-xs font-bold rounded-xl"
            >
              Отлично
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-[#5B5870]">
              Напишите, какой кружок, секцию или услугу вы ищете. Мы найдем проверенные контакты в вашем городе и внесем в базу.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#1F1B3D]">
                Что ищете? (минимум 5 знаков) *
              </label>
              <textarea
                required
                minLength={5}
                rows={2}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Например: Секция фехтования для мальчика 10 лет..."
                className="w-full p-2.5 bg-[#F7F6FC] border border-[#E5E4F2] text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#1F1B3D]">Город</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 bg-[#F7F6FC] border border-[#E5E4F2] text-xs font-semibold rounded-xl"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#1F1B3D]">
                Почта для ответа (необязательно)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mail.ru"
                className="w-full p-2.5 bg-[#F7F6FC] border border-[#E5E4F2] text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
              />
            </div>

            <button
              type="submit"
              disabled={queryText.trim().length < 5}
              className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              Отправить заявку модераторам
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
