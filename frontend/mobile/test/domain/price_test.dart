import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/domain/price.dart';

void main() {
  group('priceLabel — правило координатора от 4 ноября', () {
    test('все группы 0 → «Бесплатно»', () {
      expect(priceLabel([0, 0, 0]), 'Бесплатно');
      expect(priceLabel([0, null]), 'Бесплатно');
    });

    test('иначе «от N» по минимальной положительной', () {
      expect(priceLabel([0, 250, 300]), 'от 250 руб. ПМР');
      expect(priceLabel([300, 250]), 'от 250 руб. ПМР');
      expect(priceLabel([200]), 'от 200 руб. ПМР');
    });

    test('ни одной цены нет → «Цена не указана», а не 0', () {
      expect(priceLabel([null, null]), 'Цена не указана');
      expect(priceLabel([]), 'Цена не указана');
    });

    test('ноль рядом с ценой не делает занятие бесплатным', () {
      expect(priceLabel([0, 100]), 'от 100 руб. ПМР');
    });

    test('NaN и Infinity наружу не выводятся', () {
      // Колонка nullable (§8 табл. 1-А): пустота — это null, а не ноль (§7.5).
      expect(priceLabel([null, 0]), 'Бесплатно');
      expect(priceLabel([null, 150]), 'от 150 руб. ПМР');
      expect(priceLabel([null, 150]).contains('NaN'), isFalse);
      expect(priceLabel([null, 150]).contains('Infinity'), isFalse);
    });
  });

  group('groupPriceLabel — строка одной группы', () {
    test('цена без верха диапазона', () {
      expect(groupPriceLabel(200, null), '200 руб. ПМР');
      expect(groupPriceLabel(200, 200), '200 руб. ПМР');
    });

    test('диапазон', () {
      expect(groupPriceLabel(250, 300), '250–300 руб. ПМР');
    });

    test('нулевая группа — «Бесплатно»', () {
      expect(groupPriceLabel(0, null), 'Бесплатно');
      expect(groupPriceLabel(0, 0), 'Бесплатно');
    });

    test('цены нет → null, вызывающий подставит «Цена не указана»', () {
      expect(groupPriceLabel(null, 300), isNull);
    });
  });

  group('periodSuffix — словарь `price_period` из контракта', () {
    test('все три machine-значения подписаны словами из ТЗ', () {
      expect(periodSuffix('month'), ' в месяц');
      expect(periodSuffix('session'), ' за тренировку');
      expect(periodSuffix('course'), ' за курс');
    });

    test(
      'период не указан или не распознан — суффикса нет, цены не придумываем',
      () {
        expect(periodSuffix(null), '');
        expect(periodSuffix(''), '');
        expect(periodSuffix('week'), '');
      },
    );
  });
}
