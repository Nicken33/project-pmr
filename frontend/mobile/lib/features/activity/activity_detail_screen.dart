import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../data/api/api_failure.dart';
import '../../data/models/activity.dart';
import '../../data/models/activity_parts.dart';
import '../../domain/format.dart';
import '../../domain/price.dart';
import '../catalog/state_views.dart';
import 'activity_controller.dart';

/// Карточка занятия (§3.3) в объёме, который держится на реальном контракте:
/// плоские поля + `groups[]` (возраст, цена, расписание) + `locations[]`
/// (адрес, координаты) + `organization`.
///
/// Галерея, голоса «плюс/минус», жалоба и мессенджеры — следующий чекпоинт:
/// для медиа не согласован хост, а `POST /activities/{slug}/vote` и
/// `POST /reports` на сервере ещё не существуют. Кнопку «Позвонить» здесь тоже
/// нет: нужен `url_launcher`, а решение по зависимостям за координатором.
class ActivityDetailScreen extends ConsumerWidget {
  const ActivityDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(activityDetailProvider(slug));

    return Scaffold(
      appBar: AppBar(
        title: Text(detail.value?.card.name ?? ''),
        backgroundColor: Tokens.bg,
        foregroundColor: Tokens.ink,
      ),
      body: SafeArea(child: _body(context, ref, detail)),
    );
  }

  /// Разбор по `hasValue`/`hasError`, а не по `AsyncError`: в Riverpod 3 упавший
  /// `build()` оставляет `AsyncLoading` с `hasError == true` (проверено тестом),
  /// и панель ошибки по типу никогда не показалась бы.
  Widget _body(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<ActivityDetail> detail,
  ) {
    void retry() => ref.invalidate(activityDetailProvider(slug));

    if (detail.hasValue && !detail.hasError) {
      return _DetailBody(detail: detail.requireValue);
    }
    if (detail.hasError) {
      final error = detail.error;
      return _ErrorPanel(
        failure: error is ApiFailure
            ? error
            : ApiFailure(statusCode: 0, message: '$error'),
        onRetry: retry,
      );
    }
    return const Center(child: CircularProgressIndicator());
  }
}

/// 404 — «занятие не найдено» (подпись web/src/app/activities/[slug]/page.tsx:35),
/// всё остальное — «сервер не отвечает». Сводить эти два состояния в одну
/// подпись нельзя: приёмка §15 различает «нет данных» и «данные не дошли».
class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.failure, required this.onRetry});

  final ApiFailure failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    physics: const AlwaysScrollableScrollPhysics(),
    child: StatePanel(
      icon: Icon(
        failure.notFound ? Icons.search_off : Icons.wifi_off_outlined,
        size: 30,
      ),
      title: failure.notFound
          ? AppStrings.activityNotFound
          : AppStrings.networkError,
      message: failure.message,
      actions: [
        FilledButton(onPressed: onRetry, child: const Text(AppStrings.retry)),
      ],
    ),
  );
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.detail});

  final ActivityDetail detail;

  @override
  Widget build(BuildContext context) {
    final card = detail.card;
    final locations = detail.locations;
    final primary = locations.isEmpty ? null : locations.first;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Text(card.name, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(
          card.isService ? 'Услуга' : 'Занятие',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        _Section(
          title: AppStrings.aboutHeading,
          children: [
            _Fact(
              label: AppStrings.labelWhere,
              value: detail.organization?.name ?? card.orgName ?? '',
            ),
            _Fact(label: AppStrings.labelAge, value: ageSummary(detail.groups)),
            _Fact(
              label: AppStrings.labelFormat,
              value: formatLabel(card.format),
            ),
            _Fact(
              label: AppStrings.labelType,
              value: typeLabel(
                isService: card.isService,
                lessonType: card.lessonType,
              ),
            ),
            _Fact(
              label: AppStrings.labelAddresses,
              value: '${locations.length} ${addressWord(locations.length)}',
            ),
          ],
        ),
        if (card.description != null && card.description!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            card.description!,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
        const SizedBox(height: 20),
        _Section(
          eyebrow: AppStrings.sectionSchedule,
          title: _groupsHeading(),
          children: [
            for (final group in detail.groups) _GroupRow(group: group),
            if (detail.groups.isEmpty)
              Text(
                AppStrings.priceOnRequest,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
          ],
        ),
        const SizedBox(height: 20),
        _Section(
          eyebrow: AppStrings.whereEyebrow,
          title: AppStrings.whereHeading,
          children: [
            for (final location in locations) _LocationRow(location: location),
            if (primary == null)
              Text(
                AppStrings.addressClarifying,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
          ],
        ),
        const SizedBox(height: 20),
        _Section(
          title: detail.organization?.name ?? card.orgName ?? '',
          children: [
            if (detail.organization?.phone case final phone?
                when phone.isNotEmpty)
              _Fact(label: AppStrings.labelOrgPhone, value: phone),
            Text(
              verificationLabel(detail.organization?.contactsVerifiedAt),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }

  String _groupsHeading() {
    if (detail.card.isService) return AppStrings.serviceHeading;
    return detail.groups.length > 1
        ? AppStrings.groupsHeading
        : AppStrings.groupHeading;
  }
}

class _Section extends StatelessWidget {
  const _Section({this.eyebrow, required this.title, required this.children});

  final String? eyebrow;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (eyebrow != null) ...[
        Text(
          eyebrow!,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Tokens.accentStrong,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
      ],
      if (title.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Tokens.surface,
          borderRadius: BorderRadius.circular(Tokens.radiusMd),
          border: Border.all(color: Tokens.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    ],
  );
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(label, style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class _GroupRow extends StatelessWidget {
  const _GroupRow({required this.group});

  final ActivityGroup group;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final price =
        groupPriceLabel(group.priceFrom, group.priceTo) ??
        AppStrings.priceOnRequest;
    final schedule = scheduleSummary(group.schedules);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  group.name ?? groupAgeLabel(group.ageFrom, group.ageTo),
                  style: theme.textTheme.titleMedium,
                ),
              ),
              Text(
                '$price${periodSuffix(group.pricePeriod)}',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontSize: Tokens.cardPrice,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (group.ageFrom != null || group.ageTo != null)
            Text(
              groupAgeLabel(group.ageFrom, group.ageTo),
              style: theme.textTheme.bodySmall,
            ),
          if (schedule.isNotEmpty)
            Text(schedule, style: theme.textTheme.bodyMedium),
          if (group.seats case final seats? when seats > 0)
            Text(
              '$seats ${seatsWord(seats)}',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class _LocationRow extends StatelessWidget {
  const _LocationRow({required this.location});

  final LocationPoint location;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          location.name ?? location.address ?? '',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text(
          addressLine(
            city: location.city,
            district: location.district,
            address: location.address,
          ),
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: Tokens.muted),
        ),
        if (location.phone case final phone? when phone.isNotEmpty)
          Text(phone, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}
