import 'activity_parts.dart';
import 'json.dart';
import 'media.dart';

/// Плоская строка каталога — `items[]` из `GET /api/v1/activities`. Источник
/// формы: контракт `backend/Talentro/API.md` плюс снимок живого ответа канона §7
/// (`test/fixtures/api/activities_list.json`, `26.52.103.163:8080`, 4 ноября
/// 2026).
///
/// Группы и точки агрегированы в одно раскрытое значение (`group_*`,
/// `location_*`) плюс счётчики — ТЗ §7.13: счётчики приезжают вместе со
/// списком, отдельными запросами клиент их не догружает. Какую именно группу и
/// точку сервер раскрывает, сказано в контракте: без `near` — самую дешёвую
/// подходящую (при равенстве с меньшим id), с `near` — группу ближайшей точки.
/// Поэтому плоский `price` это «от какой цены» только когда `near` не
/// запрашивался; полные данные — в `groups[]` карточки.
class ActivityListItem {
  const ActivityListItem({
    required this.id,
    required this.slug,
    required this.name,
    required this.kind,
    required this.orgId,
    required this.city,
    required this.updatedAt,
    this.age,
    this.link,
    this.description,
    this.district,
    this.price,
    this.category,
    this.orgSlug,
    this.orgName,
    this.orgType,
    this.phone,
    this.address,
    this.lat,
    this.lng,
    this.locationId,
    this.locationName,
    this.groupId,
    this.groupName,
    this.priceTo,
    this.pricePeriod,
    this.seats,
    this.categoryId,
    this.categorySlug,
    this.superCategory,
    this.superCategorySlug,
    this.format,
    this.lessonType,
    this.status,
    this.verified,
    this.photo,
    this.groupsCount,
    this.locationsCount,
  });

  /// Идентификатор анкеты. Контракт фиксирует форму: `id` карточки — строка
  /// (`"10"`), а `org_id`, `location_id`, `group_id`, `category_id` — числа;
  /// в справочниках id тоже числа. Ссылаться на карточку и организацию можно
  /// и по slug, и по числу.
  final String id;
  final String slug;
  final String name;

  /// `activity` | `service` (§8 табл. 1 п.4).
  final String kind;
  final int orgId;
  final String city;
  final AgeRange? age;
  final String? link;
  final String? description;
  final String? district;
  final int? price;
  final String? category;
  final String? orgSlug;
  final String? orgName;
  final String? orgType;
  final String? phone;
  final String? address;
  final double? lat;
  final double? lng;
  final int? locationId;
  final String? locationName;
  final int? groupId;
  final String? groupName;
  final int? priceTo;
  final String? pricePeriod;
  final int? seats;
  final int? categoryId;
  final String? categorySlug;
  final String? superCategory;
  final String? superCategorySlug;

  /// `online` | `offline` | `both` (§8 табл. 1 п.7).
  final String? format;

  /// `individual` | `group` | `both` (§8 табл. 1 п.6).
  final String? lessonType;
  final String? status;
  final bool? verified;
  final String? photo;
  final int? groupsCount;
  final int? locationsCount;
  final DateTime? updatedAt;

  factory ActivityListItem.fromJson(Map<String, dynamic> json) =>
      ActivityListItem(
        id: asString(json['id']) ?? '',
        slug: asString(json['slug']) ?? '',
        name: asString(json['name']) ?? '',
        kind: asString(json['kind']) ?? 'activity',
        orgId: asInt(json['org_id']) ?? 0,
        city: asString(json['city']) ?? '',
        age: json['age'] is Map ? AgeRange.fromJson(asMap(json['age'])) : null,
        link: asString(json['link']),
        description: asString(json['description']),
        district: asString(json['district']),
        price: asInt(json['price']),
        category: asString(json['category']),
        orgSlug: asString(json['org_slug']),
        orgName: asString(json['org_name']),
        orgType: asString(json['org_type']),
        phone: asString(json['phone']),
        address: asString(json['address']),
        lat: asDouble(json['lat']),
        lng: asDouble(json['lng']),
        locationId: asInt(json['location_id']),
        locationName: asString(json['location_name']),
        groupId: asInt(json['group_id']),
        groupName: asString(json['group_name']),
        priceTo: asInt(json['price_to']),
        pricePeriod: asString(json['price_period']),
        seats: asInt(json['seats']),
        categoryId: asInt(json['category_id']),
        categorySlug: asString(json['category_slug']),
        superCategory: asString(json['super_category']),
        superCategorySlug: asString(json['super_category_slug']),
        format: asString(json['format']),
        lessonType: asString(json['lesson_type']),
        status: asString(json['status']),
        verified: asBool(json['verified']),
        photo: asString(json['photo']),
        groupsCount: asInt(json['groups_count']),
        locationsCount: asInt(json['locations_count']),
        updatedAt: asDate(json['updated_at']),
      );

  bool get isService => kind == 'service';
}

/// Ответ `GET /api/v1/activities` (§9.2): контейнер с пагинацией.
class ActivityPage {
  const ActivityPage({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  final List<ActivityListItem> items;
  final int total;
  final int page;
  final int limit;

  factory ActivityPage.fromJson(Map<String, dynamic> json) => ActivityPage(
    items: asMapList(json['items']).map(ActivityListItem.fromJson).toList(),
    total: asInt(json['total']) ?? 0,
    page: asInt(json['page']) ?? 1,
    limit: asInt(json['limit']) ?? 20,
  );

  /// «Показать ещё» (§3.1.7): если страница целиком заполнена и total больше
  /// показанного — следующая страница возможна.
  bool get hasMore => items.isNotEmpty && page * limit < total;
}

/// Полная карточка: плоские поля + вложенные организация, точки, группы,
/// медиа (§9.3). Отдельных эндпоинтов для группы и точки нет — раскрытие
/// строится из этого ответа, поэтому вложенности храним целиком.
class ActivityDetail {
  const ActivityDetail({
    required this.card,
    this.organization,
    this.locations = const [],
    this.groups = const [],
    this.photos = const [],
    this.videos = const [],
  });

  final ActivityListItem card;
  final Organization? organization;
  final List<LocationPoint> locations;
  final List<ActivityGroup> groups;

  /// Медиа карточки по `order_num` (§8 табл. 5). Пустой массив — это «медиа
  /// нет», а не «данные не дошли».
  final List<MediaItem> photos;
  final List<MediaItem> videos;

  factory ActivityDetail.fromJson(Map<String, dynamic> json) => ActivityDetail(
    card: ActivityListItem.fromJson(json),
    organization: json['organization'] is Map
        ? Organization.fromJson(asMap(json['organization']))
        : null,
    locations: asMapList(json['locations'])
        .map(LocationPoint.fromJson)
        .toList(),
    groups: asMapList(json['groups']).map(ActivityGroup.fromJson).toList(),
    photos: mediaList(json['photos']),
    videos: mediaList(json['videos']),
  );
}

/// Ответ `GET /api/v1/organizations/{slug}`: карточка организации плюс её
/// опубликованные занятия (§7.5) и общий счётчик. Отдельного эндпоинта для
/// «списка занятий организации» нет, и фильтр `?org=` в каталоге не
/// предусмотрен §5 — организация раскрывается отсюда.
class OrganizationPage {
  const OrganizationPage({
    required this.organization,
    required this.activities,
    required this.total,
  });

  final Organization organization;
  final List<ActivityListItem> activities;
  final int total;

  factory OrganizationPage.fromJson(Map<String, dynamic> json) =>
      OrganizationPage(
        organization: Organization.fromJson(asMap(json['organization'])),
        activities: asMapList(json['activities'])
            .map(ActivityListItem.fromJson)
            .toList(),
        total: asInt(json['total']) ?? 0,
      );
}
