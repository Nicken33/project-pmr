/// Приведение JSON от Go-сервера к dart-типам.
///
/// Правила взяты из фактических ответов `:8081`, а не из предположений:
/// * `id` анкеты сериализуется строкой, `org_id`/`location_id`/`group_id` — числом;
/// * отсутствующее значение приходит как `null`, а не как отсутствие ключа;
/// * списки могут быть и `[]`, и `null` (у `locations[].photos` наблюдено `null`).
String? asString(Object? value) => value is String ? value : value?.toString();

int? asInt(Object? value) => switch (value) {
  int v => v,
  double v => v.toInt(),
  String v => int.tryParse(v),
  _ => null,
};

double? asDouble(Object? value) => switch (value) {
  double v => v,
  int v => v.toDouble(),
  String v => double.tryParse(v),
  _ => null,
};

bool? asBool(Object? value) => switch (value) {
  bool v => v,
  int v => v != 0,
  String v => v == 'true',
  _ => null,
};

/// ISO-8601 с таймзоной Europe/Chisinau, как отдаёт PostgreSQL.
DateTime? asDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

Map<String, dynamic> asMap(Object? value) =>
    value is Map ? value.cast<String, dynamic>() : const {};

List<Map<String, dynamic>> asMapList(Object? value) => switch (value) {
  List<Object?> items =>
    items.whereType<Map>().map((item) => item.cast<String, dynamic>()).toList(),
  _ => const [],
};
