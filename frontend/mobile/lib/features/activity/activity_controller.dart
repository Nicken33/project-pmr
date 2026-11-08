import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../data/models/activity.dart';

/// Карточка занятия целиком (§9.3): группы, точки и организация приезжают
/// одним ответом, отдельных эндпоинтов для них на сервере нет.
final activityDetailProvider = FutureProvider.family<ActivityDetail, String>(
  (ref, slug) => ref.watch(apiClientProvider).activity(slug),
);
