/// Параметры списка каталога.
///
/// Это ТОЛЬКО сборка query-string для `GET /api/v1/activities`: никакой
/// фильтрации и сортировки на клиенте — прямой запрет ТЗ §6.3 («никакого своей
/// логики фильтрации «в голове» — все фильтры серверные»).
///
/// Имена и значения параметров — из контракта `backend/Talentro/API.md`, а не
/// из схемы URL веб-клиента: веб ставит `near=1` и расстояние считает сам,
/// сервер же просит координаты `near=широта,долгота`.
class CatalogQuery {
  const CatalogQuery({
    this.q,
    this.citySlug,
    this.districtSlugs = const [],
    this.categorySlug,
    this.age,
    this.priceMax,
    this.free = false,
    this.online,
    this.verified = false,
    this.kind,
    this.day,
    this.time,
    this.near,
    this.radiusMeters,
    this.sort,
    this.page = 1,
    this.limit = defaultLimit,
  });

  /// §9.2: limit по умолчанию 20, максимум 100 — сервер отвечает 400 на 101.
  static const int defaultLimit = 20;

  /// Значения `sort`, которые сервер принимает сегодня (контракт: `rating`
  /// даёт 400, пока нет таблицы голосов). Релевантность, «рядом со мной»,
  /// «сначала бесплатные» и «обновлённые за неделю» из ТЗ §3.1.6 среди них нет.
  static const Set<String> allowedSorts = {
    'updated',
    'price',
    'name',
    'verified',
  };

  /// Возраст одним числом N, занятие попадает, если от ≤ N ≤ до (§5.2).
  /// Диапазон принимается сервером; вне его — 400.
  static const int minAge = 1;
  static const int maxAge = 120;

  /// День недели: `1` — понедельник … `7` — воскресенье. Та же нумерация у
  /// `schedules.weekday` в карточке.
  static const int minDay = 1;
  static const int maxDay = 7;

  /// Радиус вокруг точки — от 100 метров до 50 километров.
  static const int minRadius = 100;
  static const int maxRadius = 50000;

  final String? q;
  final String? citySlug;

  /// Районы сервер принимает списком через запятую, но только вместе с городом
  /// (§5.4). Пустой список — фильтр не задан.
  final List<String> districtSlugs;

  /// Направление. Родительское тянет все дочерние (§5.5), поэтому
  /// «наднаправление» из ТЗ §3.1.3 — это тот же `category`, выбранный на уровень
  /// выше: отдельного параметра в контракте нет.
  final String? categorySlug;

  /// Возраст — одно число N, занятие попадает, если от ≤ N ≤ до (§5.2).
  final int? age;
  final int? priceMax;

  /// Только бесплатные (`price_from = 0`, §7.4).
  final bool free;

  /// `true` → формат `online` или `both`, `false` → строго `offline`, `null` —
  /// фильтр не выбран (§5.7). ТЗ §3.1.3 просит «формат (онлайн/офлайн)», поэтому
  /// состояний три, а не чекбокс.
  final bool? online;

  /// Только занятия с подтверждёнными контактами (§11.3).
  final bool verified;

  /// `activity` | `service` (§3.1.3 «тип»).
  final String? kind;

  /// День недели занятия, 1–7 (§5.6).
  final int? day;

  /// Момент в формате `ЧЧ:ММ`: занятие идёт внутри `time_from…time_to` (§5.6).
  /// Веб-клиент оперирует промежутками «утро/день/вечер», сервер — точкой; как
  /// маппить промежуток — открытый вопрос (README §7).
  final String? time;

  /// Точка «рядом со мной» (§3.1.3, §3.5).
  final GeoPoint? near;

  /// Метры от [near]; отдельно от точки сервер не принимает (400).
  final int? radiusMeters;
  final String? sort;
  final int page;
  final int limit;

  CatalogQuery copyWith({
    String? q,
    String? citySlug,
    List<String>? districtSlugs,
    String? categorySlug,
    int? age,
    int? priceMax,
    bool? free,
    bool? online,
    bool? verified,
    String? kind,
    int? day,
    String? time,
    GeoPoint? near,
    int? radiusMeters,
    String? sort,
    int? page,
    int? limit,
    bool clearQ = false,
    bool clearCity = false,
    bool clearCategory = false,
    bool clearAge = false,
    bool clearPriceMax = false,
    bool clearOnline = false,
    bool clearKind = false,
    bool clearDay = false,
    bool clearTime = false,
    bool clearNear = false,
    bool clearRadius = false,
    bool clearSort = false,
  }) => CatalogQuery(
    q: clearQ ? null : (q ?? this.q),
    citySlug: clearCity ? null : (citySlug ?? this.citySlug),
    // Снимая город, снимаем и районы: район без города сервер отклоняет (§5.4).
    districtSlugs: clearCity ? const [] : (districtSlugs ?? this.districtSlugs),
    categorySlug: clearCategory ? null : (categorySlug ?? this.categorySlug),
    age: clearAge ? null : (age ?? this.age),
    priceMax: clearPriceMax ? null : (priceMax ?? this.priceMax),
    free: free ?? this.free,
    online: clearOnline ? null : (online ?? this.online),
    verified: verified ?? this.verified,
    kind: clearKind ? null : (kind ?? this.kind),
    day: clearDay ? null : (day ?? this.day),
    time: clearTime ? null : (time ?? this.time),
    near: clearNear ? null : (near ?? this.near),
    radiusMeters: clearRadius ? null : (radiusMeters ?? this.radiusMeters),
    sort: clearSort ? null : (sort ?? this.sort),
    page: page ?? this.page,
    limit: limit ?? this.limit,
  );

  CatalogQuery get firstPage => copyWith(page: 1);

  /// Пустые значения в URL не пишутся (§5.9). Связки, которые сервер отклоняет
  /// 400 (район без города, радиус без точки), не отправляются вовсе.
  Map<String, String> toQuery() {
    final params = <String, String>{};
    void put(String key, Object? value) {
      if (value == null) return;
      final text = '$value';
      if (text.isEmpty) return;
      params[key] = text;
    }

    put('q', q?.trim());
    final city = citySlug;
    put('city', city);
    if (city != null && city.isNotEmpty) {
      put('district', districtSlugs.join(','));
    }
    put('category', categorySlug);
    put('age', age);
    put('price_max', priceMax);
    if (free) put('free', '1');
    // `online=0` — это «только офлайн», а не «фильтр снят», поэтому невыбранный
    // формат в URL отсутствует вовсе.
    final online = this.online;
    if (online != null) put('online', online ? '1' : '0');
    if (verified) put('verified', '1');
    put('kind', kind);
    final day = this.day;
    if (day != null && day >= minDay && day <= maxDay) put('day', day);
    put('time', time);
    final point = near;
    if (point != null) {
      put('near', point.toParam());
      final radius = radiusMeters;
      if (radius != null && radius >= minRadius && radius <= maxRadius) {
        put('radius', radius);
      }
    }
    final sort = this.sort;
    if (sort != null && allowedSorts.contains(sort)) put('sort', sort);
    if (page > 1) put('page', page);
    put('limit', limit);
    return params;
  }

  /// Активные фильтры для чипов с крестиком (§3.1.4). Значения — machine-slug,
  /// человекочитаемую подпись берёт справочник с сервера, не клиент.
  List<String> get activeFilterKeys => [
    if (q != null && q!.trim().isNotEmpty) 'q',
    if (citySlug != null) 'city',
    if (citySlug != null && districtSlugs.isNotEmpty) 'district',
    if (categorySlug != null) 'category',
    if (age != null) 'age',
    if (priceMax != null) 'price_max',
    if (free) 'free',
    if (online != null) 'online',
    if (verified) 'verified',
    if (kind != null) 'kind',
    if (day != null) 'day',
    if (time != null) 'time',
    if (near != null) 'near',
    if (sort != null) 'sort',
  ];

  bool get hasFilters => activeFilterKeys.isNotEmpty;
}

/// Точка для фильтра «рядом со мной». Сервер ждёт `широта,долгота` внутри
/// границ Приднестровья (`45.9–48.9`, `27.4–30.6`) и отвечает 400 вне их,
/// поэтому проверка границ живёт здесь, а не в виджете.
class GeoPoint {
  const GeoPoint({required this.lat, required this.lng});

  static const double minLat = 45.9;
  static const double maxLat = 48.9;
  static const double minLng = 27.4;
  static const double maxLng = 30.6;

  final double lat;
  final double lng;

  bool get insideRegion =>
      lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;

  /// `46.8407,29.6344` — без хвостовых нулей, которые добавляет `toStringAsFixed`.
  String toParam() => '${_plain(lat)},${_plain(lng)}';

  static String _plain(double value) {
    if (!value.toString().contains('.')) return value.toString();
    var text = value.toStringAsFixed(6);
    while (text.endsWith('0')) {
      text = text.substring(0, text.length - 1);
    }
    if (text.endsWith('.')) text = text.substring(0, text.length - 1);
    return text;
  }
}
