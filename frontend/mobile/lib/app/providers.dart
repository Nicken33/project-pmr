import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_config.dart';
import '../data/api/api_client.dart';

final apiConfigProvider = Provider<ApiConfig>(
  (ref) => ApiConfig.fromEnvironment(),
);

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(config: ref.watch(apiConfigProvider));
  ref.onDispose(client.dispose);
  return client;
});
