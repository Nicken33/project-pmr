import React, { useState } from 'react';
import { 
  X, Check, AlertOctagon, CheckCircle2, Shield, 
  MapPin, Clock, Edit2, Trash2, Eye 
} from 'lucide-react';
import { ActivityItem, MissingRequest, ModerationReport } from '../types';
import { CITIES, DISTRICTS_TIRASPOL } from '../data/mockData';

interface ModeratorCabinetProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityItem[];
  onApproveActivity: (id: string) => void;
  onRejectActivity: (id: string, reason: string) => void;
  onQuickEditActivity: (id: string, city: string, district: string, subcategory: string) => void;
  reports: ModerationReport[];
  onResolveReport: (id: string, action: 'hide' | 'dismiss') => void;
  missingRequests: MissingRequest[];
}

export const ModeratorCabinet: React.FC<ModeratorCabinetProps> = ({
  isOpen,
  onClose,
  activities,
  onApproveActivity,
  onRejectActivity,
  onQuickEditActivity,
  reports,
  onResolveReport,
  missingRequests,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'reports' | 'requests'>('queue');
  const [selectedActivityId, setSelectedActivityId] = useState<string>(activities[0]?.id || '');
  const [rejectReason, setRejectReason] = useState('Не указан точный номер дома и расписание');
  const [customRejectText, setCustomRejectText] = useState('');

  // Quick edit form state
  const selectedActivity = activities.find((a) => a.id === selectedActivityId) || activities[0];
  const [editCity, setEditCity] = useState(selectedActivity?.locations[0]?.city || 'Тирасполь');
  const [editDistrict, setEditDistrict] = useState(selectedActivity?.locations[0]?.district || 'Центр');
  const [editSubcategory, setEditSubcategory] = useState(selectedActivity?.subcategory || '');

  if (!isOpen) return null;

  const handleQuickSave = () => {
    if (!selectedActivity) return;
    onQuickEditActivity(selectedActivity.id, editCity, editDistrict, editSubcategory);
  };

  const standardReasons = [
    'Не указан точный номер дома и расписание',
    'Не указан телефон для связи (+373 77X XX XXX)',
    'В описании обнаружены чужие логотипы или водяные знаки',
    'Цены указаны не в целых рублях ПМР',
    'Дублирующая запись существующей студии',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between bg-[#1F1B3D] text-white">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#34D399]" />
            <div>
              <h3 className="font-extrabold text-base">Кабинет модератора Talentro</h3>
              <p className="text-[11px] text-slate-300">
                Срок ответа по регламенту ТЗ: 2 рабочих дня
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center border-b border-[#E5E4F2] px-6 bg-[#FAF9FD]">
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'queue'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Очередь анкет ({activities.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'reports'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Жалобы и данные ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'requests'
                ? 'border-[#6545C6] text-[#6545C6]'
                : 'border-transparent text-[#858394] hover:text-[#1F1B3D]'
            }`}
          >
            Заявки «Не нашли» ({missingRequests.length})
          </button>
        </div>

        {/* Tab 1: Queue */}
        {activeTab === 'queue' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left list of items to moderate */}
            <div className="w-full md:w-1/3 border-r border-[#E5E4F2] overflow-y-auto bg-[#F7F6FC] p-3 space-y-2">
              {activities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => {
                    setSelectedActivityId(act.id);
                    setEditCity(act.locations[0]?.city || 'Тирасполь');
                    setEditDistrict(act.locations[0]?.district || 'Центр');
                    setEditSubcategory(act.subcategory || '');
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedActivityId === act.id
                      ? 'bg-white border-[#6545C6] shadow-sm'
                      : 'border-[#E5E4F2] hover:bg-[#EEEAFB]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#6545C6]">{act.topCategoryLabel}</span>
                    <span className="text-[#858394]">Ждет 4 ч.</span>
                  </div>
                  <h4 className="font-extrabold text-xs text-[#1F1B3D] truncate">
                    {act.title}
                  </h4>
                  <p className="text-[11px] text-[#5B5870] truncate">
                    {act.organization.name}
                  </p>
                </div>
              ))}
            </div>

            {/* Right preview & moderation actions */}
            {selectedActivity && (
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-white">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EEEAFB] text-[#6545C6] text-[11px] font-bold">
                    Проверка анкеты объекта
                  </span>
                  <h3 className="text-lg font-black text-[#1F1B3D] mt-1">
                    {selectedActivity.title}
                  </h3>
                  <p className="text-xs text-[#858394]">
                    Организация: {selectedActivity.organization.name} · Тел: {selectedActivity.phone}
                  </p>
                </div>

                {/* Quick edit fields (§3.9 п.2) */}
                <div className="p-3 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-2.5">
                  <span className="text-xs font-bold text-[#1F1B3D] block flex items-center gap-1">
                    <Edit2 className="w-3.5 h-3.5 text-[#6545C6]" />
                    Быстрая правка служебных полей (город, район, направление)
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-[#858394] block">Город</label>
                      <select
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border bg-white"
                      >
                        {CITIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#858394] block">Район</label>
                      <select
                        value={editDistrict}
                        onChange={(e) => setEditDistrict(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border bg-white"
                      >
                        {DISTRICTS_TIRASPOL.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#858394] block">Направление</label>
                      <input
                        type="text"
                        value={editSubcategory}
                        onChange={(e) => setEditSubcategory(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border bg-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleQuickSave}
                    className="px-3 py-1 bg-[#6545C6] text-white text-[11px] font-bold rounded-lg"
                  >
                    Применить правки
                  </button>
                </div>

                {/* Full preview of groups and points */}
                <div className="space-y-2 text-xs">
                  <h5 className="font-bold text-[#1F1B3D]">Точки проведения ({selectedActivity.locations.length}):</h5>
                  {selectedActivity.locations.map((loc) => (
                    <div key={loc.id} className="p-2.5 bg-[#FAF9FD] rounded-xl border border-slate-200">
                      <span className="font-bold text-[#1F1B3D]">{loc.title || loc.address}</span>
                      <p className="text-[11px] text-[#5B5870]">{loc.city}, {loc.district}, {loc.address}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs">
                  <h5 className="font-bold text-[#1F1B3D]">Группы ({selectedActivity.groups.length}):</h5>
                  {selectedActivity.groups.map((grp) => (
                    <div key={grp.id} className="p-2.5 bg-[#FAF9FD] rounded-xl border border-slate-200">
                      <span className="font-bold text-[#1F1B3D]">{grp.title} ({grp.ageFrom}–{grp.ageTo} лет)</span>
                      <p className="text-[11px] text-[#6545C6] font-bold">
                        {grp.priceFrom === 0 ? 'Бесплатно' : `${grp.priceFrom} руб. ПМР в ${grp.period}`}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Decision Actions (§3.9 п.3) */}
                <div className="pt-4 border-t border-[#E5E4F2] space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F1B3D]">Типовая причина (если отклоняем):</label>
                    <select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300"
                    >
                      {standardReasons.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onApproveActivity(selectedActivity.id)}
                      className="flex-1 py-2.5 bg-[#34D399] hover:bg-[#2bb883] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>Опубликовать анкету</span>
                    </button>

                    <button
                      onClick={() => onRejectActivity(selectedActivity.id, rejectReason)}
                      className="py-2.5 px-4 bg-[#FF4444] hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <X className="w-4 h-4" />
                      <span>Отклонить с причиной</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Reports / Complaints */}
        {activeTab === 'reports' && (
          <div className="p-6 overflow-y-auto space-y-3 flex-1">
            {reports.map((rep) => (
              <div key={rep.id} className="p-4 rounded-2xl border border-[#E5E4F2] bg-[#F7F6FC] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-[#1F1B3D]">Жалоба на: {rep.targetTitle}</span>
                  <span className="text-[#858394]">{rep.createdAt}</span>
                </div>
                <p className="text-xs text-[#FF4444] font-semibold bg-white p-2.5 rounded-xl border border-red-100">
                  {rep.reason}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onResolveReport(rep.id, 'hide')}
                    className="px-3 py-1.5 bg-[#FF4444] text-white text-xs font-bold rounded-lg"
                  >
                    Скрыть запись с причиной
                  </button>
                  <button
                    onClick={() => onResolveReport(rep.id, 'dismiss')}
                    className="px-3 py-1.5 bg-slate-200 text-[#1F1B3D] text-xs font-bold rounded-lg"
                  >
                    Отклонить жалобу (оставить)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Missing Requests */}
        {activeTab === 'requests' && (
          <div className="p-6 overflow-y-auto space-y-3 flex-1">
            <h4 className="font-bold text-xs text-[#1F1B3D]">
              Что ищут пользователи в Приднестровье (§8, Таблица 17):
            </h4>
            {missingRequests.map((req) => (
              <div key={req.id} className="p-3.5 bg-[#FAF9FD] border border-[#E5E4F2] rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-[#1F1B3D]">{req.queryText}</span>
                  <p className="text-[#858394] text-[11px] mt-0.5">
                    Город: {req.city || 'Не указан'} · Контакт: {req.email || 'Анонимно'} · {req.createdAt}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#EEEAFB] text-[#6545C6] font-bold text-[10px]">
                  {req.status === 'in_progress' ? 'В работе' : 'Новая заявка'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
