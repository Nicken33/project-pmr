import React, { useState } from 'react';
import { X, ShieldAlert, FileText, Lock, Info, CheckCircle2 } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'publish' | 'privacy' | 'about';
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'about',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'publish' | 'privacy' | 'about'>(defaultTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
              Правила, условия и правовая информация
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher (§3.11: Четыре страницы) */}
        <div className="flex items-center gap-2 border-b border-[#E5E4F2] px-5 overflow-x-auto hide-scrollbar bg-[#FAF9FD]">
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'about'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            О проекте (дисклеймер)
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'terms'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Условия пользования (/terms)
          </button>
          <button
            onClick={() => setActiveTab('publish')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'publish'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Правила публикации
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'privacy'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Обработка персональных данных
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-[#5B5870] leading-relaxed">
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#EEEAFB]/60 border border-[#A998EA]/40">
                <h4 className="font-bold text-[#1F1B3D] text-sm mb-1 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#6545C6]" />
                  Официальный дисклеймер платформы (§12.13 ТЗ)
                </h4>
                <p>
                  Каталог «Talentro» является <strong>неофициальным информационным ресурсом</strong>, созданным для конкурса и облегчения поиска детских и подростковых секций родителями Приднестровья. Ресурс не является официальным сайтом перечисленных организаций.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#1F1B3D]">Откуда берутся данные:</h4>
                <p>
                  Все данные получены из открытых общедоступных источников (официальные сайты учреждений, публичные страницы) либо внесены самими организациями и частными мастерами. Каждая запись содержит <strong>дату верификации</strong> или пометку «данные ориентировочные».
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#1F1B3D]">Картографические данные:</h4>
                <p>
                  Тайлы карты предоставлены проектом <strong>OpenStreetMap</strong> по открытой лицензии ODbL («© OpenStreetMap contributors»). Ключей и закрытых платных сервисов не используется.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#1F1B3D]">Почта для связи и претензий:</h4>
                <p className="font-semibold text-[#6545C6]">
                  team@talentro-pmr.org · Ответ команды в течение 2 рабочих дней
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h4 className="font-bold text-[#1F1B3D] text-sm">Условия использования платформы (/terms)</h4>
              
              <div className="space-y-2">
                <h5 className="font-bold text-[#1F1B3D]">Что разрешено:</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Публиковать честное мнение о занятиях, свои фото и видео без лиц чужих детей.</li>
                  <li>Представителям организаций — отвечать на отзывы с официальной плашкой «ответ организации».</li>
                  <li>Голосовать за карточки и отзывы («плюс» / «минус»).</li>
                  <li>Оформлять онлайн-запись на бесплатные пробные занятия.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#FF4444]">Что строго запрещено (§12.15 ТЗ):</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Мат, оскорбления в адрес преподавателей, учеников или организаций.</li>
                  <li>Публикация чужих персональных данных (домашние адреса, личные телефоны).</li>
                  <li>Реклама сторонних услуг и товаров, ссылки на продажу.</li>
                  <li>Выдуманные факты, накрутка голосов вторыми аккаунтами.</li>
                </ul>
              </div>

              <div className="p-3 bg-[#F7F6FC] rounded-xl border border-[#E5E4F2]">
                <span className="font-bold text-[#1F1B3D] block">Санкции за нарушения:</span>
                <p className="text-xs">
                  1 раз — скрытие записи и уведомление; 2 раз — блокировка на 7 дней; 3 раз / клевета — бессрочная блокировка всех аккаунтов нарушителя.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'publish' && (
            <div className="space-y-4">
              <h4 className="font-bold text-[#1F1B3D] text-sm">Правила публикации анкет (§11 ТЗ)</h4>
              
              <div className="space-y-2">
                <h5 className="font-bold text-[#1F1B3D]">Обязательные требования к анкете:</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Один объект = одно занятие/услуга</strong>. Группы разного возраста и филиалы объединяются внутри одной карточки.</li>
                  <li>У каждой точки проведения обязательны точный адрес и координаты для карты.</li>
                  <li>Цены указываются только в целых рублях ПМР (₽); «договорная» не допускается.</li>
                  <li>У групп указывается точное расписание по дням недели и часам.</li>
                  <li>Все анкеты проходят проверку модератором в срок до 2 рабочих дней.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#1F1B3D]">Снятие с публикации:</h5>
                <p>
                  Любая организация или частный мастер вправе снять анкету с публикации в личном кабинете либо направив запрос на почту команды.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h4 className="font-bold text-[#1F1B3D] text-sm">Обработка персональных данных (Закон ПМР «О персональных данных»)</h4>
              
              <div className="space-y-2">
                <p>
                  Мы бережно относимся к приватности. У зарегистрированных участников хранятся исключительно адрес электронной почты, отображаемое имя и аватар. Номера телефонов из форм записи передаются напрямую выбранной секции.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#EAF7EE] border border-[#34D399]/40 space-y-2">
                <h5 className="font-bold text-[#1E9E4A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Право на удаление данных (§12.11 ТЗ)
                </h5>
                <p className="text-xs text-[#1F1B3D]">
                  Для частных мастеров (ИП, самозанятых): по первому обращению на почту команды анкета и все персональные данные снимаются с публикации в тот же рабочий день без переспрашивания.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E4F2] flex justify-end bg-[#FAF9FD]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
