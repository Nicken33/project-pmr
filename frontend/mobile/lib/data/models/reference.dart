import 'json.dart';

/// Узел справочника направлений (§4, ответ `GET /api/v1/categories` — дерево
/// с `children[]`). Свой список категорий приложение не ведёт: §4 п.5.
class CategoryNode {
  const CategoryNode({
    required this.id,
    required this.slug,
    required this.name,
    this.kind,
    this.icon,
    this.orderNum,
    this.children = const [],
  });

  final int id;
  final String slug;
  final String name;

  /// `activity` | `service` | `both`.
  final String? kind;
  final String? icon;
  final int? orderNum;
  final List<CategoryNode> children;

  factory CategoryNode.fromJson(Map<String, dynamic> json) => CategoryNode(
    id: asInt(json['id']) ?? 0,
    slug: asString(json['slug']) ?? '',
    name: asString(json['name']) ?? '',
    kind: asString(json['kind']),
    icon: asString(json['icon']),
    orderNum: asInt(json['order_num']),
    children: asMapList(json['children']).map(CategoryNode.fromJson).toList(),
  );
}

/// Город (§8 табл. 3), `GET /api/v1/cities`.
class City {
  const City({required this.id, required this.slug, required this.name});

  final int id;
  final String slug;
  final String name;

  factory City.fromJson(Map<String, dynamic> json) => City(
    id: asInt(json['id']) ?? 0,
    slug: asString(json['slug']) ?? '',
    name: asString(json['name']) ?? '',
  );
}

/// Район, `GET /api/v1/districts?city=<slug>`. Без города сервер отвечает 400
/// (§5.4), поэтому список районов всегда привязан к выбранному городу.
class District {
  const District({
    required this.id,
    required this.slug,
    required this.name,
    this.cityId,
  });

  final int id;
  final String slug;
  final String name;
  final int? cityId;

  factory District.fromJson(Map<String, dynamic> json) => District(
    id: asInt(json['id']) ?? 0,
    slug: asString(json['slug']) ?? '',
    name: asString(json['name']) ?? '',
    cityId: asInt(json['city_id']),
  );
}

/// Сессия из `GET /api/auth/me`.
///
/// ВНИМАНИЕ: на живом стенде :8081 маршрут отвечает `404 page not found`
/// текстом, а не конвертом ошибок — форма ниже продиктована координатором,
/// а не наблюдением, и подлежит сверке по API.md.
class AuthSession {
  const AuthSession({
    required this.authenticated,
    this.tester = false,
    this.role,
    this.name,
    this.email,
    this.picture,
    this.provider,
  });

  final bool authenticated;
  final bool tester;

  /// `user` | `owner` | `moderator` (§2).
  final String? role;
  final String? name;
  final String? email;
  final String? picture;
  final String? provider;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    authenticated: asBool(json['authenticated']) ?? false,
    tester: asBool(json['tester']) ?? false,
    role: asString(json['role']),
    name: asString(json['name']),
    email: asString(json['email']),
    picture: asString(json['picture']),
    provider: asString(json['provider']),
  );

  bool get signedIn => authenticated;
}
