import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/data/api/api_failure.dart';

void main() {
  group('ApiFailure — конверт §9.3', () {
    test('400 без city разбирается вместе с подсказкой по полю', () {
      final body = jsonDecode(
        File('test/fixtures/api/districts_no_city_400.json').readAsStringSync(),
      ) as Map<String, dynamic>;

      final failure = ApiFailure.fromResponse(400, body);

      expect(failure.statusCode, 400);
      expect(failure.code, 400);
      expect(failure.validation, isTrue);
      expect(failure.message, 'проверь поля');
      expect(failure.fieldError('city'), contains('§5.4'));
      expect(failure.fieldError('q'), isNull);
      expect(failure.transport, isFalse);
    });

    test('коды различаются по смыслу, а не только по числу', () {
      const body = {
        'error': {'code': 401, 'message': 'нужен вход', 'fields': {}},
      };

      final failure = ApiFailure.fromResponse(401, body);

      expect(failure.unauthorized, isTrue);
      expect(failure.forbidden, isFalse);
      expect(failure.notFound, isFalse);
      expect(failure.rateLimited, isFalse);
    });

    test(
      '429 — клиент обязан показать «слишком часто», а не повторять запрос',
      () {
        final failure = ApiFailure.fromResponse(429, {
          'error': {'code': 429, 'message': 'слишком часто'},
        });

        expect(failure.rateLimited, isTrue);
        expect(failure.message, 'слишком часто');
      },
    );

    test(
      'несуществующий маршрут: Go отдаёт текст, и это не молчаливая пустота',
      () {
        final failure = ApiFailure.fromResponse(404, '404 page not found\n');

        expect(failure.notFound, isTrue);
        expect(failure.message, '404 page not found');
        expect(failure.fields, isEmpty);
      },
    );

    test('JSON без конверта не превращается в выдуманное сообщение', () {
      final failure = ApiFailure.fromResponse(500, {'detail': 'boom'});

      expect(failure.statusCode, 500);
      expect(failure.message, 'Неожиданный ответ сервера');
    });

    test('пустое тело — тоже «Неожиданный ответ сервера»', () {
      expect(
        ApiFailure.fromResponse(502, '').message,
        'Неожиданный ответ сервера',
      );
      expect(
        ApiFailure.fromResponse(502, null).message,
        'Неожиданный ответ сервера',
      );
    });

    test('транспортная ошибка отличается от ответа сервера', () {
      final failure = ApiFailure.transport(
        'Сервер не отвечает: http://10.0.2.2:8081',
      );

      expect(failure.transport, isTrue);
      expect(failure.statusCode, 0);
      expect(failure.notFound, isFalse);
      expect('$failure', contains('Сервер не отвечает'));
    });
  });
}
