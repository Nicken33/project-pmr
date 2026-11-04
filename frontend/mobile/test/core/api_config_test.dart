import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/core/api_config.dart';

/// Адрес стенда задаёт сборка, а не код: по умолчанию приложение едет на канон
/// §7, а `--dart-define=API_BASE_URL=...` переключает его на свой сервер, не
/// трогая слои data/domain. Проверка держит обе половины — и дефолт, и то, что
/// маршруты v1 строятся от переданного адреса, а не приписаны руками.
void main() {
  group('ApiConfig — адрес API', () {
    test('без `--dart-define` дефолт — канонический стенд §7', () {
      // В тестовом прогоне `API_BASE_URL` не определён, поэтому fromEnvironment
      // обязан отдать стенд координатора, а не localhost и не 10.0.2.2.
      expect(ApiConfig.fromEnvironment().baseUrl, ApiConfig.standDefault);
      expect(ApiConfig.standDefault, 'http://26.52.103.163:8080');
    });

    test('флаг сборки чистится от хвостового `/` и пробелов', () {
      // `...:8080/` без нормализации даёт `//api/v1/activities`, а это 404.
      expect(
        ApiConfig.normalizeBaseUrl('http://127.0.0.1:8080/'),
        'http://127.0.0.1:8080',
      );
      expect(
        ApiConfig.normalizeBaseUrl(' http://host.test:8080// '),
        'http://host.test:8080',
      );
      // Пустой флаг не должен превращаться в «адрес из воздуха»: остаются
      // границы, а путь к стенду подставляет fromEnvironment.
      expect(ApiConfig.normalizeBaseUrl(''), isEmpty);
    });

    test('маршруты v1 строятся от переданного адреса', () {
      const config = ApiConfig(baseUrl: 'http://10.0.2.2:8081');

      expect(config.v1, 'http://10.0.2.2:8081/api/v1');
      expect(
        config.activities.toString(),
        'http://10.0.2.2:8081/api/v1/activities',
      );
      expect(
        config.categories.toString(),
        'http://10.0.2.2:8081/api/v1/categories',
      );
      expect(config.cities.toString(), 'http://10.0.2.2:8081/api/v1/cities');
      expect(
        config.districts.toString(),
        'http://10.0.2.2:8081/api/v1/districts',
      );
    });

    test('slug уходит в путь закодированным', () {
      const config = ApiConfig(baseUrl: 'http://stand');

      expect(
        config.activityBySlug('tiraspol-studiya-palitra').toString(),
        'http://stand/api/v1/activities/tiraspol-studiya-palitra',
      );
      // Slug может приехать с кириллицей — голым текстом в URL её оставлять
      // нельзя, запрос развалится ещё на дороге.
      expect(
        config.activityBySlug('музыка и право').toString(),
        contains('%D0%BC%D1%83%D0%B7%D1%8B%D0%BA%D0%B0'),
      );
      // Слэш внутри slug не должен открыть чужую ветку маршрута.
      expect(config.activityBySlug('a/b').path, '/api/v1/activities/a%2Fb');
      expect(
        config.organizationBySlug('studiya-palitra').toString(),
        'http://stand/api/v1/organizations/studiya-palitra',
      );
    });
  });
}
