import 'package:go_router/go_router.dart';

import '../features/activity/activity_detail_screen.dart';
import '../features/catalog/catalog_screen.dart';

/// Маршруты приложения. Слаг — единственный идентификатор карточки в URL:
/// web-клиент ссылается на `/activities/{slug}`, сервер отдаёт карточку по нему.
final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const CatalogScreen()),
    GoRoute(
      path: '/activity/:slug',
      builder: (context, state) =>
          ActivityDetailScreen(slug: state.pathParameters['slug'] ?? ''),
    ),
  ],
);
