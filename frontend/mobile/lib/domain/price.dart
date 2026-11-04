import '../core/l10n.dart';

/// Формат цены по правилу координатора (4 ноября 2026):
/// * все группы 0 → «Бесплатно» плашкой;
/// * иначе → «от N» по минимальной положительной;
/// * ни одной цены нет → «Цена не указана».
///
/// NaN и Infinity наружу не выводятся: значения приходят из PostgreSQL как
/// целые рубли, но колонка nullable (§8 табл. 1-А), поэтому пустота — это null,
/// а не ноль (§7.5 «пустое ≠ ноль»).
String priceLabel(Iterable<int?> groupPrices) {
  final known = groupPrices.whereType<int>().toList();
  if (known.isEmpty) return AppStrings.priceNotSpecified;

  final positive = known.where((value) => value > 0).toList();
  if (positive.isEmpty) return AppStrings.free;

  final min = positive.reduce((a, b) => a <= b ? a : b);
  return 'от $min ${AppStrings.currency}';
}

/// Строка цены одной группы: «300 руб. ПМР» или «300–400 руб. ПМР»
/// (формат — web/src/lib/utils.ts:96-98, пример в ТЗ §3.3.3).
/// Возвращает null, когда группу показать в цене нельзя, — вызывающий обязан
/// подставить «Цена не указана», а не выдумать значение.
String? groupPriceLabel(int? priceFrom, int? priceTo) {
  if (priceFrom == null) return null;
  if (priceFrom == 0 && (priceTo == null || priceTo == 0)) {
    return AppStrings.free;
  }
  if (priceTo == null || priceTo == priceFrom) {
    return '$priceFrom ${AppStrings.currency}';
  }
  return '$priceFrom–$priceTo ${AppStrings.currency}';
}

/// Период оплаты в строке цены. Контракт фиксирует три machine-значения —
/// `session`, `month`, `course` (схема БД других не допускает), — и `null` у
/// бесплатных групп.
///
/// Формулировка «в месяц» взята дословно из ТЗ §3.3.3 (пример «300 руб. ПМР
/// в месяц»); слова для остальных значений — падежная форма словаря
/// §8 табл. 1-А п.8 («тренировка | месяц | курс»), своих названий здесь нет.
String periodSuffix(String? period) => switch (period) {
  'month' => ' в месяц',
  'session' => ' за тренировку',
  'course' => ' за курс',
  _ => '',
};
