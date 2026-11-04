/// Адрес API. Передаётся сборкой через `--dart-define=API_BASE_URL=...`.
///
/// Дефолт — стенд координатора (§7-канон на :8080), а не `localhost`: приложение
/// ставится на телефон или эмулятор, и с них адрес машины-стенда должен быть
/// прописан заранее, чтобы сборка запусклась без ручной правки кода. Для своего
/// локального сервера в эмуляторе передайте
/// `--dart-define=API_BASE_URL=http://10.0.2.2:8081` — `10.0.2.2` это хост-машина.
class ApiConfig {
  const ApiConfig({required this.baseUrl});

  final String baseUrl;

  /// Значение по умолчанию: LAN-адрес стенда, который отдаёт канон §7.
  static const String standDefault = 'http://26.52.103.163:8080';

  /// Сборка передаёт адрес как строку флага, поэтому хвостовой `/` и пробелы
  /// здесь нормализуются: `...:8080/` склеился бы с `/api/v1` в `//api/v1`, а
  /// стенд на такой путь отвечает 404 — при визуально верном URL.
  static String normalizeBaseUrl(String value) =>
      value.trim().replaceAll(RegExp(r'/+$'), '');

  factory ApiConfig.fromEnvironment() {
    final defined = normalizeBaseUrl(
      const String.fromEnvironment('API_BASE_URL'),
    );
    return ApiConfig(baseUrl: defined.isNotEmpty ? defined : standDefault);
  }

  String get v1 => '$baseUrl/api/v1';

  Uri get activities => Uri.parse('$v1/activities');

  /// Slug из ответа сервера подставляется в путь только закодированным: иначе
  /// значение с `/` или `?` меняло бы сам маршрут.
  Uri activityBySlug(String slug) =>
      Uri.parse('$v1/activities/${Uri.encodeComponent(slug)}');

  /// Список занятий организации. Фильтра `?org=` в каталоге нет (§5), поэтому
  /// страница организации строится отсюда.
  Uri organizationBySlug(String slug) =>
      Uri.parse('$v1/organizations/${Uri.encodeComponent(slug)}');

  Uri get categories => Uri.parse('$v1/categories');

  Uri get cities => Uri.parse('$v1/cities');

  Uri get districts => Uri.parse('$v1/districts');

  // Маршрутов авторизации здесь намеренно нет: `/api/auth/*` и `/me` в
  // контракте ещё не реализованы, а держать клиентский метод под 404 — значит
  // просадить архитектуру на форму, которая переписывается. Слой входа
  // добавляется вместе с контрактом; куки тем временем уже хранит CookieJar.
}
