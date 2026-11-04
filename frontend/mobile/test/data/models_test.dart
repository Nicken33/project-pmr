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
      expect(item.categorySlug, 'music');
      expect(item.superCategory, 'Творчество и искусство');
      expect(item.superCategorySlug, 'creative-arts');
      expect(item.updatedAt, isNotNull);
    });

    test('у услуги возраст приезжает пустым объектом — это «уточняется»', () {
      final page = ActivityPage.fromJson(_json('activities_list.json'));
      final service = page.items[1];

      expect(service.kind, 'service');
      expect(service.isService, isTrue);
      expect(service.age, isNotNull);
      expect(service.age?.isEmpty, isTrue);
      expect(service.pricePeriod, 'session');
      expect(service.verified, isFalse);
      expect(service.photo, '/media/cards/9/repetitor-urok.jpg');
    });

    test('бесплатное занятие приезжает ценой 0, а не null (§7.4)', () {
      final page = ActivityPage.fromJson(_json('activities_list.json'));
      final free = page.items.last;

      expect(free.slug, 'dubossary-shakhmaty');
      expect(free.price, 0);
      expect(free.priceTo, isNull);
      expect(free.pricePeriod, isNull);
      expect(free.district, isNull);
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
      // Нумерация контракта: 1 — понедельник, поэтому 2 это вторник.
      expect(group.schedules.first.weekday, 2);
      expect(group.schedules.first.timeFrom, contains(':'));
      expect(group.schedules.first.note, isNull);
      expect(group.schedules.first.seats, 10);

      final location = detail.locations.first;
      expect(location.city, isNotEmpty);
      expect(location.address, isNotEmpty);
      expect(location.lat, isNotNull);
      expect(location.groupsCount, 2);
      // Контракт обещает `[]`, а не null: отсутствие фото — пустой список.
      expect(location.photos, isEmpty);
    });

    test('цена второй группы приезжает диапазоном', () {
      final detail = ActivityDetail.fromJson(_json('activity_detail.json'));
      final second = detail.groups[1];

      expect(second.priceFrom, 250);
      expect(second.priceTo, 300);
    });

    test('медиа карточки — типизированные объекты контракта (§8 табл. 5)', () {
      final detail = ActivityDetail.fromJson(
        _json('activity_detail_with_media.json'),
      );

      expect(detail.photos, hasLength(2));
      expect(detail.photos.first.path, '/media/cards/1/palitra-oblozhka.jpg');
      expect(detail.photos.first.caption, 'Занятие акварелью');
      expect(detail.photos.first.orderNum, 0);
      expect(detail.photos.last.orderNum, 1);
      // Правообладатель и источник на стенде не заполнены — это null, а не «».
      expect(detail.photos.first.sourceUrl, isNull);
      expect(detail.photos.first.author, isNull);
      expect(detail.videos, isEmpty);

      final location = detail.locations.single;
      expect(location.photos, hasLength(1));
      expect(
        location.photos.single.path,
        '/media/locations/1/studiya-palitra.jpg',
      );

      final second = detail.groups[1];
      expect(second.priceFrom, 350);
      expect(second.priceTo, 400);
      expect(second.schedules, hasLength(2));
      expect(second.schedules.last.weekday, 6);
      expect(second.schedules.last.note, 'Сбор за 10 минут');
    });

    test('снять медиа можно и с пустого ответа: null и [] значат одно', () {
      final detail = ActivityDetail.fromJson({
        'id': '1',
        'slug': 's',
        'name': 'n',
        'kind': 'activity',
        'photos': null,
        'videos': [],
        'locations': [
          {'id': 1, 'photos': null},
        ],
      });

      expect(detail.photos, isEmpty);
      expect(detail.videos, isEmpty);
      expect(detail.locations.single.photos, isEmpty);
      expect(detail.groups, isEmpty);
      expect(detail.organization, isNull);
    });
  });

  group('OrganizationPage', () {
    test('разбирает карточку организации вместе с её занятиями', () {
      final page = OrganizationPage.fromJson(_json('organization.json'));

      expect(page.organization.slug, 'studiya-palitra');
      expect(page.organization.name, isNotEmpty);
      expect(page.total, 1);
      expect(page.activities, hasLength(1));
      expect(page.activities.single.slug, 'tiraspol-studiya-palitra');
      expect(page.activities.single.orgId, 1);
    });

    test('занятий может не быть — пустой массив, а не ошибка', () {
      final page = OrganizationPage.fromJson({
        'organization': {'id': 2, 'slug': 'o', 'name': 'O'},
        'activities': [],
        'total': 0,
      });

      expect(page.activities, isEmpty);
      expect(page.total, 0);
      expect(page.organization.slug, 'o');
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
      // У листового направления `children` в JSON нет вовсе (omitempty) — модель
      // даёт пустой список, а не null и не ошибку разбора.
      expect(nodes.first.children.first.children, isEmpty);
      expect(nodes.first.kind, isNotNull);
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

    test('`/districts?city=tiraspol` — четыре района города', () {
      final districts = _jsonList('districts_centrum.json')
          .whereType<Map>()
          .map((e) => District.fromJson(e.cast<String, dynamic>()))
          .toList();

      expect(districts.map((d) => d.slug), [
        'centr',
        'balka',
        'naselenka',
        'tarnovka',
      ]);
      expect(districts.every((d) => d.cityId == 1), isTrue);
    });
  });
}
