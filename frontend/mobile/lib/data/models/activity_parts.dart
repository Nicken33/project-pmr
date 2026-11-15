import 'json.dart';
import 'media.dart';

/// Возраст группы. В ответе сервера — объект `{min,max}` в годах (§7.4).
class AgeRange {
  const AgeRange({this.min, this.max});

  final int? min;
  final int? max;

  factory AgeRange.fromJson(Map<String, dynamic> json) =>
      AgeRange(min: asInt(json['min']), max: asInt(json['max']));

  bool get isEmpty => min == null && max == null;
}

/// Строка расписания: одна строка = один день (§8 табл. 6).
class ScheduleSlot {
  const ScheduleSlot({
    required this.weekday,
    required this.timeFrom,
    required this.timeTo,
    this.note,
    this.seats,
  });

  final int? weekday;
  final String? timeFrom;
  final String? timeTo;
  final String? note;
  final int? seats;

  factory ScheduleSlot.fromJson(Map<String, dynamic> json) => ScheduleSlot(
    weekday: asInt(json['weekday']),
    timeFrom: asString(json['time_from']),
    timeTo: asString(json['time_to']),
    note: asString(json['note']),
    seats: asInt(json['seats']),
  );
}

/// Группа занятия (§8 табл. 1-А): возраст, цена и расписание живут здесь,
/// а не на карточке — ТЗ §7.9-7.10.
class ActivityGroup {
  const ActivityGroup({
    required this.id,
    this.name,
    this.ageFrom,
    this.ageTo,
    this.priceFrom,
    this.priceTo,
    this.pricePeriod,
    this.locationId,
    this.seats,
    this.schedules = const [],
  });

  final int id;
  final String? name;
  final int? ageFrom;
  final int? ageTo;
  final int? priceFrom;
  final int? priceTo;
  final String? pricePeriod;
  final int? locationId;
  final int? seats;
  final List<ScheduleSlot> schedules;

  factory ActivityGroup.fromJson(Map<String, dynamic> json) => ActivityGroup(
    id: asInt(json['id']) ?? 0,
    name: asString(json['name']),
    ageFrom: asInt(json['age_from']),
    ageTo: asInt(json['age_to']),
    priceFrom: asInt(json['price_from']),
    priceTo: asInt(json['price_to']),
    pricePeriod: asString(json['price_period']),
    locationId: asInt(json['location_id']),
    seats: asInt(json['seats']),
    schedules: asMapList(json['schedules']).map(ScheduleSlot.fromJson).toList(),
  );
}

/// Точка проведения (§8 табл. 1-Б). Город и район считаются по точкам (§5.9).
class LocationPoint {
  const LocationPoint({
    required this.id,
    this.name,
    this.city,
    this.district,
    this.address,
    this.lat,
    this.lng,
    this.phone,
    this.contactsVerifiedAt,
    this.groupsCount,
    this.photos = const [],
  });

  final int id;
  final String? name;
  final String? city;
  final String? district;
  final String? address;
  final double? lat;
  final double? lng;
  final String? phone;
  final DateTime? contactsVerifiedAt;
  final int? groupsCount;

  /// Фото именно этой точки, та же структура объекта, что у карточки.
  final List<MediaItem> photos;

  factory LocationPoint.fromJson(Map<String, dynamic> json) => LocationPoint(
    id: asInt(json['id']) ?? 0,
    name: asString(json['name']),
    city: asString(json['city']),
    district: asString(json['district']),
    address: asString(json['address']),
    lat: asDouble(json['lat']),
    lng: asDouble(json['lng']),
    phone: asString(json['phone']),
    contactsVerifiedAt: asDate(json['contacts_verified_at']),
    groupsCount: asInt(json['groups_count']),
    photos: mediaList(json['photos']),
  );
}

/// Организация (§8 табл. 2).
class Organization {
  const Organization({
    required this.id,
    required this.slug,
    required this.name,
    this.type,
    this.description,
    this.phone,
    this.email,
    this.site,
    this.address,
    this.city,
    this.contactsVerifiedAt,
  });

  final int id;
  final String slug;
  final String name;
  final String? type;
  final String? description;
  final String? phone;
  final String? email;
  final String? site;
  final String? address;
  final String? city;
  final DateTime? contactsVerifiedAt;

  factory Organization.fromJson(Map<String, dynamic> json) => Organization(
    id: asInt(json['id']) ?? 0,
    slug: asString(json['slug']) ?? '',
    name: asString(json['name']) ?? '',
    type: asString(json['type']),
    description: asString(json['description']),
    phone: asString(json['phone']),
    email: asString(json['email']),
    site: asString(json['site']),
    address: asString(json['address']),
    city: asString(json['city']),
    contactsVerifiedAt: asDate(json['contacts_verified_at']),
  );
}
