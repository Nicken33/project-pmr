import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/data/models/activity.dart';
import 'package:talentro_mobile/data/models/reference.dart';

/// Фикстуры — снимки живых ответов :8081 от 4 ноября 2026, а не придуманные
/// примеры: модель обязана разбирать ровно те байты, что отдаёт сервер.
Map<String, dynamic> _json(String name) =>
    jsonDecode(File('test/fixtures/api/$name').readAsStringSync())
        as Map<String, dynamic>;

List<dynamic> _jsonList(String name) =>
    jsonDecode(File('test/fixtures/api/$name').readAsStringSync())
        as List<dynamic>;

void main() {
  group('ActivityPage', () {
    test('разбирает контейнер §9.2 и плоские строки items[]', () {
      final page = ActivityPage.fromJson(_json('activities_list.json'));

      expect(page.total, 8);
      expect(page.page, 1);
      // limit сервер эхом возвращает то, что попросили: снимок снят с limit=3.
      expect(page.limit, 3);
      expect(page.items, hasLength(3));
      expect(page.hasMore, isTrue);

      final item = page.items.first;
      expect(item.id, '10');
      expect(item.slug, 'tiraspol-veselye-noty');
      expect(item.kind, 'activity');
      expect(item.isService, isFalse);
      expect(item.orgId, 10);
      expect(item.age?.min, 4);
      expect(item.age?.max, 6);
      expect(item.price, 200);
      expect(item.priceTo, isNull);
      expect(item.pricePeriod, 'month');
      expect(item.groupsCount, 2);
      expect(item.locationsCount, 1);
      expect(item.verified, isTrue);
      expect(item.photo, isNull);
      expect(item.updatedAt, isNotNull);
    });

    test('не падает на null-полях и знает меру «показать ещё»', () {
      final page = ActivityPage.fromJson({
        'items': [
          {'id': '1', 'slug': 's', 'name': 'n', 'kind': 'activity'},
        ],
        'total': 25,
        'page': 1,
        'limit': 20,
      });

      final item = page.items.single;
      expect(item.age, isNull);
      expect(item.lat, isNull);
      expect(item.updatedAt, isNull);
      expect(item.status, isNull);
      expect(page.hasMore, isTrue);

      final last = ActivityPage.fromJson({
        'items': page.items,
        'total': 1,
        'page': 1,
        'limit': 20,
      });
      expect(last.hasMore, isFalse);
    });

    test('пустой массив в items — это пустой список, а не ошибка', () {
      final page = ActivityPage.fromJson({
        'items': [],
        'total': 0,
        'page': 1,
        'limit': 20,
      });
      expect(page.items, isEmpty);
      expect(page.hasMore, isFalse);
    });
  });

  group('ActivityDetail', () {
    test('раскрывает organization, locations[] и groups[] из §7', () {
      final detail = ActivityDetail.fromJson(_json('activity_detail.json'));

      expect(detail.card.slug, isNotEmpty);
      expect(detail.organization?.name, isNotEmpty);
      expect(detail.locations, isNotEmpty);
      expect(detail.groups, hasLength(2));

      final group = detail.groups.first;
      expect(group.id, 15);
      expect(group.name, '4–6 лет');
      expect(group.ageFrom, 4);
      expect(group.ageTo, 6);
      expect(group.priceFrom, 200);
      expect(group.priceTo, isNull);
      expect(group.pricePeriod, 'month');
      expect(group.locationId, 12);
      expect(group.seats, 10);
      expect(group.schedules, isNotEmpty);
      expect(group.schedules.first.weekday, isNotNull);
      expect(group.schedules.first.timeFrom, contains(':'));

      final location = detail.locations.first;
      expect(location.city, isNotEmpty);
      expect(location.address, isNotEmpty);
      expect(location.lat, isNotNull);
      // В живом ответе у точки пришло `photos: null` — это не ошибка разбора.
      expect(location.photos, isNull);
    });

    test('цена второй группы приезжает диапазоном', () {
      final detail = ActivityDetail.fromJson(_json('activity_detail.json'));
      final second = detail.groups[1];

      expect(second.priceFrom, 250);
      expect(second.priceTo, 300);
    });

    test('медиа без API.md остаётся сырым JSON, а не выдуманной моделью', () {
      final detail = ActivityDetail.fromJson({
        'id': '1',
        'slug': 's',
        'name': 'n',
        'kind': 'activity',
        'photos': [
          {'url': '/media/a.jpg'},
        ],
        'videos': null,
      });

      expect(detail.photos, hasLength(1));
      expect(detail.photos.single['url'], '/media/a.jpg');
      expect(detail.videos, isEmpty);
      expect(detail.groups, isEmpty);
      expect(detail.locations, isEmpty);
    });
  });

  group('справочники', () {
    test('categories — дерево с children[]', () {
      final nodes = _jsonList('categories.json')
          .whereType<Map>()
          .map((e) => CategoryNode.fromJson(e.cast<String, dynamic>()))
          .toList();

      expect(nodes, isNotEmpty);
      expect(nodes.first.children, isNotEmpty);
      expect(nodes.first.children.first.slug, isNotEmpty);
    });

    test('cities отдаёт id/slug/name', () {
      final cities = _jsonList('cities.json')
          .whereType<Map>()
          .map((e) => City.fromJson(e.cast<String, dynamic>()))
          .toList();

      expect(cities.map((c) => c.slug), contains('tiraspol'));
    });

    test(
      'район без города в модели не появляется — только cityId из ответа',
      () {
        final district = District.fromJson({
          'id': 3,
          'slug': 'centr',
          'name': 'Центр',
          'city_id': 1,
        });

        expect(district.slug, 'centr');
        expect(district.cityId, 1);
      },
    );
  });
}
