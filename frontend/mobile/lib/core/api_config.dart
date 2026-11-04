/// Адрес API. Передаётся сборкой через `--dart-define=API_BASE_URL=...`.
///
/// Дефолт — 10.0.2.2, а не localhost: в Android-эмуляторе хост-машина доступна
/// только по этому адресу, а командный стенд Talentro слушает порт 8081.
class ApiConfig {
  const ApiConfig({required this.baseUrl});

  final String baseUrl;

  static const String emulatorDefault = 'http://10.0.2.2:8081';

  factory ApiConfig.fromEnvironment() {
    const defined = String.fromEnvironment('API_BASE_URL');
    return ApiConfig(baseUrl: defined.isNotEmpty ? defined : emulatorDefault);
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
