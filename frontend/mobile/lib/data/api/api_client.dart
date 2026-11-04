import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';

import '../../core/api_config.dart';
import '../../core/l10n.dart';
import '../../domain/catalog_query.dart';
import '../models/activity.dart';
import '../models/json.dart';
import '../models/reference.dart';
import 'api_failure.dart';

/// Транспорт до Go-сервера Talentro. Маршруты и формы ответов —
/// `backend/Talentro/API.md`, сверенные со снимками живого :8081.
///
/// Сессия держится в [CookieJar], а не в аналоге localStorage: сервер ставит
/// HttpOnly-куку `talentro_session` (§12.1), и читать `Set-Cookie` руками
/// нельзя — иначе клиент теряет куку при первом же `SameSite`-сценарии.
/// CookieJar сейчас in-memory: он переживает навигацию внутри запуска, но не
/// перезапуск приложения. Для долгой сессии нужен `PersistCookieJar` +
/// `path_provider` (см. README, «Открытые вопросы»).
///
/// Эндпоинтов авторизации в контракте ещё нет, поэтому их нет и здесь: вход
/// (§3.7) добавляется одним слоем поверх этого клиента, когда сервер объявит
/// маршруты, — переписывать тогда придётся реализацию, а не состояния экранов.
class ApiClient {
  ApiClient({required this.config, Dio? dio, CookieJar? cookieJar})
    : cookieJar = cookieJar ?? CookieJar(),
      _dio = dio ?? Dio() {
    final options = _dio.options;
    options.connectTimeout = const Duration(seconds: 8);
    options.receiveTimeout = const Duration(seconds: 10);
    options.responseType = ResponseType.json;
    options.headers['Accept'] = 'application/json';
    _dio.interceptors.add(CookieManager(this.cookieJar));
  }

  final ApiConfig config;
  final Dio _dio;
  final CookieJar cookieJar;

  void dispose() => _dio.close(force: true);

  Future<ActivityPage> activities(CatalogQuery query) async {
    final data = await _get(config.activities, query: query.toQuery());
    return ActivityPage.fromJson(asMap(data));
  }

  Future<ActivityDetail> activity(String slug) async {
    final data = await _get(config.activityBySlug(slug));
    return ActivityDetail.fromJson(asMap(data));
  }

  Future<List<CategoryNode>> categories() =>
      _getList(config.categories, CategoryNode.fromJson);

  Future<List<City>> cities() => _getList(config.cities, City.fromJson);

  /// Районы отдаются только для конкретного города (§5.4), пустой slug —
  /// не «все районы», а 400 от сервера.
  Future<List<District>> districts(String citySlug) =>
      _getList(config.districts, District.fromJson, query: {'city': citySlug});

  Future<OrganizationPage> organization(String slug) async {
    final data = await _get(config.organizationBySlug(slug));
    return OrganizationPage.fromJson(asMap(data));
  }

  Future<Object?> _get(Uri uri, {Map<String, String>? query}) async {
    try {
      final response = await _dio.get<dynamic>(
        uri.toString(),
        queryParameters: query,
      );
      return response.data;
    } on DioException catch (error) {
      throw _failureFrom(error);
    }
  }

  Future<List<T>> _getList<T>(
    Uri uri,
    T Function(Map<String, dynamic>) fromJson, {
    Map<String, String>? query,
  }) async {
    final data = await _get(uri, query: query);
    if (data is! List) {
      throw ApiFailure(statusCode: 200, message: AppStrings.unexpectedAnswer);
    }
    return data
        .whereType<Map>()
        .map((item) => fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  /// Dio при `ResponseType.json` отдаёт тело как строку, если сервер ответил
  /// не-JSON контентом (Go-роутер так и делает на 404). Конверт §9.3 надо
  /// додекодить здесь, иначе `fields` с подсказками по полям потеряются.
  Object? _decodeBody(Response<dynamic> response) {
    final data = response.data;
    if (data is String && data.trimLeft().startsWith('{')) {
      try {
        return jsonDecode(data);
      } on FormatException {
        return data;
      }
    }
    return data ?? response.statusMessage;
  }

  ApiFailure _failureFrom(DioException error) => switch (error) {
    DioException(type: DioExceptionType.badResponse, response: final response)
        when response != null =>
      ApiFailure.fromResponse(response.statusCode ?? 0, _decodeBody(response)),
    DioException(
      type: DioExceptionType.connectionTimeout ||
          DioExceptionType.sendTimeout ||
          DioExceptionType.receiveTimeout ||
          DioExceptionType.connectionError,
      requestOptions: final options,
    ) =>
      ApiFailure.transport('${AppStrings.networkError}: ${options.uri}'),
    _ => ApiFailure(
      statusCode: error.response?.statusCode ?? 0,
      message: error.message ?? AppStrings.networkError,
    ),
  };
}
