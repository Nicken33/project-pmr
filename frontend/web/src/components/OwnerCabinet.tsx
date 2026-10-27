import React, { useState } from 'react';
import { 
  X, Plus, CheckCircle2, Clock, AlertTriangle, 
  Trash2, Building, Calendar, MapPin, ChevronRight, ArrowLeft 
} from 'lucide-react';
import { ActivityItem, ActivityGroup, LocationPoint, TopCategoryId, ActivityType, FormatType } from '../types';
import { CITIES, DISTRICTS_TIRASPOL, TOP_CATEGORIES } from '../data/mockData';

interface OwnerCabinetProps {
  isOpen: boolean;
  onClose: () => void;
  myActivities: ActivityItem[];
  onCreateActivity: (act: ActivityItem) => void;
  onToggleActive: (id: string) => void;
}

export const OwnerCabinet: React.FC<OwnerCabinetProps> = ({
  isOpen,
  onClose,
  myActivities,
  onCreateActivity,
  onToggleActive,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'activity' | 'service'>('activity');
  const [topCategory, setTopCategory] = useState<TopCategoryId>('art');
  const [subcategory, setSubcategory] = useState('рисование');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<FormatType>('offline');
  const [activityType, setActivityType] = useState<ActivityType>('group');
  const [phone, setPhone] = useState('+373 777 12345');
  const [telegram, setTelegram] = useState('');

  // Groups state
  const [groups, setGroups] = useState<ActivityGroup[]>([
    {
      id: 'grp-new-1',
      activityId: 'new',
      title: 'Основная группа',
      ageFrom: 7,
      ageTo: 14,
      priceFrom: 1800,
      period: 'месяц',
      locationId: 'loc-new-1',
      scheduleLines: [
        { day: 'Понедельник', startTime: '16:00', endTime: '17:30', note: 'форма любая' },
        { day: 'Среда', startTime: '16:00', endTime: '17:30' },
      ],
      seatsLeft: 5,
    },
  ]);

  // Locations state
  const [locations, setLocations] = useState<LocationPoint[]>([
    {
      id: 'loc-new-1',
      orgId: 'my-org',
      title: 'Центральный зал',
      city: 'Тирасполь',
      district: 'Центр',
      address: 'ул. 25 Октября, 50',
      lat: 46.837,
      lng: 29.615,
      phone: '+373 777 12345',
      verifiedAt: '25.04.2026',
    },
  ]);

  if (!isOpen) return null;

  const handleAddGroup = () => {
    const newGrp: ActivityGroup = {
      id: 'grp-new-' + (groups.length + 1),
      activityId: 'new',
      title: `Группа ${groups.length + 1}`,
      ageFrom: 6,
      ageTo: 12,
      priceFrom: 1500,
      period: 'месяц',
      locationId: locations[0]?.id || 'loc-new-1',
      scheduleLines: [{ day: 'Вторник', startTime: '17:00', endTime: '18:30' }],
    };
    setGroups([...groups, newGrp]);
  };

  const handleRemoveGroup = (idx: number) => {
    if (groups.length <= 1) return; // §3.8 п.6: Удалить последнюю группу нельзя!
    setGroups(groups.filter((_, i) => i !== idx));
  };

  const handleAddLocation = () => {
    const newLoc: LocationPoint = {
      id: 'loc-new-' + (locations.length + 1),
      orgId: 'my-org',
      title: `Филиал ${locations.length + 1}`,
      city: 'Тирасполь',
      district: 'Балка',
      address: 'ул. Юности, 10',
      lat: 46.832,
      lng: 29.654,
      phone,
    };
    setLocations([...locations, newLoc]);
  };

  const handleRemoveLocation = (idx: number) => {
    if (locations.length <= 1) return; // §3.8 п.6: Удалить последнюю точку нельзя!
    setLocations(locations.filter((_, i) => i !== idx));
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newActivity: ActivityItem = {
      id: 'act-' + Date.now(),
      slug: 'my-activity-' + Date.now(),
      title: title.trim(),
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        slug: 'palitra',
        name: 'Академия «Палитра»',
        type: 'студия',
        phone,
        messengers: { telegram },
      },
      kind,
      topCategory,
      topCategoryLabel: TOP_CATEGORIES.find((c) => c.id === topCategory)?.label || 'Творчество',
      subcategory,
      activityType,
      format,
      description: description || 'Описание секции и программа обучения.',
      phone,
      messengers: { telegram },
      photos: ['/src/assets/images/hero_creative_arts_1792908981359.jpg'],
      verifiedAt: '25.04.2026',
      source: 'лично',
      status: 'pending', // sent for moderation!
      isActive: true,
      createdAt: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      groups,
      locations,
      reviews: [],
    };

    onCreateActivity(newActivity);
    setIsCreating(false);
    setWizardStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4F2] flex items-center justify-between bg-[#F7F6FC]">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-[#6545C6]" />
            <div>
              <h3 className="font-extrabold text-base text-[#1F1B3D]">
                Кабинет владельца секции / мастера
              </h3>
              <p className="text-xs text-[#858394]">
                Академия искусств «Палитра» (Тирасполь)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of my activities or wizard */}
        {!isCreating ? (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-base text-[#1F1B3D]">
                  Мои анкеты в каталоге ({myActivities.length})
                </h4>
                <p className="text-xs text-[#858394]">
                  Статусы: на проверке, опубликовано или отклонено
                </p>
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Новая анкета</span>
              </button>
            </div>

            <div className="space-y-3">
              {myActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-2xl border border-[#E5E4F2] bg-[#FAF9FD] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-[#6545C6]">{act.topCategoryLabel}</span>
                      <span>·</span>
                      {act.status === 'published' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EAF7EE] text-[#1E9E4A] font-bold text-[10px]">
                          ✓ Опубликовано
                        </span>
                      )}
                      {act.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                          ⏳ На проверке (до 2 дней)
                        </span>
                      )}
                      {act.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#FF4444] font-bold text-[10px]">
                          ✕ Отклонено: {act.rejectReason}
                        </span>
                      )}
                    </div>
                    <h5 className="font-black text-sm text-[#1F1B3D]">{act.title}</h5>
                    <p className="text-xs text-[#858394]">
                      {act.locations.length} адреса · {act.groups.length} группы · {act.upvotes} плюсов
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggleActive(act.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#C7C5D8] hover:bg-slate-100"
                    >
                      {act.isActive ? 'Снять с публикации' : 'Опубликовать'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Step-by-Step Wizard Form (§3.8 п.2) */
          <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#E5E4F2]">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 1 ? 'bg-[#6545C6] text-white' : 'bg-slate-100 text-[#858394]'}`}>1</span>
                <span>Основное</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 2 ? 'bg-[#6545C6] text-white' : 'bg-slate-100 text-[#858394]'}`}>2</span>
                <span>Группы</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 3 ? 'bg-[#6545C6] text-white' : 'bg-slate-100 text-[#858394]'}`}>3</span>
                <span>Точки</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 4 ? 'bg-[#6545C6] text-white' : 'bg-slate-100 text-[#858394]'}`}>4</span>
                <span>Контакты</span>
              </div>
            </div>

            {/* Step 1: Main info */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1F1B3D]">Название секции / услуги *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Студия живописи и графики «Акварель»"
                    className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F1B3D]">Тип записи *</label>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as any)}
                      className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs"
                    >
                      <option value="activity">Занятие / Секция</option>
                      <option value="service">Услуга</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1F1B3D]">Категория *</label>
                    <select
                      value={topCategory}
                      onChange={(e) => setTopCategory(e.target.value as any)}
                      className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs"
                    >
                      {TOP_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1F1B3D]">Описание своими словами *</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Чему научится ученик, какая программа, условия..."
                    className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Groups */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-[#1F1B3D]">Возрастные группы (минимум 1):</h5>
                  <button
                    onClick={handleAddGroup}
                    className="px-3 py-1 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-lg"
                  >
                    + Добавить группу
                  </button>
                </div>

                {groups.map((grp, idx) => (
                  <div key={grp.id} className="p-3 bg-[#FAF9FD] rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{grp.title || `Группа ${idx + 1}`}</span>
                      <button
                        onClick={() => handleRemoveGroup(idx)}
                        disabled={groups.length <= 1}
                        title={groups.length <= 1 ? 'Нельзя удалить последнюю группу' : 'Удалить'}
                        className="text-[#FF4444] disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[#858394] block">Возраст от</label>
                        <input
                          type="number"
                          value={grp.ageFrom}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setGroups(groups.map((g, i) => i === idx ? { ...g, ageFrom: val } : g));
                          }}
                          className="w-full p-1.5 bg-white border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#858394] block">Возраст до</label>
                        <input
                          type="number"
                          value={grp.ageTo}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setGroups(groups.map((g, i) => i === idx ? { ...g, ageTo: val } : g));
                          }}
                          className="w-full p-1.5 bg-white border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#858394] block">Цена (руб. ПМР)</label>
                        <input
                          type="number"
                          value={grp.priceFrom}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setGroups(groups.map((g, i) => i === idx ? { ...g, priceFrom: val } : g));
                          }}
                          className="w-full p-1.5 bg-white border rounded-lg text-xs font-bold text-[#6545C6]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Locations */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-[#1F1B3D]">Точки проведения (минимум 1):</h5>
                  <button
                    onClick={handleAddLocation}
                    className="px-3 py-1 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-lg"
                  >
                    + Добавить филиал
                  </button>
                </div>

                {locations.map((loc, idx) => (
                  <div key={loc.id} className="p-3 bg-[#FAF9FD] rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{loc.title || `Точка ${idx + 1}`}</span>
                      <button
                        onClick={() => handleRemoveLocation(idx)}
                        disabled={locations.length <= 1}
                        title={locations.length <= 1 ? 'Нельзя удалить последнюю точку' : 'Удалить'}
                        className="text-[#FF4444] disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#858394] block">Район в Тирасполе</label>
                        <select
                          value={loc.district}
                          onChange={(e) => {
                            const d = e.target.value;
                            setLocations(locations.map((l, i) => i === idx ? { ...l, district: d } : l));
                          }}
                          className="w-full p-1.5 bg-white border rounded-lg text-xs"
                        >
                          {DISTRICTS_TIRASPOL.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#858394] block">Точный адрес (улица, дом)</label>
                        <input
                          type="text"
                          value={loc.address}
                          onChange={(e) => {
                            const a = e.target.value;
                            setLocations(locations.map((l, i) => i === idx ? { ...l, address: a } : l));
                          }}
                          className="w-full p-1.5 bg-white border rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Contacts & Photos */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1F1B3D]">Телефон для связи (+373 77X XX XXX) *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1F1B3D]">Telegram / Viber аккаунт</label>
                  <input
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@studio_pmr"
                    className="w-full p-2.5 bg-[#F7F6FC] border rounded-xl text-xs"
                  />
                </div>

                <div className="p-3 bg-[#EAF7EE] rounded-xl text-xs text-[#1E9E4A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>После сохранения анкета поступит в очередь модерации (регламент ответа: до 2 рабочих дней).</span>
                </div>
              </div>
            )}

            {/* Wizard Navigation */}
            <div className="pt-6 border-t border-[#E5E4F2] flex items-center justify-between">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Назад
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-xs text-[#858394]"
                >
                  Отмена
                </button>
              )}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                  className="px-5 py-2.5 bg-[#6545C6] text-white text-xs font-bold rounded-xl"
                >
                  Далее
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 bg-[#34D399] hover:bg-[#2bb883] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Отправить на модерацию
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
