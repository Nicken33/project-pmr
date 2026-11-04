/// Приведение JSON от Go-сервера к dart-типам.
///
/// Правила взяты из контракта (`backend/Talentro/API.md`) и подтверждены
/// фактическими ответами `:8081`:
/// * `id` анкеты сериализуется строкой, `org_id`/`location_id`/`group_id`/
///   `category_id` и id справочников — числом;
/// * отсутствующее значение приходит как `null`, а не как отсутствие ключа, —
///   кроме двух полей с `omitempty`: `children` у листового направления и
///   `city_id` у города их в JSON нет вовсе;
/// * пустые списки — `[]`, а не `null` (исключение встречалось только на
///   старой сборке стенда: `locations[].photos` приходил как `null`).
///
/// Поэтому здесь нет «умных» значений по умолчанию: отсутствие поля остаётся
/// отсутствием, а экран сам решает, чем его закрыть (§15.10 — не выдумывать).
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
