import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../data/api/api_failure.dart';
import '../../domain/catalog_query.dart';
import 'activity_tile.dart';
import 'catalog_controller.dart';
import 'state_views.dart';

/// Каталог (§3.1): поиск, счётчик «Найдено: N», список, «Показать ещё»,
/// четыре состояния. Фильтры в этой итерации — поиск; панель фильтров
/// (§3.1.3) следующий чекпоинт, модели запроса уже под неё готовы.
class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    final query = ref.watch(catalogQueryProvider);
    // Тот же разбор, что в `_body`: `AsyncData` здесь не подходит — при
    // «Показать ещё» значение живёт в AsyncData, а при упавшем загрузчике
    // Riverpod оставляет loading с hasError, и счётчик показывать нельзя.
    final loaded = catalog.hasValue && !catalog.hasError
        ? catalog.requireValue
        : null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Talentro'),
        backgroundColor: Tokens.bg,
        foregroundColor: Tokens.ink,
      ),
      body: SafeArea(
        child: Column(
          children: [
            _SearchField(
              onChanged: (value) =>
                  ref.read(catalogQueryProvider.notifier).setSearch(value),
            ),
            if (query.activeFilterKeys.isNotEmpty) _ActiveChips(query: query),
            // «Найдено: N» считает занятия, а не группы (§3.1.5).
            if (loaded != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                child: Text(
                  '${AppStrings.found}: ${loaded.total}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            Expanded(
              child: RefreshIndicator(
                // Вытянутый список при недоступном сервере не должен кидать
                // исключение из callback: `.future` бросает ApiFailure.
                onRefresh: () async {
                  ref.invalidate(catalogProvider);
                  try {
                    await ref.read(catalogProvider.future);
                  } on ApiFailure {
                    // Состояние провайдера уже показывает панель ошибки.
                  }
                },
                child: _body(
                  context,
                  ref,
                  catalog,
                  loaded,
                  query.activeFilterKeys.isNotEmpty,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Riverpod 3 при упавшем `build()` оставляет `AsyncLoading` с
  /// `hasError == true`, а не `AsyncError` (проверено тестом). Разбор состояния
  /// идёт по `hasValue`/`hasError`, иначе при недоступном сервере на экране
  /// навсегда остался бы скелетон — ровно то, что запрещает §3.1.8.
  Widget _body(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<CatalogState> catalog,
    CatalogState? loaded,
    bool hasFilters,
  ) {
    if (loaded != null) {
      return _CatalogList(
        state: loaded,
        hasFilters: hasFilters,
        onTap: (slug) => context.push('/activity/$slug'),
      );
    }
    if (catalog.hasError) {
      final error = catalog.error;
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: CatalogErrorView(
          message: error is ApiFailure
              ? error.message
              : AppStrings.unexpectedAnswer,
          onRetry: () => ref.invalidate(catalogProvider),
        ),
      );
    }
    return const SingleChildScrollView(
      physics: AlwaysScrollableScrollPhysics(),
      child: Padding(padding: EdgeInsets.all(16), child: CatalogSkeleton()),
    );
  }
}

class _CatalogList extends ConsumerWidget {
  const _CatalogList({
    required this.state,
    required this.hasFilters,
    required this.onTap,
  });

  final CatalogState state;
  final bool hasFilters;
  final void Function(String slug) onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 24),
          CatalogEmptyView(
            canReset: hasFilters,
            onReset: () => ref.read(catalogQueryProvider.notifier).reset(),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: state.items.length + 1,
      itemBuilder: (context, index) {
        if (index == state.items.length) {
          return _MoreButton(state: state);
        }
        final item = state.items[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ActivityTile(item: item, onTap: () => onTap(item.slug)),
        );
      },
    );
  }
}

class _MoreButton extends ConsumerWidget {
  const _MoreButton({required this.state});

  final CatalogState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!state.hasMore) return const SizedBox.shrink();
    return Column(
      children: [
        OutlinedButton(
          onPressed: state.isLoadingMore
              ? null
              : () => ref.read(catalogProvider.notifier).loadMore(),
          child: Text(
            state.isLoadingMore ? AppStrings.loadingMore : AppStrings.showMore,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${AppStrings.shownOf} ${state.items.length} из ${state.total}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
    child: TextField(
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: const InputDecoration(
        hintText: 'Поиск по названию, организации или описанию',
        prefixIcon: Icon(Icons.search),
      ),
    ),
  );
}

class _ActiveChips extends ConsumerWidget {
  const _ActiveChips({required this.query});

  final CatalogQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) => SizedBox(
    height: 44,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        for (final key in query.activeFilterKeys)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InputChip(
              // Подпись фильтра — человекочитаемая, значение — machine-slug
              // со справочника сервера (§4.5). Пока ключ: значение из запроса.
              label: Text('$key: ${_value(key)}'),
              onDeleted: () =>
                  ref.read(catalogQueryProvider.notifier).clear(key),
            ),
          ),
      ],
    ),
  );

  String _value(String key) => switch (key) {
    'q' => query.q ?? '',
    'city' => query.citySlug ?? '',
    'district' => query.districtSlugs.join(', '),
    'category' => query.categorySlug ?? '',
    'age' => '${query.age}',
    'price_max' => '${query.priceMax}',
    'free' => AppStrings.free,
    'online' => switch (query.online) {
      true => AppStrings.formatOnline,
      false => AppStrings.formatOffline,
      null => '',
    },
    'verified' => AppStrings.verifiedPrefix,
    'kind' => query.kind ?? '',
    'day' => '${query.day}',
    'time' => query.time ?? '',
    'near' => query.near?.toParam() ?? '',
    'sort' => query.sort ?? '',
    _ => '',
  };
}
