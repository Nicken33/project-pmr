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
        expect(const CatalogQuery(page: 2).toQuery()['page'], '2');
      },
    );

    test('районы без города не отправляются: сервер ответил бы 400 (§5.4)', () {
      const query = CatalogQuery(districtSlugs: ['centr', 'balka']);

      expect(query.toQuery().containsKey('district'), isFalse);
      expect(query.activeFilterKeys, isEmpty);
    });

    test('районы с городом уходят списком через запятую', () {
      const query = CatalogQuery(
        citySlug: 'tiraspol',
        districtSlugs: ['centr', 'balka'],
      );

      expect(query.toQuery()['city'], 'tiraspol');
      expect(query.toQuery()['district'], 'centr,balka');
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

    test('флаг «бесплатно» и «проверенные» — 1, снятый фильтр в URL отсутствует (§5.7)', () {
      expect(const CatalogQuery(free: true).toQuery()['free'], '1');
      expect(const CatalogQuery(verified: true).toQuery()['verified'], '1');
      expect(const CatalogQuery().toQuery().containsKey('free'), isFalse);
      expect(const CatalogQuery().toQuery().containsKey('verified'), isFalse);
    });

    test('формат трёхзначный: онлайн — 1, офлайн — 0, не выбран — параметра нет (§5.7)', () {
      expect(const CatalogQuery(online: true).toQuery()['online'], '1');
      // `online=0` — это активный фильтр «только офлайн», а не «снят».
      expect(const CatalogQuery(online: false).toQuery()['online'], '0');
      expect(
        const CatalogQuery(online: null).toQuery().containsKey('online'),
        isFalse,
      );
      expect(
        const CatalogQuery(online: false).activeFilterKeys,
        contains('online'),
      );
    });

    test('день недели вне 1–7 в query не уходит (§5.6)', () {
      expect(const CatalogQuery(day: 1).toQuery()['day'], '1');
      expect(const CatalogQuery(day: 7).toQuery()['day'], '7');
      expect(const CatalogQuery(day: 0).toQuery().containsKey('day'), isFalse);
      expect(const CatalogQuery(day: 8).toQuery().containsKey('day'), isFalse);
    });

    test('время — момент ЧЧ:ММ, как просит контракт (§5.6)', () {
      expect(const CatalogQuery(time: '17:30').toQuery()['time'], '17:30');
    });

    test('радиус живёт только вместе с точкой (§5.8)', () {
      const onlyRadius = CatalogQuery(radiusMeters: 3000);
      expect(onlyRadius.toQuery().containsKey('radius'), isFalse);

      const withPoint = CatalogQuery(
        near: GeoPoint(lat: 46.8407, lng: 29.6344),
        radiusMeters: 3000,
      );
      expect(withPoint.toQuery()['near'], '46.8407,29.6344');
      expect(withPoint.toQuery()['radius'], '3000');
    });

    test('точка без радиуса уходит одна, радиус вне границ — нет', () {
      const point = CatalogQuery(near: GeoPoint(lat: 46.8407, lng: 29.6344));
      expect(point.toQuery()['near'], '46.8407,29.6344');
      expect(point.toQuery().containsKey('radius'), isFalse);

      const huge = CatalogQuery(
        near: GeoPoint(lat: 46.8407, lng: 29.6344),
        radiusMeters: 50001,
      );
      expect(huge.toQuery().containsKey('radius'), isFalse);
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

    test('снятие города забирает и районы: висячий district вернул бы 400', () {
      const query = CatalogQuery(
        citySlug: 'tiraspol',
        districtSlugs: ['centr'],
      );

      final moved = query.copyWith(clearCity: true);

      expect(moved.citySlug, isNull);
      expect(moved.districtSlugs, isEmpty);
      expect(moved.toQuery()['district'], isNull);
    });

    test(
      'смена города на другой оставляет районы пустыми, только если их стёрли',
      () {
        const query = CatalogQuery(
          citySlug: 'tiraspol',
          districtSlugs: ['centr'],
        );

        final moved = query.copyWith(
          citySlug: 'bendery',
          districtSlugs: const [],
        );

        expect(moved.citySlug, 'bendery');
        expect(moved.districtSlugs, isEmpty);
        expect(moved.toQuery(), {'city': 'bendery', 'limit': '20'});
      },
    );
  });

  group('GeoPoint', () {
    test('параметр — широта,долгота без хвостовых нулей', () {
      const point = GeoPoint(lat: 46.8407, lng: 29.6344);
      expect(point.toParam(), '46.8407,29.6344');
      expect(const GeoPoint(lat: 47.0, lng: 29.0).toParam(), '47,29');
    });

    test('границы Приднестровья: за ними сервер отвечает 400 (§5.8)', () {
      expect(const GeoPoint(lat: 46.8407, lng: 29.6344).insideRegion, isTrue);
      expect(const GeoPoint(lat: 55.75, lng: 37.61).insideRegion, isFalse);
      expect(const GeoPoint(lat: 45.8, lng: 29.0).insideRegion, isFalse);
      expect(const GeoPoint(lat: 46.0, lng: 30.7).insideRegion, isFalse);
    });
  });
}
