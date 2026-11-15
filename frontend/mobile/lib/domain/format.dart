import '../core/l10n.dart';
import '../data/models/activity_parts.dart';

/// Склонение числительных — перенесено из web/src/lib/utils.ts:4-16 дословно,
/// чтобы «Найдено N», «N групп» и «ещё N адресов» звучали одинаково в обоих
/// клиентах (ТЗ §10.16).
String plural(int count, String one, String few, String many) {
  final n = count.abs() % 100;
  final n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 == 1) return one;
  return many;
}

String groupWord(int n) => plural(n, 'группа', 'группы', 'групп');

String addressWord(int n) => plural(n, 'адрес', 'адреса', 'адресов');

String reviewWord(int n) => plural(n, 'отзыв', 'отзыва', 'отзывов');

String seatsWord(int n) => plural(n, 'место', 'места', 'мест');

/// Дата в формате ДД.ММ.ГГГГ — как требует §3.3.11 и §10.5.
String formatDate(DateTime? value) {
  if (value == null) return '';
  final local = value.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(local.day)}.${two(local.month)}.${local.year}';
}

/// Окно свежести подтверждения контактов — дословно серверное правило
/// `COALESCE(c.contacts_verified_at >= current_date - 90, false)`
/// (backend/Talentro `internal/repository/activity.go:47`,
/// `internal/repository/catalog.go:29`).
const int contactsVerificationWindowDays = 90;

/// Порядковый номер календарного дня. Считается через `DateTime.utc`, чтобы
/// переход летнего/зимнего времени (Europe/Chisinau) не сдвигал отсечку:
/// `Duration(days: 90)` через границу DST даёт 2159 или 2161 час, а PostgreSQL
/// `current_date - 90` считает именно датами.
int _dayNumber(DateTime value) {
  final local = value.toLocal();
  return DateTime.utc(
    local.year,
    local.month,
    local.day,
  ).millisecondsSinceEpoch ~/
      Duration.millisecondsPerDay;
}

/// Клиентская копия серверного правила «не старше 90 дней».
///
/// `current_date` в PostgreSQL — дата без времени суток, поэтому отсечка
/// считается по календарным дням, а не от «сейчас». `null` не свежее никогда:
/// ровно поэтому на живом стенде `verified: true` только у 1 карточки из 10.
bool contactsVerifiedWithinWindow(
  DateTime? verifiedAt, {
  DateTime? now,
  int windowDays = contactsVerificationWindowDays,
}) {
  if (verifiedAt == null) return false;
  final today = now ?? DateTime.now();
  return _dayNumber(verifiedAt) >= _dayNumber(today) - windowDays;
}

/// Плашка доверия в блоке контактов (§3.3.11, §11.3).
///
/// Источник истины — флаг `verified` **самой карточки**: сервер уже прогнал
/// через него правило 90 дней, и `contacts_verified_at = NULL` или дата старше
/// 90 дней приходят к клиенту как `verified: false`. Даты `contacts_verified_at`
/// у занятия в ответе §7 нет вовсе (43 поля, список в `API.md`).
///
/// Прежний вызов брал дату у организации (`organization.contacts_verified_at`),
/// и это была ошибка: на стенде она `NULL` у всех 10 организаций и у всех 12
/// точек, поэтому бейдж гас даже при `verified: true`. Флаг организации к
/// плашке карточки отношения не имеет.
///
/// `verifiedAt` оставляем только на случай, когда сервер начнёт отдавать
/// настоящую дату карточки: тогда показываем её (web:
/// ActivityDetail.tsx:694-698). Дату правки (`updated_at`) подставлять нельзя —
/// это выдуманная дата (§11).
String verificationLabel(bool verified, {DateTime? verifiedAt}) {
  if (!verified) return AppStrings.tentativeData;
  if (verifiedAt != null) {
    return '${AppStrings.verifiedPrefix} ${formatDate(verifiedAt)}';
  }
  return AppStrings.contactsVerifiedRecent;
}

/// Адрес всегда с районом и городом, «центр города» — не адрес (§10.4).
/// Формат строки — как в web/src/components/catalog/ActivityCard.tsx:256-264:
/// `Город, Район, Улица`; при отсутствии точки — «Адрес уточняется».
String addressLine({String? city, String? district, String? address}) {
  if (city == null && district == null && address == null) {
    return AppStrings.addressClarifying;
  }
  final parts = [
    city,
    district,
    address,
  ].where((part) => part != null && part.trim().isNotEmpty).join(', ');
  return parts.isEmpty ? AppStrings.addressClarifying : parts;
}

/// Возраст по всем группам карточки — дословно web/src/components/activity/
/// ActivityDetail.tsx:67-75 (`ageSummary`).
String ageSummary(List<ActivityGroup> groups) {
  final ages = <int>[
    for (final group in groups) ...[
      if (group.ageFrom != null) group.ageFrom!,
      if (group.ageTo != null) group.ageTo!,
    ],
  ];
  if (ages.isEmpty) return AppStrings.ageClarifying;
  final min = ages.reduce((a, b) => a <= b ? a : b);
  final max = ages.reduce((a, b) => a >= b ? a : b);
  if (min == 0 && max == 99) return AppStrings.forWholeFamily;
  if (max >= 99) return 'От $min лет';
  return '$min–$max лет';
}

/// Возраст одной группы — web/src/lib/filters.ts:469-473 (`formatAge`).
String groupAgeLabel(int? ageFrom, int? ageTo) {
  if (ageFrom == null && ageTo == null) return '';
  if (ageFrom == ageTo) return '$ageFrom лет';
  return '$ageFrom–$ageTo лет';
}

/// Строка расписания группы: «Пн, Ср 15:00–16:00» — логика
/// web/src/lib/filters.ts:475-485 (`formatSchedule`), с тем отличием, что
/// сервер отдаёт `weekday` числом, а web-мок — подписью дня.
///
/// Слот без времени всё равно остаётся строкой расписания — иначе группа с
/// опубликованным днём, но без часов выглядела бы пустой.
String scheduleSummary(List<ScheduleSlot> slots) {
  if (slots.isEmpty) return '';
  final byTime = <String, List<String>>{};
  for (final slot in slots) {
    final from = slot.timeFrom, to = slot.timeTo;
    final day = weekdayLabel(slot.weekday);
    final key = (from != null && to != null) ? '$from–$to' : day;
    if (key.isEmpty) continue;
    final days = byTime.putIfAbsent(key, () => <String>[]);
    if (day.isNotEmpty && !days.contains(day)) days.add(day);
  }
  return byTime.entries.map((entry) {
    final days = entry.value.join(', ');
    if (days.isEmpty || days == entry.key) return entry.key;
    return '$days ${entry.key}';
  }).join(' · ');
}

/// Заголовок одного слота — «Вт 15:00–16:00», с тем что реально пришло.
String scheduleSlotHead(ScheduleSlot slot) {
  final day = weekdayLabel(slot.weekday);
  final from = slot.timeFrom, to = slot.timeTo;
  final time = (from != null && to != null) ? '$from–$to' : '';
  return [day, time].where((part) => part.isNotEmpty).join(' ');
}

/// Пояснения по слотам — `note` и `seats` внутри `groups[].schedules[]`
/// (§7: расписание живёт в группе, а не на карточке). Пустой список, когда ни
/// пояснений, ни мест не прислали — экран тогда не рисует лишний блок.
List<String> scheduleSlotNotes(List<ScheduleSlot> slots) {
  final lines = <String>[];
  for (final slot in slots) {
    final bits = <String>[
      if (slot.note case final note? when note.trim().isNotEmpty) note.trim(),
      if (slot.seats case final seats? when seats > 0)
        '$seats ${seatsWord(seats)}',
    ];
    if (bits.isEmpty) continue;
    final head = scheduleSlotHead(slot);
    lines.add(head.isEmpty ? bits.join(', ') : '$head: ${bits.join(', ')}');
  }
  return lines;
}

/// Подпись дня по номеру. Нумерацию зафиксировал контракт (`API.md`:
/// `1…7`, где 1 — понедельник), та же она у параметра `day` — поэтому подпись и
/// фильтр не разъезжаются. Сверено с живым стендом: `?day=7` вернул единственное
/// занятие с блиц-турнирами, а в сиде оно описано как «по воскресеньям».
String weekdayLabel(int? weekday) => switch (weekday) {
  1 => 'Пн',
  2 => 'Вт',
  3 => 'Ср',
  4 => 'Чт',
  5 => 'Пт',
  6 => 'Сб',
  7 => 'Вс',
  _ => '',
};

/// Формат занятия — подписи web/src/components/activity/ActivityDetail.tsx:349-357.
String formatLabel(String? format) => switch (format) {
  'online' => AppStrings.formatOnline,
  'both' => AppStrings.formatBoth,
  _ => AppStrings.formatOffline,
};

/// Тип занятия — подписи web/src/components/activity/ActivityDetail.tsx:362-372.
String typeLabel({required bool isService, String? lessonType}) {
  if (isService) return AppStrings.typeService;
  return switch (lessonType) {
    'individual' => AppStrings.typeIndividual,
    'both' => AppStrings.typeBoth,
    _ => AppStrings.typeGroup,
  };
}
