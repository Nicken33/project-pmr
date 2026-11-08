import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/core/api_config.dart';
import 'package:talentro_mobile/data/api/api_client.dart';
import 'package:talentro_mobile/data/api/api_failure.dart';
import 'package:talentro_mobile/domain/catalog_query.dart';

/// Транспорт проверяется без сети: заглушка отдаёт ровно те байты, что присылает
/// канон §7, и помнит, каким был запрос. Так под тестом оказываются три вещи,
/// которые на экране не видны: кодировка кириллицы в URL, разбор конверта
/// ошибки, когда Go отвечает текстом, и кука сессии, которую держит `CookieJar`.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.responder);

  final ResponseBody Function(RequestOptions options, int call) responder;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return responder(options, requests.length - 1);
  }

  @override
  void close({bool force = false}) {}
}

const _config = ApiConfig(baseUrl: 'http://stand.test');

ApiClient _client(_StubAdapter adapter) =>
    ApiClient(config: _config, dio: Dio()..httpClientAdapter = adapter);

/// Go-роутер отдаёт ошибки текстом (`http.Error`), поэтому и здесь content-type
/// не JSON — ровно так, как на живом стенде.
ResponseBody _text(
  String body,
  int status, {
  Map<String, List<String>> headers = const {},
}) => ResponseBody.fromString(
  body,
  status,
  headers: {
    'content-type': ['text/plain; charset=utf-8'],
    ...headers,
  },
);

ResponseBody _json(
  String body,
  int status, {
  Map<String, List<String>> headers = const {},
}) => ResponseBody.fromString(
  body,
  status,
  headers: {
    'content-type': ['application/json'],
    ...headers,
  },
);

const _emptyPage = '{"items":[],"total":0,"page":1,"limit":20}';

/// Репозиторий наружу отдаёт только [ApiFailure]: любой другой исход — либо
/// ответ (значит, ошибка проглочена), либо чужое исключение (значит, клиент его
/// не конвертирует). Оба случая валят тест, а не размазываются по expect.
Future<ApiFailure> _failureFrom(Future<Object?> operation) async {
  try {
    await operation;
  } on ApiFailure catch (failure) {
    return failure;
  }
  fail('ожидался ApiFailure, а пришёл ответ');
}

void main() {
  group('ApiClient — запрос на канон §7', () {
    test(
      'маршрут каталога: Accept, limit по умолчанию и кириллица в URL',
      () async {
        final adapter = _StubAdapter((_, _) => _json(_emptyPage, 200));

        await _client(
          adapter,
        ).activities(const CatalogQuery(q: 'музыка', districtSlugs: ['centr']));

        final request = adapter.requests.single;
        final uri = request.uri;
        expect(uri.path, '/api/v1/activities');
        // `музыка` → %D0%BC… Без кодировки кириллица в query ломает запрос.
        expect(
          uri.toString(),
          contains('%D0%BC%D1%83%D0%B7%D1%8B%D0%BA%D0%B0'),
        );
        expect(uri.queryParameters['q'], 'музыка');
        expect(uri.queryParameters['limit'], '20');
        // Район без города сервер отклоняет 400 (§5.4) — в URL его нет.
        expect(uri.queryParameters.containsKey('district'), isFalse);
        expect(request.headers['Accept'], 'application/json');
      },
    );

    test('район уезжает только вместе с городом (§5.4)', () async {
      final adapter = _StubAdapter((_, _) => _json(_emptyPage, 200));

      await _client(adapter).activities(
        const CatalogQuery(
          citySlug: 'tiraspol',
          districtSlugs: ['centr', 'balka'],
        ),
      );

      final uri = adapter.requests.single.uri;
      expect(uri.queryParameters['city'], 'tiraspol');
      expect(uri.queryParameters['district'], 'centr,balka');
    });

    test(
      'slug уходит в путь закодированным — слэш не меняет маршрут',
      () async {
        final adapter = _StubAdapter(
          (_, _) => _json('{"organization":{},"activities":[],"total":0}', 200),
        );

        await _client(adapter).organization('palitra/../../etc');

        expect(
          adapter.requests.single.uri.path,
          '/api/v1/organizations/palitra%2F..%2F..%2Fetc',
        );
      },
    );

    test('районы спрашиваются только для конкретного города', () async {
      final adapter = _StubAdapter((_, _) => _json('[]', 200));

      await _client(adapter).districts('tiraspol');

      final uri = adapter.requests.single.uri;
      expect(uri.path, '/api/v1/districts');
      expect(uri.queryParameters['city'], 'tiraspol');
    });
  });

  group('ApiClient — пустые состояния репозитория', () {
    test('пустой каталог — страница без элементов, а не ошибка', () async {
      final adapter = _StubAdapter((_, _) => _json(_emptyPage, 200));

      final page = await _client(adapter).activities(const CatalogQuery());

      expect(page.items, isEmpty);
      expect(page.total, 0);
    });

    test('пустой справочник — пустой список, не исключение', () async {
      final adapter = _StubAdapter((_, _) => _json('[]', 200));

      expect(await _client(adapter).cities(), isEmpty);
    });

    test('справочник ответил объектом вместо списка — наружу идёт ошибка, '
        'а не молчаливая пустота', () async {
      final adapter = _StubAdapter((_, _) => _json('{"items":[]}', 200));

      final failure = await _failureFrom(_client(adapter).categories());

      expect(failure.message, 'Неожиданный ответ сервера');
    });
  });

  group('ApiClient — ошибки транспорта и сервера', () {
    test('несуществующий маршрут: текст 404 доходит как notFound', () async {
      final adapter = _StubAdapter(
        (_, _) => _text('404 page not found\n', 404),
      );

      final failure = await _failureFrom(
        _client(adapter).activity('net-takoy'),
      );

      expect(failure.notFound, isTrue);
      expect(failure.message, '404 page not found');
      expect(failure.fields, isEmpty);
    });

    test('400 с конвертом в тексте: подсказки по полям сохраняются, а не съедаются', () async {
      final envelope = jsonEncode({
        'error': {
          'code': 400,
          'message': 'проверь поля',
          'fields': {'city': 'нужен город (параметр city)'},
        },
      });
      final adapter = _StubAdapter((_, _) => _text(envelope, 400));

      final failure = await _failureFrom(
        _client(adapter).districts('tiraspol'),
      );

      expect(failure.validation, isTrue);
      expect(failure.fieldError('city'), contains('нужен город'));
    });

    test('таймаут — транспортная ошибка, а не пустой список', () async {
      // DioException строится на тех же RequestOptions, что пришли в `fetch`:
      // иначе в сообщении остаётся голый путь без хоста, и пользователь не
      // поймёт, к какому именно стенду приложение не достучалось.
      final adapter = _StubAdapter(
        (options, call) => throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionTimeout,
        ),
      );

      final failure = await _failureFrom(_client(adapter).cities());

      expect(failure.transport, isTrue);
      expect(failure.message, contains('Сервер не отвечает'));
      expect(failure.message, contains('stand.test/api/v1/cities'));
    });
  });

  group('ApiClient — сессия в CookieJar', () {
    // Первый ответ ставит сессионную куку (§12.1). Клиент обязан прочитать её
    // из заголовка и вернуть в следующем запросе сам: руками `Set-Cookie` не
    // читаем, иначе кука теряется на первом же `SameSite`-сценарии.
    final adapter = _StubAdapter(
      (_, call) => call == 0
          ? _json(
              _emptyPage,
              200,
              headers: const {
                'set-cookie': [
                  'talentro_session=abc; HttpOnly; Path=/; Max-Age=2592000',
                ],
              },
            )
          : _json('{"organization":{},"activities":[],"total":0}', 200),
    );
    final client = _client(adapter);

    test('кука из Set-Cookie уходит в следующем запросе', () async {
      await client.activities(const CatalogQuery());
      await client.organization('studiya-palitra');

      expect(adapter.requests, hasLength(2));
      final cookie = adapter.requests[1].headers.entries.where(
        (entry) => entry.key.toLowerCase() == 'cookie',
      );
      expect(cookie, isNotEmpty);
      expect('${cookie.first.value}', contains('talentro_session=abc'));
    });
  });
}
