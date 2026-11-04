import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/domain/catalog_query.dart';

void main() {
  group('CatalogQuery.toQuery()', () {
    test('пустые фильтры в query не пишутся (§5.9)', () {
      const query = CatalogQuery();

      expect(query.toQuery(), {'limit': '20'});
      expect(query.toQuery().containsKey('q'), isFalse);
      expect(query.activeFilterKeys, isEmpty);
      expect(query.hasFilters, isFalse);
    });

    test(
      'первая страница не дублируется в URL, limit всегда с собой (§9.2)',
      () {
        const query = CatalogQuery(q: 'музыка', page: 1, limit: 20);

        expect(query.toQuery(), {'q': 'музыка', 'limit': '20'});
        expect(query.toQuery().containsKey('page'), isFalse);
      },
    );

    test('район без города не отправляется: сервер ответил бы 400 (§5.4)', () {
      const query = CatalogQuery(districtSlug: 'centr');

      expect(query.toQuery().containsKey('district'), isFalse);
      expect(query.activeFilterKeys, isEmpty);
    });

    test('район с городом уходит в query обоими параметрами', () {
      const query = CatalogQuery(citySlug: 'tiraspol', districtSlug: 'centr');

      expect(query.toQuery()['city'], 'tiraspol');
      expect(query.toQuery()['district'], 'centr');
      expect(query.activeFilterKeys, containsAll(['city', 'district']));
    });

    test('пробелы в поиске срезаются, а не уезжают в URL (§5.9)', () {
      const query = CatalogQuery(q: '  скрипка  ');

      expect(query.toQuery()['q'], 'скрипка');
    });

    test('сортировка проходит только из белого списка сервера', () {
      const allowed = CatalogQuery(sort: 'price');
      const invented = CatalogQuery(sort: 'rating');

      expect(allowed.toQuery()['sort'], 'price');
      expect(invented.toQuery().containsKey('sort'), isFalse);
      expect(CatalogQuery.allowedSorts, {
        'updated',
        'price',
        'name',
        'verified',
      });
    });

    test('age — одно число, не диапазон (§5.2)', () {
      const query = CatalogQuery(age: 8);
      final params = query.toQuery();

      expect(params['age'], '8');
      expect(params.containsKey('age_from'), isFalse);
      expect(params.containsKey('age_to'), isFalse);
    });

    test('снять можно один фильтр, не трогая остальные (§3.1.4)', () {
      const query = CatalogQuery(
        citySlug: 'tiraspol',
        categorySlug: 'music',
        age: 7,
      );

      final cleared = query.copyWith(clearAge: true, page: 1);

      expect(cleared.age, isNull);
      expect(cleared.citySlug, 'tiraspol');
      expect(cleared.categorySlug, 'music');
      expect(query.activeFilterKeys, hasLength(3));
      expect(cleared.activeFilterKeys, hasLength(2));
    });

    test('смена города сбрасывает район: висячий district вернул бы 400', () {
      const query = CatalogQuery(citySlug: 'tiraspol', districtSlug: 'centr');

      final moved = query.copyWith(citySlug: 'bendery', clearDistrict: true);

      expect(moved.districtSlug, isNull);
      expect(moved.toQuery()['district'], isNull);
    });
  });
}
