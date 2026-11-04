import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../data/api/api_failure.dart';
import '../../data/models/activity.dart';
import '../../data/models/reference.dart';
import '../../domain/catalog_query.dart';

/// Состояние фильтров каталога. Единственная задача — собрать query для
/// сервера: фильтрует сервер, не клиент (§6.3).
class CatalogQueryController extends Notifier<CatalogQuery> {
  @override
  CatalogQuery build() => const CatalogQuery();

  /// Пустой поиск — это «снять q», а не `q=` в URL (§5.9).
  void setSearch(String value) {
    final trimmed = value.trim();
    state = trimmed.isEmpty
        ? state.copyWith(clearQ: true, page: 1)
        : state.copyWith(q: trimmed, page: 1);
  }

  /// Смена города снимает районы: они относятся к прежнему городу, а район без
  /// города сервер отклоняет 400 (§5.4).
  void setCity(String? slug) => state = slug == null
      ? state.copyWith(clearCity: true, page: 1)
      : state.copyWith(citySlug: slug, districtSlugs: const [], page: 1);

  /// Районы — список (§5.4), и только вместе с городом. Без выбранного города
  /// фильтр не ставим вовсе: сервер отвечает 400.
  void setDistrict(List<String> slugs) {
    final value = slugs.where((slug) => slug.isNotEmpty).toList();
    if (value.isEmpty || state.citySlug == null) {
      state = state.copyWith(districtSlugs: const [], page: 1);
      return;
    }
    state = state.copyWith(districtSlugs: value, page: 1);
  }

  void setCategory(String? slug) => state = slug == null
      ? state.copyWith(clearCategory: true, page: 1)
      : state.copyWith(categorySlug: slug, page: 1);

  /// Возраст одним числом (§5.2); нечисловой ввод и число вне диапазона
  /// игнорируются, подсказку показывает поле ввода, а не фильтр.
  void setAge(String input) {
    final value = int.tryParse(input.trim());
    if (value == null) return;
    if (value < CatalogQuery.minAge || value > CatalogQuery.maxAge) return;
    state = state.copyWith(age: value, page: 1);
  }

  void setSort(String? value) =>
      state = value == null || !CatalogQuery.allowedSorts.contains(value)
      ? state.copyWith(clearSort: true, page: 1)
      : state.copyWith(sort: value, page: 1);

  void reset() => state = const CatalogQuery();

  /// Снять один чип активного фильтра (§3.1.4 «крестик»). Ключи — те же, что
  /// перечисляет `CatalogQuery.activeFilterKeys`.
  void clear(String key) => state = switch (key) {
    'q' => state.copyWith(clearQ: true, page: 1),
    'city' => state.copyWith(clearCity: true, page: 1),
    'district' => state.copyWith(districtSlugs: const [], page: 1),
    'category' => state.copyWith(clearCategory: true, page: 1),
    'age' => state.copyWith(clearAge: true, page: 1),
    'price_max' => state.copyWith(clearPriceMax: true, page: 1),
    'free' => state.copyWith(free: false, page: 1),
    // Снятая галка формата — «фильтр не выбран», то есть null, а не «офлайн».
    'online' => state.copyWith(clearOnline: true, page: 1),
    'verified' => state.copyWith(verified: false, page: 1),
    'kind' => state.copyWith(clearKind: true, page: 1),
    'day' => state.copyWith(clearDay: true, page: 1),
    'time' => state.copyWith(clearTime: true, page: 1),
    'near' => state.copyWith(clearNear: true, clearRadius: true, page: 1),
    'sort' => state.copyWith(clearSort: true, page: 1),
    _ => state,
  };
}

final catalogQueryProvider =
    NotifierProvider<CatalogQueryController, CatalogQuery>(
      CatalogQueryController.new,
    );

/// Накопленный список вместе с метаданными пагинации.
class CatalogState {
  const CatalogState({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    this.isLoadingMore = false,
  });

  factory CatalogState.fromPage(ActivityPage page) => CatalogState(
    items: page.items,
    total: page.total,
    page: page.page,
    limit: page.limit,
  );

  final List<ActivityListItem> items;
  final int total;
  final int page;
  final int limit;
  final bool isLoadingMore;

  bool get hasMore => items.isNotEmpty && page * limit < total;

  CatalogState withLoadingMore(bool value) => CatalogState(
    items: items,
    total: total,
    page: page,
    limit: limit,
    isLoadingMore: value,
  );

  CatalogState appended(ActivityPage next) => CatalogState(
    items: [...items, ...next.items],
    total: next.total,
    page: next.page,
    limit: next.limit,
  );
}

/// Каталог: первая страница перечитывается при смене фильтров, «Показать ещё»
/// дописывает следующую (§3.1.7).
class CatalogController extends AsyncNotifier<CatalogState> {
  @override
  Future<CatalogState> build() async {
    final query = ref.watch(catalogQueryProvider);
    final page = await ref.read(apiClientProvider).activities(query);
    return CatalogState.fromPage(page);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) return;

    state = AsyncData(current.withLoadingMore(true));
    try {
      final query = ref.read(catalogQueryProvider);
      final next = await ref
          .read(apiClientProvider)
          .activities(query.copyWith(page: current.page + 1));
      state = AsyncData(current.appended(next));
    } on ApiFailure {
      // Ошибка догрузки не превращает уже показанный список в экран ошибки:
      // остаёмся на текущей странице, кнопка снова активна.
      state = AsyncData(current.withLoadingMore(false));
    }
  }
}

final catalogProvider = AsyncNotifierProvider<CatalogController, CatalogState>(
  CatalogController.new,
);

/// Три карточки «рядом по теме» для пустого результата (§3.1.8).
///
/// Второй запрос уходит только когда первый честно ответил пустым списком: на
/// загрузке и на ошибке карточек нет, иначе под экраном ошибки вырос бы ещё
/// один список. Сбой самого второго запроса тоже молча оставляет пустоту —
/// образцы украшают «ничего не нашлось», а не заменяют его; сайт ведёт себя так
/// же (`web/src/app/page.tsx:107-115`), поэтому и здесь та же развилка (§16).
final nearbyExamplesProvider = FutureProvider<List<ActivityListItem>>((
  ref,
) async {
  final catalog = ref.watch(catalogProvider);
  final state = catalog.value;
  if (catalog.isLoading || catalog.hasError || state == null) {
    return const [];
  }
  if (state.items.isNotEmpty) return const [];
  try {
    final page = await ref
        .read(apiClientProvider)
        .activities(CatalogQuery.examples());
    return page.items;
  } on ApiFailure {
    return const [];
  }
});

/// Справочники для фильтров: единственный источник — сервер (§4.5).
final categoriesProvider = FutureProvider<List<CategoryNode>>(
  (ref) => ref.watch(apiClientProvider).categories(),
);

final citiesProvider = FutureProvider<List<City>>(
  (ref) => ref.watch(apiClientProvider).cities(),
);

final districtsProvider = FutureProvider.family<List<District>, String>(
  (ref, citySlug) => ref.watch(apiClientProvider).districts(citySlug),
);
