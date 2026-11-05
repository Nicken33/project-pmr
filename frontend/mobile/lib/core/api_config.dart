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

  /// Медия того же стенда, что и API: отдельной переменной сборки (`MEDIA_BASE_URL`)
  /// нет — решение координатора от 05.11, потому что домена и Caddy нет, а
  /// `/media/*` раздаёт тот же Go-сервер. В базе лежит относительный путь
  /// (`API.md:259-260`), абсолютный URL собираем здесь: иначе каждый виджет
  /// склеивал бы строку по-своему.
  Uri mediaUrl(String path) =>
      Uri.parse('$baseUrl/${path.replaceFirst(RegExp(r'^/+'), '')}');

  // Маршрутов входа здесь нет, и причина изменилась: контракт вход описывает
  // (`API.md:314-339` — register/login/google/tester/me/logout, кука
  // `talentro_session` HttpOnly SameSite=Lax Max-Age=2592000), но ни один из
  // этих шести маршрутов мобильный клиент пока не вызывает: экрана входа нет,
  // а `CookieJar` уже готов принять куку, когда слой входа появится. Токен в
  // коде приложения не хранится и заголовок `Authorization` не ставится —
  // сессия живёт только в куках (§12.1).
}
