/// Параметры списка каталога.
///
/// Это ТОЛЬКО сборка query-string для `GET /api/v1/activities`: никакой
/// фильтрации и сортировки на клиенте — прямой запрет ТЗ §6.3 («никакого своей
/// логики фильтрации «в голове» — все фильтры серверные»).
class CatalogQuery {
  const CatalogQuery({
    this.q,
    this.citySlug,
    this.districtSlug,
    this.categorySlug,
    this.age,
    this.priceMax,
    this.kind,
    this.sort,
    this.page = 1,
    this.limit = defaultLimit,
  });

  /// §9.2: limit по умолчанию 20, максимум 100 — сервер отвечает 400 на 101.
  static const int defaultLimit = 20;

  /// Значения `sort`, которые сервер принимает сегодня (проверено живым
  /// запросом 4 ноября: 400 с подсказкой «sort — updated, price, name или
  /// verified; rating ещё не считается»). Релевантность, «рядом со мной» и
  /// рейтинг в §3.1.6 пока недоступны — вопрос координатору.
  static const Set<String> allowedSorts = {
    'updated',
    'price',
    'name',
    'verified',
  };

  final String? q;
  final String? citySlug;
  final String? districtSlug;
  final String? categorySlug;

  /// Возраст — одно число N, занятие попадает, если от ≤ N ≤ до (§5.2).
  /// Диапазоном не передаётся.
  final int? age;
  final int? priceMax;

  /// `activity` | `service` (§3.1.3 «тип»).
  final String? kind;
  final String? sort;
  final int page;
  final int limit;

  CatalogQuery copyWith({
    String? q,
    String? citySlug,
    String? districtSlug,
    String? categorySlug,
    int? age,
    int? priceMax,
    String? kind,
    String? sort,
    int? page,
    int? limit,
    bool clearCity = false,
    bool clearDistrict = false,
    bool clearCategory = false,
    bool clearAge = false,
    bool clearPriceMax = false,
    bool clearKind = false,
    bool clearQ = false,
    bool clearSort = false,
  }) => CatalogQuery(
    q: clearQ ? null : (q ?? this.q),
    citySlug: clearCity ? null : (citySlug ?? this.citySlug),
    districtSlug: clearDistrict ? null : (districtSlug ?? this.districtSlug),
    categorySlug: clearCategory ? null : (categorySlug ?? this.categorySlug),
    age: clearAge ? null : (age ?? this.age),
    priceMax: clearPriceMax ? null : (priceMax ?? this.priceMax),
    kind: clearKind ? null : (kind ?? this.kind),
    sort: clearSort ? null : (sort ?? this.sort),
    page: page ?? this.page,
    limit: limit ?? this.limit,
  );

  CatalogQuery get firstPage => copyWith(page: 1);

  /// Пустые значения в URL не пишутся (§5.9).
  Map<String, String> toQuery() {
    final params = <String, String>{};
    void put(String key, Object? value) {
      if (value == null) return;
      final text = '$value';
      if (text.isEmpty) return;
      params[key] = text;
    }

    put('q', q?.trim());
    // Район без города сервер отклоняет 400 (§5.4) — не отправляем вовсе.
    final city = citySlug;
    put('city', city);
    if (city != null && city.isNotEmpty) {
      put('district', districtSlug);
    }
    put('category', categorySlug);
    put('age', age);
    put('price_max', priceMax);
    put('kind', kind);
    if (sort != null && allowedSorts.contains(sort)) {
      put('sort', sort);
    }
    if (page > 1) put('page', page);
    put('limit', limit);
    return params;
  }

  /// Активные фильтры для чипов с крестиком (§3.1.4). Значения — machine-slug,
  /// человекочитаемую подпись берёт справочник с сервера, не клиент.
  List<String> get activeFilterKeys => [
    if (q != null && q!.trim().isNotEmpty) 'q',
    if (citySlug != null) 'city',
    if (citySlug != null && districtSlug != null) 'district',
    if (categorySlug != null) 'category',
    if (age != null) 'age',
    if (priceMax != null) 'price_max',
    if (kind != null) 'kind',
    if (sort != null) 'sort',
  ];

  bool get hasFilters => activeFilterKeys.isNotEmpty;
}
