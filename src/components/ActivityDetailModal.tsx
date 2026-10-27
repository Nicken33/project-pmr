import React, { useState } from 'react';
import { 
  X, Heart, Share2, Phone, MapPin, Clock, Users, 
  ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle, 
  CheckCircle2, Send, ChevronRight, ArrowRight, MessageCircle 
} from 'lucide-react';
import { ActivityItem, ActivityGroup, LocationPoint, ReviewItem } from '../types';

interface ActivityDetailModalProps {
  activity: ActivityItem | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onStartBooking: (activity: ActivityItem) => void;
  isGuest: boolean;
  onGuestAction: () => void;
  onVote: (activityId: string, direction: 1 | -1) => void;
  onAddReview: (activityId: string, text: string) => void;
  onReportActivity: (activityId: string, title: string, reason: string) => void;
  onOpenOrgPage: (orgId: string) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
  onStartBooking,
  isGuest,
  onGuestAction,
  onVote,
  onAddReview,
  onReportActivity,
  onOpenOrgPage,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(activity?.groups[0]?.id || '');
  const [reviewText, setReviewText] = useState('');
  const [reviewAgreed, setReviewAgreed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState('Данные устарели или изменился телефон');

  if (!isOpen || !activity) return null;

  const currentGroup = activity.groups.find((g) => g.id === selectedGroupId) || activity.groups[0];
  const currentLocation = activity.locations.find((l) => l.id === currentGroup?.locationId) || activity.locations[0];

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewText.trim().length < 60 || reviewText.trim().length > 600 || !reviewAgreed) return;
    onAddReview(activity.id, reviewText.trim());
    setReviewText('');
    setReviewAgreed(false);
  };

  const handleSendReport = () => {
    onReportActivity(activity.id, activity.title, reportReason);
    setShowReportInput(false);
    alert('Ваша жалоба отправлена в очередь проверки модераторам Talentro!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Media Gallery */}
        <div className="relative aspect-[16/8] sm:aspect-[16/7] w-full overflow-hidden bg-[#EEEAFB] shrink-0">
          <img
            src={activity.photos[0]}
            alt={activity.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

          {/* Top Actions overlay */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center cursor-pointer transition-colors"
                title="Поделиться"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (isGuest) onGuestAction();
                  else onToggleFavorite(activity.id);
                }}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center cursor-pointer transition-colors ${
                  isFavorite ? 'bg-white text-[#FF4444]' : 'bg-black/50 hover:bg-black/70 text-white'
                }`}
                title={isFavorite ? 'Удалить из избранного' : 'В избранное'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#FF4444]' : ''}`} />
              </button>
            </div>
          </div>

          {copiedLink && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/95 text-[#1F1B3D] text-xs font-bold rounded-full shadow-lg">
              Ссылка скопирована!
            </div>
          )}

          {/* Verification Badge on Photo */}
          <div className="absolute bottom-4 left-4">
            {activity.verifiedAt ? (
              <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-[#1E9E4A] font-bold text-xs flex items-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-4 h-4" />
                <span>Данные проверены {activity.verifiedAt}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-amber-700 font-bold text-xs flex items-center gap-1.5 shadow-md">
                <span>Данные ориентировочные</span>
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-[#5B5870]">
          {/* Section 1: Title, Org, Price & Primary CALL CTA */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#E5E4F2]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-[#EEEAFB] text-[#6545C6] font-extrabold text-xs">
                  {activity.topCategoryLabel}
                </span>
                <span>·</span>
                <button
                  onClick={() => onOpenOrgPage(activity.orgId)}
                  className="font-bold text-[#1F1B3D] hover:text-[#6545C6] hover:underline cursor-pointer"
                >
                  {activity.organization.name} ➔
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#1F1B3D]">
                {activity.title}
              </h2>

              <div className="mt-2 flex items-baseline gap-2">
                {currentGroup?.priceFrom === 0 ? (
                  <span className="px-3 py-1 rounded-lg bg-[#EAF7EE] text-[#1E9E4A] font-black text-lg">
                    Бесплатно
                  </span>
                ) : (
                  <span className="text-xl font-black text-[#6545C6]">
                    {currentGroup?.priceFrom}
                    {currentGroup?.priceTo ? `–${currentGroup.priceTo}` : ''} руб. ПМР / {currentGroup?.period || 'месяц'}
                  </span>
                )}
              </div>
            </div>

            {/* Voting & Report Buttons */}
            <div className="flex items-center gap-2 self-start">
              <div className="flex items-center gap-1.5 bg-[#F7F6FC] p-1.5 rounded-xl border border-[#E5E4F2]">
                <button
                  onClick={() => {
                    if (isGuest) onGuestAction();
                    else onVote(activity.id, 1);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activity.userVote === 1 ? 'bg-[#34D399] text-white' : 'hover:bg-white text-[#1F1B3D]'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5 inline mr-1" />
                  <span>+{activity.upvotes}</span>
                </button>
                <button
                  onClick={() => {
                    if (isGuest) onGuestAction();
                    else onVote(activity.id, -1);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activity.userVote === -1 ? 'bg-[#FF4444] text-white' : 'hover:bg-white text-[#1F1B3D]'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5 inline mr-1" />
                  <span>-{activity.downvotes}</span>
                </button>
              </div>

              <button
                onClick={() => setShowReportInput(!showReportInput)}
                className="p-2 text-[#858394] hover:text-[#FF4444] rounded-xl hover:bg-slate-100 transition-colors"
                title="Пожаловаться / данные устарели"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Report input drawer if triggered */}
          {showReportInput && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
              <h5 className="font-bold text-[#1F1B3D] text-xs">Заявка модератору: что не так с данными?</h5>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full text-xs p-2 rounded-xl bg-white border"
              >
                <option>Данные устарели или изменился телефон</option>
                <option>Секция больше не работает по указанному адресу</option>
                <option>Указана неверная стоимость</option>
                <option>Недостоверное расписание занятий</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleSendReport}
                  className="px-4 py-1.5 bg-[#FF4444] text-white text-xs font-bold rounded-lg"
                >
                  Отправить модераторам
                </button>
                <button
                  onClick={() => setShowReportInput(false)}
                  className="px-3 py-1.5 bg-slate-200 text-xs font-semibold rounded-lg"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Contact Options & Big Call button (§10.1: самое заметное действие!) */}
          <div className="p-4 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-[#858394] block">Телефон секции:</span>
                <span className="font-mono text-base font-black text-[#1F1B3D]">
                  {activity.phone}
                </span>
              </div>

              <a
                href={`tel:${activity.phone.replace(/\s+/g, '')}`}
                className="px-6 py-3 bg-[#34D399] hover:bg-[#2bb883] text-white text-sm font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
              >
                <Phone className="w-5 h-5" />
                <span>Позвонить прямо сейчас</span>
              </a>
            </div>

            {/* Messengers - each on its line with clickable link (§3.3 п.7) */}
            <div className="pt-2 border-t border-[#E5E4F2] grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activity.messengers.telegram && (
                <a
                  href={`https://t.me/${activity.messengers.telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white border hover:bg-sky-50 text-sky-600 font-bold text-xs flex items-center gap-2 justify-center"
                >
                  <span>Telegram</span>
                </a>
              )}
              {activity.messengers.viber && (
                <a
                  href={`viber://chat?number=${activity.messengers.viber.replace(/\D/g, '')}`}
                  className="p-2 rounded-xl bg-white border hover:bg-purple-50 text-purple-600 font-bold text-xs flex items-center gap-2 justify-center"
                >
                  <span>Viber</span>
                </a>
              )}
              {activity.messengers.whatsapp && (
                <a
                  href={`https://wa.me/${activity.messengers.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white border hover:bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center gap-2 justify-center"
                >
                  <span>WhatsApp</span>
                </a>
              )}
              {activity.messengers.instagram && (
                <a
                  href={`https://instagram.com/${activity.messengers.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white border hover:bg-pink-50 text-pink-600 font-bold text-xs flex items-center gap-2 justify-center"
                >
                  <span>Instagram</span>
                </a>
              )}
            </div>
          </div>

          {/* Section 3: Groups Switcher (§3.3 п.12) */}
          {activity.kind === 'activity' && (
            <div className="space-y-3">
              <h4 className="font-extrabold text-sm text-[#1F1B3D]">
                Возрастные группы и расписание:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activity.groups.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroupId(grp.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedGroupId === grp.id
                        ? 'border-[#6545C6] bg-[#EEEAFB] ring-2 ring-[#6545C6]'
                        : 'border-[#E5E4F2] bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black text-xs text-[#1F1B3D] block">
                      {grp.title || `${grp.ageFrom}–${grp.ageTo} лет`}
                    </span>
                    <span className="text-[11px] text-[#6545C6] font-bold">
                      {grp.priceFrom === 0 ? 'Бесплатно' : `${grp.priceFrom} ₽ / ${grp.period}`}
                    </span>
                    {grp.seatsLeft && (
                      <span className="text-[10px] text-amber-700 block mt-0.5">
                        Осталось {grp.seatsLeft} мест
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Schedule lines for chosen group (§3.3 п.5) */}
              <div className="p-4 rounded-2xl bg-white border border-[#E5E4F2] space-y-2">
                <span className="font-bold text-xs text-[#1F1B3D] block">
                  Расписание группы «{currentGroup?.title || `${currentGroup?.ageFrom}–${currentGroup?.ageTo} лет`}»:
                </span>
                <div className="space-y-1">
                  {currentGroup?.scheduleLines.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                      <span className="font-semibold text-[#1F1B3D]">{line.day}</span>
                      <span className="font-mono text-[#6545C6] font-bold">
                        {line.startTime} – {line.endTime}
                      </span>
                      {line.note && (
                        <span className="text-[11px] text-[#858394] italic">{line.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Location details with mini map */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-sm text-[#1F1B3D]">
              Место проведения:
            </h4>
            <div className="p-3.5 bg-[#FAF9FD] rounded-2xl border border-[#E5E4F2] space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#6545C6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-xs text-[#1F1B3D] block">
                    {currentLocation.title || currentLocation.address}
                  </span>
                  <p className="text-xs text-[#5B5870]">
                    {currentLocation.city}, {currentLocation.district && `${currentLocation.district}, `}{currentLocation.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lng}#map=16/${currentLocation.lat}/${currentLocation.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold text-[#6545C6] hover:bg-[#EEEAFB]"
                >
                  Как добраться ➔
                </a>
              </div>
            </div>
          </div>

          {/* Section 5: Description */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-sm text-[#1F1B3D]">Описание</h4>
            <p className="leading-relaxed whitespace-pre-line">{activity.description}</p>
          </div>

          {/* Section 6: Reviews block (§3.3.14) */}
          <div className="pt-4 border-t border-[#E5E4F2] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-base text-[#1F1B3D]">
                  Отзывы ({activity.reviews.length})
                </h4>
                <p className="text-[11px] text-[#858394] italic">
                  Мнение посетителя: мы не проверяем, что он был на занятии (§3.3.15 ТЗ)
                </p>
              </div>
            </div>

            {activity.reviews.length === 0 ? (
              <div className="p-4 bg-[#F7F6FC] rounded-2xl text-center text-xs text-[#858394]">
                Отзывов пока нет. Будьте первым, кто оставит честный отзыв!
              </div>
            ) : (
              <div className="space-y-3">
                {activity.reviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-white rounded-2xl border border-[#E5E4F2] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1F1B3D]">{rev.authorName}</span>
                      <span className="text-[#858394] text-[11px]">{rev.createdAt}</span>
                    </div>
                    <p className="text-xs text-[#1F1B3D] leading-relaxed">{rev.text}</p>

                    {/* Owner reply if present */}
                    {rev.comments.map((comment) => (
                      <div key={comment.id} className="mt-2 p-2.5 bg-[#FAF9FD] rounded-xl border border-purple-100 text-xs">
                        <span className="font-bold text-[#6545C6] text-[10px] uppercase tracking-wider block mb-1">
                          ✓ Ответ организации ({comment.authorName}):
                        </span>
                        <p className="text-[#5B5870]">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Review form (§10.19) */}
            <form onSubmit={handleReviewSubmit} className="p-4 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#1F1B3D]">Оставить свой отзыв:</span>
                <span className={`text-[11px] font-mono ${reviewText.length >= 60 && reviewText.length <= 600 ? 'text-[#1E9E4A]' : 'text-[#858394]'}`}>
                  {reviewText.length}/600 (мин. 60)
                </span>
              </div>

              <textarea
                rows={3}
                required
                minLength={60}
                maxLength={600}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Расскажите о впечатлениях: преподаватели, атмосфера, результаты ребенка..."
                className="w-full p-2.5 bg-white border border-[#E5E4F2] rounded-xl text-xs focus:ring-2 focus:ring-[#6545C6] focus:outline-none"
              />

              <label className="flex items-start gap-2 text-[11px] text-[#5B5870] cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewAgreed}
                  onChange={(e) => setReviewAgreed(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6545C6] mt-0.5"
                />
                <span>Согласен с Условиями пользования платформы Talentro</span>
              </label>

              <button
                type="submit"
                disabled={reviewText.length < 60 || reviewText.length > 600 || !reviewAgreed}
                className="px-4 py-2 bg-[#6545C6] hover:bg-[#8064D8] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Опубликовать отзыв
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions: Call & Book */}
        <div className="p-4 sm:p-5 bg-white border-t border-[#E5E4F2] flex items-center justify-between gap-3 shrink-0">
          <a
            href={`tel:${activity.phone.replace(/\s+/g, '')}`}
            className="flex-1 py-3 px-4 bg-[#34D399] hover:bg-[#2bb883] text-white text-xs sm:text-sm font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            <span>Позвонить</span>
          </a>

          <button
            onClick={() => {
              onClose();
              onStartBooking(activity);
            }}
            className="flex-1 py-3 px-4 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-[#6545C6]/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Записаться онлайн</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
