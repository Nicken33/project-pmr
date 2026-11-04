import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/data/models/activity_parts.dart';
import 'package:talentro_mobile/domain/format.dart';

void main() {
  group('plural — тот же алгоритм, что в web/src/lib/utils.ts:4-16', () {
    test('склоняет по русским правилам', () {
      expect(groupWord(1), 'группа');
      expect(groupWord(2), 'группы');
      expect(groupWord(5), 'групп');
      expect(groupWord(11), 'групп');
      expect(groupWord(21), 'группа');
      expect(groupWord(24), 'группы');
    });

    test('адреса и отзывы', () {
      expect(addressWord(1), 'адрес');
      expect(addressWord(4), 'адреса');
      expect(addressWord(20), 'адресов');
      expect(reviewWord(1), 'отзыв');
      expect(reviewWord(4), 'отзыва');
      expect(reviewWord(11), 'отзывов');
      expect(seatsWord(2), 'места');
      expect(seatsWord(11), 'мест');
    });
  });

  group('адрес и проверка контактов', () {
    test('город, район, улица — всегда вместе (§10.4)', () {
      expect(
        addressLine(
          city: 'Тирасполь',
          district: 'Центр',
          address: 'ул. Еврейская, 42',
        ),
        'Тирасполь, Центр, ул. Еврейская, 42',
      );
    });

    test('пустые части не оставляют висячих запятых', () {
      expect(
        addressLine(city: 'Тирасполь', district: '', address: null),
        'Тирасполь',
      );
    });

    test('без точки — «Адрес уточняется»', () {
      expect(addressLine(), 'Адрес уточняется');
      expect(addressLine(city: '', address: ''), 'Адрес уточняется');
    });

    test(
      'дата есть → «данные проверены ДД.ММ.ГГГГ», нет → «ориентировочные»',
      () {
        expect(formatDate(DateTime(2026, 11, 4)), '04.11.2026');
        expect(
          verificationLabel(DateTime.utc(2026, 1, 9)),
          startsWith('данные проверены 0'),
        );
        expect(verificationLabel(null), 'данные ориентировочные');
      },
    );

    test('даты проверки у карточки нет — берём `updated_at`, как web, а не '
        '«ориентировочные»', () {
      final updated = DateTime(2026, 10, 30);

      // Живая форма ответа: у занятия приходит только флаг `verified`, а
      // `contacts_verified_at` организации на стенде пуст.
      expect(verificationDate(verified: true, updatedAt: updated), updated);
      // Флаг снят — дату придумывать нельзя, плашка остаётся «ориентировочной».
      expect(verificationDate(verified: false, updatedAt: updated), isNull);
      expect(verificationDate(verified: null, updatedAt: updated), isNull);
      // Если сервер всё же пришлёт дату сверки, она важнее `updated_at`.
      final verifiedAt = DateTime.utc(2026, 11, 1);
      expect(
        verificationDate(
          verified: true,
          updatedAt: updated,
          contactsVerifiedAt: verifiedAt,
        ),
        verifiedAt,
      );
      expect(
        verificationLabel(verificationDate(verified: true, updatedAt: updated)),
        'данные проверены 30.10.2026',
      );
    });
  });

  group('ageSummary и расписание — подписи с web-карточки', () {
    const groups = [
      ActivityGroup(id: 1, ageFrom: 4, ageTo: 6),
      ActivityGroup(id: 2, ageFrom: 7, ageTo: 12),
    ];

    test('min–max по всем группам', () {
      expect(ageSummary(groups), '4–12 лет');
    });

    test('без групп — «Возраст уточняется»', () {
      expect(ageSummary(const []), 'Возраст уточняется');
    });

    test('0–99 — «Для всей семьи», верх 99 — «От N лет»', () {
      expect(
        ageSummary(const [ActivityGroup(id: 1, ageFrom: 0, ageTo: 99)]),
        'Для всей семьи',
      );
      expect(
        ageSummary(const [ActivityGroup(id: 1, ageFrom: 14, ageTo: 99)]),
        'От 14 лет',
      );
    });

    test('одинаковый возраст группы — «N лет»', () {
      expect(groupAgeLabel(7, 7), '7 лет');
      expect(groupAgeLabel(null, null), '');
    });

    test('строки одного времени склеиваются по дням', () {
      const slots = [
        ScheduleSlot(weekday: 2, timeFrom: '15:00', timeTo: '16:00'),
        ScheduleSlot(weekday: 4, timeFrom: '15:00', timeTo: '16:00'),
        ScheduleSlot(weekday: 2, timeFrom: '17:00', timeTo: '18:00'),
      ];

      expect(scheduleSummary(slots), 'Вт, Чт 15:00–16:00 · Вт 17:00–18:00');
      expect(scheduleSummary(const []), '');
    });

    test('формат и тип — дословные подписи web/ActivityDetail.tsx', () {
      expect(formatLabel('online'), 'Онлайн');
      expect(formatLabel('both'), 'Офлайн и онлайн');
      expect(formatLabel('offline'), 'Офлайн');
      expect(formatLabel(null), 'Офлайн');
      expect(
        typeLabel(isService: false, lessonType: 'individual'),
        'Индивидуально',
      );
      expect(
        typeLabel(isService: false, lessonType: 'both'),
        'Группы и индивидуально',
      );
      expect(
        typeLabel(isService: false, lessonType: 'group'),
        'Групповые занятия',
      );
      expect(typeLabel(isService: true, lessonType: null), 'Услуга по записи');
    });
  });
}
