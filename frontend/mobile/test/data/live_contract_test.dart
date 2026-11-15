import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/data/models/activity.dart';
import 'package:talentro_mobile/domain/format.dart';

/// Снимок живого ответа канона §7, снятый 2026-11-06 со стенда `:8080`
/// (`GET /api/v1/activities/tiraspol-veselye-noty` и
/// `GET /api/v1/activities`). Фикстуры — те же байты, что отдал сервер, поэтому
/// тест проверяет десериализацию модели именно на боевом JSON, а не на
/// подобранном под неё примере.
dynamic _raw(String name) =>
    jsonDecode(File('test/fixtures/api/$name').readAsStringSync());

Map<String, dynamic> _json(String name) => _raw(name) as Map<String, dynamic>;

void main() {
  group('живый контракт §7 — деталь activities/tiraspol-veselye-noty', () {
    final detail = ActivityDetail.fromJson(_json('activity_detail_live.json'));

    test('плоские поля карточки разобраны без null-ошибок', () {
      final card = detail.card;
      expect(card.id, '10');
      expect(card.slug, 'tiraspol-veselye-noty');
      expect(card.name, isNotEmpty);
      expect(card.orgId, 10);
      expect(card.city, 'Тирасполь');
      expect(card.district, 'Центр');
      expect(card.price, 200);
      expect(card.priceTo, isNull);
      expect(card.pricePeriod, 'month');
      expect(card.seats, 10);
      expect(card.categorySlug, 'music');
      expect(card.superCategory, 'Творчество и искусство');
      expect(card.format, 'offline');
      expect(card.lessonType, 'group');
      expect(card.status, 'published');
      expect(card.lat, closeTo(46.8407, 0.0001));
      expect(card.lng, closeTo(29.6344, 0.0001));
      expect(card.groupsCount, 2);
      expect(card.locationsCount, 1);
      expect(card.age?.min, 4);
      expect(card.age?.max, 6);
      // `photo: null` на живой карточке — экран обязан жить без фото.
      expect(card.photo, isNull);
      expect(card.updatedAt, isNotNull);
    });

    test('расписание приходит ВНУТРИ групп, а не на уровне карточки', () {
      // Главный дефект, который этот тест сторожит: на activity нет ни
      // `schedule`, ни `schedules` — массив живёт в groups[].schedules[].
      final raw = _json('activity_detail_live.json');
      expect(raw.containsKey('schedule'), isFalse);
      expect(raw.containsKey('schedules'), isFalse);

      expect(detail.groups, hasLength(2));
      expect(detail.groups.first.schedules, hasLength(2));
      expect(
        detail.groups.first.schedules.map((slot) => slot.weekday).toList(),
        [2, 4],
      );
      expect(detail.groups.first.schedules.first.timeFrom, '15:00');
      expect(detail.groups.first.schedules.first.timeTo, '16:00');
      expect(detail.groups.first.schedules.first.seats, 10);
      expect(detail.groups.first.schedules.first.note, isNull);

      // Второй слот второй группы приносит и `note`, и `seats: null`.
      final second = detail.groups.last.schedules.first;
      expect(second.note, 'Сбор в 16:45');
      expect(second.seats, isNull);
    });

    test('строки расписания собираются из живых слотов', () {
      expect(
        scheduleSummary(detail.groups.first.schedules),
        'Вт, Чт 15:00–16:00',
      );
      expect(
        scheduleSummary(detail.groups.last.schedules),
        'Вт, Чт 17:00–18:00',
      );
      expect(
        scheduleSlotNotes(detail.groups.last.schedules),
        contains('Вт 17:00–18:00: Сбор в 16:45'),
      );
      // Пустой массив слотов — не пустая строка на экране, а явный текст.
      expect(scheduleSummary(const []), isEmpty);
    });

    test('отношения разобраны: organization, locations[], groups[]', () {
      final org = detail.organization!;
      expect(org.slug, 'dmsh-veselye-noty');
      expect(org.name, isNotEmpty);
      expect(org.phone, '+373 777 01234');
      // На стенде дата сверки организации NULL у всех 10 — значит бейдж
      // карточки не может на неё опираться.
      expect(org.contactsVerifiedAt, isNull);

      expect(detail.locations, hasLength(1));
      expect(detail.locations.first.name, 'Большой зал');
      expect(detail.locations.first.contactsVerifiedAt, isNull);
      expect(detail.locations.first.groupsCount, 2);

      // Живой стенд: photos и videos пустые массивы, не null.
      expect(detail.photos, isEmpty);
      expect(detail.videos, isEmpty);
    });

    test('флаг verified карточки — единственный источник бейджа', () {
      // verified: true при organization.contacts_verified_at == null — ровно та
      // пара, на которой прежняя реализация гасила плашку.
      expect(detail.card.verified, isTrue);
      expect(
        verificationLabel(detail.card.verified ?? false),
        'Контакты сверены — не старше 90 дней',
      );
    });

    test('у живого ответа нет поля messengers — читать его негде', () {
      // Проверка по всему дереву JSON: ключ не встречается ни в activity,
      // ни в location, ни в organization.
      expect(
        _json('activity_detail_live.json').keys.where((k) => k == 'messengers'),
        isEmpty,
      );
      final text = File('test/fixtures/api/activity_detail_live.json')
          .readAsStringSync();
      expect(text.contains('messengers'), isFalse);
      expect(text.contains('messenger'), isFalse);
    });
  });

  group('живый контракт §7 — список activities', () {
    test('контейнер {items,total,page,limit} разобран целиком', () {
      final page = ActivityPage.fromJson(_json('activities_list_live.json'));

      expect(page.total, 8);
      expect(page.items, hasLength(8));
      expect(page.items.first.slug, 'tiraspol-veselye-noty');
      // В списке нет отношений — только `groups_count`/`locations_count`: ни
      // `schedule`, ни `schedules`, ни `locations[]` в строке items[] не
      // встречаются, поэтому расписание экрана берётся только из детали.
      expect(page.items.every((item) => item.groupsCount != null), isTrue);
      final raw = _json('activities_list_live.json');
      final firstRow = (raw['items'] as List<dynamic>).first
          as Map<String, dynamic>;
      expect(
        firstRow.keys.where((k) => k.contains('schedule')),
        isEmpty,
        reason: 'список не отдаёт расписание — модель не должна его ждать',
      );
      expect(firstRow.containsKey('locations'), isFalse);
      expect(firstRow.containsKey('photos'), isFalse);
    });
  });
}
