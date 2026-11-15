import 'package:flutter/material.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../data/models/activity.dart';
import '../../domain/format.dart';
import '../../domain/price.dart';

/// Карточка занятия в списке — ТЗ §3.2: обложка, название, организация,
/// короткий адрес раскрытой точки, возраст и цена раскрытой группы, счётчик
/// групп, дата проверки.
///
/// Сердечко избранного здесь сознательно не стоит: эндпоинтов
/// `GET/POST /me/favorites` на сервере ещё нет, а некликабельная иконка —
/// это обещание интерфейса, которое приёмка §15 не пропустит.
class ActivityTile extends StatelessWidget {
  const ActivityTile({super.key, required this.item, this.onTap});

  final ActivityListItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final price = priceLabel([item.price, item.priceTo]);
    final address = addressLine(
      city: _nullIfEmpty(item.city),
      district: item.district,
      address: item.address,
    );
    final extraLocations = (item.locationsCount ?? 1) - 1;

    return Material(
      color: Tokens.surface,
      borderRadius: BorderRadius.circular(Tokens.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Tokens.radiusMd),
            border: Border.all(color: Tokens.line),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _Cover(),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: theme.textTheme.titleMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.orgName != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.orgName!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: Tokens.cardAction,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      address,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontSize: 12,
                        color: Tokens.muted,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (extraLocations > 0)
                      Text(
                        'ещё $extraLocations ${addressWord(extraLocations)}',
                        style: theme.textTheme.bodySmall,
                      ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          price,
                          // Красный для цены не используется — ТЗ §10.3.
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontSize: Tokens.cardPrice,
                            color: Tokens.ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (item.groupName != null)
                          _Tag(label: item.groupName!),
                        if ((item.groupsCount ?? 0) > 0)
                          _Tag(
                            label:
                                '${item.groupsCount} ${groupWord(item.groupsCount!)}',
                          ),
                        _Tag(label: item.isService ? 'услуга' : 'занятие'),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _verificationText(item),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Список агрегирует только флаг `verified`, даты проверки в нём нет —
  /// это зафиксированный вопрос координатору, а не решение по умолчанию.
  String _verificationText(ActivityListItem item) => (item.verified ?? false)
      ? AppStrings.verifiedPrefix
      : AppStrings.tentativeData;

  static String? _nullIfEmpty(String? value) =>
      (value == null || value.isEmpty) ? null : value;
}

class _Cover extends StatelessWidget {
  const _Cover();

  @override
  Widget build(BuildContext context) => ClipRRect(
    // Медиа-хост ещё не согласован (вопрос координатору), поэтому обложку
    // не тянем по относительному пути из БД — показываем штатное «Фото нет».
    borderRadius: BorderRadius.circular(Tokens.radiusSm),
    child: Container(
      width: 96,
      height: 84,
      color: Tokens.surfacePurple,
      alignment: Alignment.center,
      child: Text(
        AppStrings.noPhoto,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    ),
  );
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: Tokens.accentWash,
      borderRadius: BorderRadius.circular(Tokens.radiusPill),
    ),
    child: Text(label, style: Theme.of(context).textTheme.bodySmall),
  );
}
