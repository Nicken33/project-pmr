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

/// Плашка проверки контактов (§3.3.11, §11.3): дата есть → «данные проверены
/// ДД.ММ.ГГГГ», нет → «данные ориентировочные». Третьего варианта не бывает.
String verificationLabel(DateTime? contactsVerifiedAt) {
  if (contactsVerifiedAt == null) return AppStrings.tentativeData;
  return '${AppStrings.verifiedPrefix} ${formatDate(contactsVerifiedAt)}';
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
String scheduleSummary(List<ScheduleSlot> slots) {
  if (slots.isEmpty) return '';
  final byTime = <String, List<String>>{};
  for (final slot in slots) {
    final from = slot.timeFrom, to = slot.timeTo;
    if (from == null || to == null) continue;
    final key = '$from–$to';
    byTime.putIfAbsent(key, () => []).add(weekdayLabel(slot.weekday));
  }
  return byTime.entries
      .map((entry) => '${entry.value.join(', ')} ${entry.key}')
      .join(' · ');
}

/// Подпись дня по номеру. Нумерация в ТЗ и в ответе сервера не зафиксирована
/// (приходят 1..7, в web-моке дни — строки «Пн»…«Вс»); считаем ISO-8601,
/// 1 = понедельник, и подняли вопрос координатору.
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
