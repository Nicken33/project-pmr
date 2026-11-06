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
          verificationLabel(true, verifiedAt: DateTime.utc(2026, 1, 9)),
          startsWith('данные проверены 0'),
        );
        expect(verificationLabel(false), 'данные ориентировочные');
      },
    );

    test(
      'флаг без даты — «Контакты сверены», выдуманной даты под него нет',
      () {
        // Живая форма ответа §7: у занятия приходит только флаг `verified`,
        // даты `contacts_verified_at` в 43 полях карточки нет. Дату правки
        // (`updated_at`) под флаг не подставляем (§11).
        expect(
          verificationLabel(true),
          'Контакты сверены — не старше 90 дней',
        );
        // Флаг сброшен — честно «ориентировочные», даже если дата на руках.
        expect(verificationLabel(false), 'данные ориентировочные');
        // Настоящая дата важнее флага и остаётся единственной датой на плашке.
        final verifiedAt = DateTime.utc(2026, 11, 1);
        expect(
          verificationLabel(true, verifiedAt: verifiedAt),
          'данные проверены 01.11.2026',
        );
      },
    );

    // Реальная бизнес-логика сервера:
    // COALESCE(c.contacts_verified_at >= current_date - 90, false) — backend/
    // Talentro internal/repository/activity.go:47 и catalog.go:29.
    group('окно свежести контактов — правило 90 дней', () {
      // Фиксируем «сегодня», чтобы тест не зависел от часового пояса стенда.
      final now = DateTime(2026, 11, 6, 12);

      test('contacts_verified_at = NULL → бейджа нет', () {
        expect(contactsVerifiedWithinWindow(null, now: now), isFalse);
        expect(verificationLabel(false), 'данные ориентировочные');
      });

      test('дата свежая → бейдж есть', () {
        final fresh = DateTime(2026, 11, 1);
        expect(contactsVerifiedWithinWindow(fresh, now: now), isTrue);
        expect(
          verificationLabel(true, verifiedAt: fresh),
          startsWith('данные проверены'),
        );
      });

      test('дата старше 90 дней → бейджа нет', () {
        final stale = DateTime(2026, 1, 1);
        expect(contactsVerifiedWithinWindow(stale, now: now), isFalse);
        // Сервер при такой дате уже отдал бы `verified: false`.
        expect(verificationLabel(false), 'данные ориентировочные');
      });

      test('граница ровно 90 дней включительна, 91 — уже нет', () {
        // `>= current_date - 90` в SQL: полунощь 90 дней назад ещё свежа.
        final edge = DateTime(2026, 8, 8);
        expect(contactsVerifiedWithinWindow(edge, now: now), isTrue);
        expect(
          contactsVerifiedWithinWindow(
            DateTime(2026, 8, 7),
            now: now,
          ),
          isFalse,
        );
      });

      test('будущая дата проходит проверку — SQL сравнивает с current_date', () {
        expect(
          contactsVerifiedWithinWindow(DateTime(2026, 12, 1), now: now),
          isTrue,
        );
      });

      test('окно берётся из константы, а не вшито в строку', () {
        expect(contactsVerificationWindowDays, 90);
      });
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
