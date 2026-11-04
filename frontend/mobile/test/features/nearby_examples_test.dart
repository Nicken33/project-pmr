import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/app/providers.dart';
import 'package:talentro_mobile/core/api_config.dart';
import 'package:talentro_mobile/data/api/api_client.dart';
import 'package:talentro_mobile/data/api/api_failure.dart';
import 'package:talentro_mobile/data/models/activity.dart';
import 'package:talentro_mobile/domain/catalog_query.dart';
import 'package:talentro_mobile/features/catalog/catalog_controller.dart';

/// Пустой результат по ТЗ §3.1.8 показывает три карточки «рядом по теме», и
/// берутся они вторым запросом со снятыми фильтрами. Проверять это на экране
/// нельзя, пока виджет пустого состояния правит другой агент, поэтому здесь
/// проверяется само правило: когда запрос уходит, каким он бывает и что
/// происходит при сбое.
class _FakeApiClient extends ApiClient {
  _FakeApiClient()
    : super(config: const ApiConfig(baseUrl: 'http://example.test'));

  Object? listResponse = const ActivityPage(
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  );
  Object? examplesResponse;

  /// Запросы в порядке их появления: лимит 3 без фильтров — это «рядом по теме».
  final List<CatalogQuery> requested = [];

  @override
  Future<ActivityPage> activities(CatalogQuery query) async {
    requested.add(query);
    final isExamples = query.limit == CatalogQuery.examplesLimit;
    final value = isExamples ? examplesResponse : listResponse;
    if (value is ApiFailure) throw value;
    return value as ActivityPage;
  }
}

Map<String, dynamic> _fixture(String name) =>
    jsonDecode(File('test/fixtures/api/$name').readAsStringSync())
        as Map<String, dynamic>;

ProviderContainer _container(_FakeApiClient client) {
  final container = ProviderContainer(
    overrides: [apiClientProvider.overrideWithValue(client)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('Карточки «рядом по теме» (§3.1.8)', () {
    test('пустая выдача тянет ровно три карточки без фильтров', () async {
      final client = _FakeApiClient()
        ..examplesResponse = ActivityPage.fromJson(
          _fixture('activities_list.json'),
        );
      final container = _container(client);

      await container.read(catalogProvider.future);
      final examples = await container.read(nearbyExamplesProvider.future);

      expect(examples, hasLength(3));
      expect(client.requested, hasLength(2));
      // Снятые фильтры — часть требования: под «ничего не нашлось» не должен
      // вставать тот же фильтр, который и опустил список.
      expect(client.requested.last.toQuery(), {'limit': '3'});
      expect(client.requested.last.hasFilters, isFalse);
    });

    test('непустая выдача второй запрос не делает', () async {
      final client = _FakeApiClient()
        ..listResponse = ActivityPage.fromJson(
          _fixture('activities_list.json'),
        );
      final container = _container(client);

      await container.read(catalogProvider.future);
      final examples = await container.read(nearbyExamplesProvider.future);

      expect(examples, isEmpty);
      expect(client.requested, hasLength(1));
    });

    test(
      'ошибка списка — примеров нет: под экраном ошибки список не растёт',
      () async {
        final client = _FakeApiClient()
          ..listResponse = ApiFailure.transport('Сервер не отвечает')
          ..examplesResponse = ActivityPage.fromJson(
            _fixture('activities_list.json'),
          );
        final container = _container(client);

        // Список читаем подписчиком, как это делает экран: без слушателя
        // упавший провайдер до состояния не доживает. Проверяем здесь не саму
        // ошибку (у неё свой тест), а что второго запроса не появилось.
        final subscription = container.listen(
          catalogProvider,
          (previous, next) {},
        );
        addTearDown(subscription.close);
        await pumpEventQueue();

        final examples = await container.read(nearbyExamplesProvider.future);

        expect(client.requested, hasLength(1));
        expect(examples, isEmpty);
      },
    );

    test('сбой запроса примеров оставляет пустоту, а не ошибку', () async {
      final client = _FakeApiClient()
        ..examplesResponse = const ApiFailure(
          statusCode: 500,
          message: 'Сервер ошибся',
        );
      final container = _container(client);

      await container.read(catalogProvider.future);
      final examples = await container.read(nearbyExamplesProvider.future);

      // Образцы украшают пустой результат, а не заменяют его: падать здесь
      // нечем, иначе «ничего не нашлось» превратится в ошибку второго уровня.
      expect(examples, isEmpty);
      expect(client.requested, hasLength(2));
    });
  });
}
