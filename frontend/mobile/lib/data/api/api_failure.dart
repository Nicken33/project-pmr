import '../../core/l10n.dart';

/// Ошибка сервера в конверте ТЗ §9.3: `{error: {code, message, fields}}`.
///
/// Фактическая форма с живого :8081 (фикстура
/// `test/fixtures/api/districts_no_city_400.json`):
/// `{"error":{"code":400,"message":"проверь поля","fields":{"city":"…"}}}` —
/// то есть `code` приходит числом, а `fields` ключует имя параметра.
///
/// Незарегистрированные маршруты Go-роутер отдаёт текстом `404 page not found`
/// без конверта — это тоже ошибку надо нести наружу, а не молча глотать.
class ApiFailure implements Exception {
  const ApiFailure({
    required this.statusCode,
    required this.message,
    this.code,
    this.fields = const {},
    this.transport = false,
  });

  final int statusCode;
  final int? code;
  final String message;
  final Map<String, String> fields;

  /// true, когда ответа HTTP не было вовсе (сервер недоступен, таймаут, DNS).
  final bool transport;

  bool get unauthorized => statusCode == 401;
  bool get forbidden => statusCode == 403;
  bool get notFound => statusCode == 404;
  bool get rateLimited => statusCode == 429;
  bool get validation => statusCode == 400;

  /// Подсказка под конкретное поле формы (§9.3 fields → UI).
  String? fieldError(String field) => fields[field];

  factory ApiFailure.fromResponse(int statusCode, Object? body) {
    if (body is Map) {
      final error = body['error'];
      if (error is Map) {
        final envelope = error.cast<String, dynamic>();
        return ApiFailure(
          statusCode: statusCode,
          code: envelope['code'] is int
              ? envelope['code'] as int
              : int.tryParse('${envelope['code']}'),
          message: '${envelope['message'] ?? AppStrings.unexpectedAnswer}',
          fields:
              (envelope['fields'] as Map?)?.map(
                (key, value) => MapEntry('$key', '$value'),
              ) ??
              const {},
        );
      }
      // JSON без конверта (§9.3) — не выдумываем сообщение, говорим как есть.
      return ApiFailure(
        statusCode: statusCode,
        message: '${body['message'] ?? AppStrings.unexpectedAnswer}',
      );
    }
    final text = body is String && body.trim().isNotEmpty
        ? body.trim()
        : AppStrings.unexpectedAnswer;
    return ApiFailure(statusCode: statusCode, message: text);
  }

  factory ApiFailure.transport(String message) =>
      ApiFailure(statusCode: 0, message: message, transport: true);

  @override
  String toString() => 'ApiFailure($statusCode): $message';
}
