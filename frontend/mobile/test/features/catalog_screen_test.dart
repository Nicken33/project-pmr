import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/app/providers.dart';
import 'package:talentro_mobile/core/api_config.dart';
import 'package:talentro_mobile/core/theme.dart';
import 'package:talentro_mobile/data/api/api_client.dart';
import 'package:talentro_mobile/data/api/api_failure.dart';
import 'package:talentro_mobile/data/models/activity.dart';
import 'package:talentro_mobile/domain/catalog_query.dart';
import 'package:talentro_mobile/features/activity/activity_detail_screen.dart';
import 'package:talentro_mobile/features/catalog/catalog_screen.dart';
import 'package:talentro_mobile/features/catalog/state_views.dart';

/// Подставной клиент отвечает ровно теми байтами, что записаны в фикстурах,
/// поэтому экраны проверяются на реальном контракте, а не на выдуманном наборе.
class _FakeApiClient extends ApiClient {
  _FakeApiClient()
    : super(config: const ApiConfig(baseUrl: 'http://example.test'));

  Object? activitiesResponse;
  Object? detailResponse;
  final List<CatalogQuery> requested = [];

  /// Пока комплер не завершён, список «висит» в состоянии загрузки.
  Completer<ActivityPage>? gate;

  @override
  Future<ActivityPage> activities(CatalogQuery query) async {
    requested.add(query);
    final pending = gate;
    if (pending != null) return pending.future;
    final value = activitiesResponse!;
    if (value is ApiFailure) throw value;
    return value as ActivityPage;
  }

  @override
  Future<ActivityDetail> activity(String slug) async {
    final value = detailResponse!;
    if (value is ApiFailure) throw value;
    return value as ActivityDetail;
  }
}

Map<String, dynamic> _fixture(String name) =>
    jsonDecode(File('test/fixtures/api/$name').readAsStringSync())
        as Map<String, dynamic>;

Widget _wrap(Widget child, ApiClient client) => ProviderScope(
  overrides: [apiClientProvider.overrideWithValue(client)],
  child: MaterialApp(theme: AppTheme.mobile, home: child),
);

void main() {
  group('Экран каталога — состояния из §3.1.9', () {
    testWidgets('данные: «Найдено N», плитка, «Показать ещё» и счётчик', (
      tester,
    ) async {
      final client = _FakeApiClient()
        ..activitiesResponse = ActivityPage.fromJson(
          _fixture('activities_list.json'),
        );

      await tester.pumpWidget(_wrap(const CatalogScreen(), client));
      await tester.pumpAndSettle();

      expect(find.text('Найдено: 8'), findsOneWidget);
      expect(
        find.text('Детская музыкальная школа «Весёлые ноты»'),
        findsOneWidget,
      );
      expect(find.textContaining('от 200 руб. ПМР'), findsOneWidget);
      expect(find.text('Показать ещё'), findsOneWidget);
      expect(find.text('Показано 3 из 8'), findsOneWidget);
    });

    testWidgets('первая загрузка — скелетон, а не пустой экран', (
      tester,
    ) async {
      final client = _FakeApiClient()..gate = Completer<ActivityPage>();

      await tester.pumpWidget(_wrap(const CatalogScreen(), client));
      await tester.pump();

      expect(find.byType(CatalogSkeleton), findsOneWidget);
      expect(find.text('Найдено: 8'), findsNothing);

      client.gate!.complete(
        const ActivityPage(items: [], total: 0, page: 1, limit: 20),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CatalogSkeleton), findsNothing);
      expect(client.requested, hasLength(1));
    });

    testWidgets(
      'ошибка сети — «Каталог не загрузился», а не «ничего не нашлось»',
      (tester) async {
        final client = _FakeApiClient()
          ..activitiesResponse = ApiFailure.transport(
            'Сервер не отвечает: http://10.0.2.2:8081',
          );

        await tester.pumpWidget(_wrap(const CatalogScreen(), client));
        await tester.pumpAndSettle();

        expect(find.text('Каталог не загрузился'), findsOneWidget);
        expect(find.text('Повторить'), findsOneWidget);
        expect(find.text('Пока ничего не нашлось'), findsNothing);
      },
    );

    testWidgets('пусто без фильтров — сброс не предлагается', (tester) async {
      final client = _FakeApiClient()
        ..activitiesResponse = const ActivityPage(
          items: [],
          total: 0,
          page: 1,
          limit: 20,
        );

      await tester.pumpWidget(_wrap(const CatalogScreen(), client));
      await tester.pumpAndSettle();

      expect(find.text('Пока ничего не нашлось'), findsOneWidget);
      expect(find.text('Сбросить всё'), findsNothing);
    });

    testWidgets(
      'поиск уходит на сервер каждым символом и показывает чип сброса',
      (tester) async {
        final client = _FakeApiClient()
          ..activitiesResponse = const ActivityPage(
            items: [],
            total: 0,
            page: 1,
            limit: 20,
          );

        await tester.pumpWidget(_wrap(const CatalogScreen(), client));
        await tester.pumpAndSettle();

        await tester.enterText(find.byType(TextField), 'жонглирование');
        await tester.pumpAndSettle();

        expect(client.requested.last.q, 'жонглирование');
        expect(find.text('Сбросить всё'), findsOneWidget);
        expect(find.textContaining('q: жонглирование'), findsOneWidget);

        // М3-чип рисует крестик `Icons.clear` (size 18) — не `Icons.cancel`.
        await tester.tap(find.byIcon(Icons.clear).first);
        await tester.pumpAndSettle();

        expect(client.requested.last.q, isNull);
      },
    );

    testWidgets('плитка не обещает того, чего нет: «Фото нет» и без сердечка', (
      tester,
    ) async {
      final client = _FakeApiClient()
        ..activitiesResponse = ActivityPage.fromJson(
          _fixture('activities_list.json'),
        );

      await tester.pumpWidget(_wrap(const CatalogScreen(), client));
      await tester.pumpAndSettle();

      expect(find.text('Фото нет'), findsWidgets);
      // Эндпоинтов избранного на сервере нет — некликабельное сердце не рисуем.
      expect(find.byIcon(Icons.favorite_border), findsNothing);
    });

    testWidgets('кнопка «Повторить» не ниже зоны нажатия 44 px (§10.6)', (
      tester,
    ) async {
      final client = _FakeApiClient()
        ..activitiesResponse = const ApiFailure(
          statusCode: 500,
          message: 'boom',
        );

      await tester.binding.setSurfaceSize(const Size(420, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(const CatalogScreen(), client));
      await tester.pumpAndSettle();

      expect(
        tester.getSize(find.widgetWithText(FilledButton, 'Повторить')).height,
        greaterThanOrEqualTo(44),
      );
    });
  });

  group('Экран карточки занятия (§3.3)', () {
    testWidgets(
      'группы с ценой и расписанием, точки, возраст по всем группам',
      (tester) async {
        final client = _FakeApiClient()
          ..detailResponse = ActivityDetail.fromJson(
            _fixture('activity_detail.json'),
          );

        // ListView строит только то, что попадает во вьюпорт с cacheExtent,
        // поэтому нижние секции (точки, организация) проверяем на длинном
        // экране: иначе assertion упал бы из-за ленивой прокрутки, а не из-за
        // того, что данных на карточке нет.
        await tester.binding.setSurfaceSize(const Size(420, 2400));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await tester.pumpWidget(
          _wrap(
            const ActivityDetailScreen(slug: 'tiraspol-veselye-noty'),
            client,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('О занятии'), findsOneWidget);
        expect(find.text('4–12 лет'), findsOneWidget);
        expect(find.text('Расписание и стоимость'), findsOneWidget);
        expect(find.text('Группы'), findsOneWidget);
        expect(find.textContaining('200 руб. ПМР в месяц'), findsOneWidget);
        expect(find.textContaining('250–300 руб. ПМР'), findsOneWidget);
        expect(find.textContaining('Вт, Чт 15:00–16:00'), findsOneWidget);
        expect(find.text('Тирасполь, Центр, ул. Еврейская, 42'), findsWidgets);
        // Флаг `verified` взведён, а даты сверки у занятия в каноне нет
        // (`contacts_verified_at: null` только у организации и точек) — значит
        // плашка называет признак, а не придуманную дату (§11). Ровно так же
        // ведёт себя канонический сайт: `verified` → `contactsVerified`,
        // `verifiedAt` остаётся пустым (web/src/lib/api-server.ts:253-257), а
        // строка взята с ActivityDetail.tsx:697.
        expect(
          find.text('Контакты сверены — не старше 90 дней'),
          findsOneWidget,
        );
        expect(find.textContaining('данные проверены'), findsNothing);
        expect(find.text('данные ориентировочные'), findsNothing);
      },
    );

    testWidgets(
      '404 — «Занятие не найдено», ошибка сети — «Сервер не отвечает»',
      (tester) async {
        final notFound = _FakeApiClient()
          ..detailResponse = const ApiFailure(
            statusCode: 404,
            message: '404 page not found',
          );

        await tester.pumpWidget(
          _wrap(const ActivityDetailScreen(slug: 'net-takoy'), notFound),
        );
        await tester.pumpAndSettle();

        expect(find.text('Занятие не найдено'), findsOneWidget);
        expect(find.text('Повторить'), findsOneWidget);

        final transport = _FakeApiClient()
          ..detailResponse = ApiFailure.transport(
            'Сервер не отвечает: http://10.0.2.2:8081',
          );

        await tester.pumpWidget(
          _wrap(const ActivityDetailScreen(slug: 'net-takoy'), transport),
        );
        await tester.pumpAndSettle();

        expect(find.text('Занятие не найдено'), findsNothing);
        expect(find.text('Сервер не отвечает'), findsOneWidget);
      },
    );
  });
}
