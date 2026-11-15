import 'package:flutter/material.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';

/// Три состояния списка из ТЗ §3.1.9 и §3.1.8: скелетон (не «крутилка на
/// пол-экрана»), ошибка сети с «Повторить» и пустой результат со сбросом.
/// Ошибка и «ничего не нашлось» — разные экраны: путать их нельзя, иначе
/// недоступный сервер выглядит как пустой каталог.

class CatalogSkeleton extends StatelessWidget {
  const CatalogSkeleton({super.key, this.count = 5});

  final int count;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < count; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: 132,
            decoration: BoxDecoration(
              color: Tokens.surface,
              borderRadius: BorderRadius.circular(Tokens.radiusMd),
              border: Border.all(color: Tokens.line),
            ),
          ),
        ),
    ],
  );
}

class CatalogErrorView extends StatelessWidget {
  const CatalogErrorView({
    super.key,
    required this.message,
    required this.onRetry,
    this.onRequest,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onRequest;

  @override
  Widget build(BuildContext context) => StatePanel(
    icon: const Icon(Icons.wifi_off_outlined, size: 30),
    title: AppStrings.catalogLoadFailed,
    // Формат — web: «{ошибка}. Данные могли не дойти — попробуйте ещё раз.»
    message: '$message. ${AppStrings.loadFailedHint}',
    actions: [
      FilledButton(onPressed: onRetry, child: const Text(AppStrings.retry)),
      if (onRequest != null)
        OutlinedButton(
          onPressed: onRequest,
          child: const Text(AppStrings.leaveRequest),
        ),
    ],
  );
}

class CatalogEmptyView extends StatelessWidget {
  const CatalogEmptyView({
    super.key,
    required this.onReset,
    this.canReset = true,
    this.onRequest,
  });

  final VoidCallback onReset;
  final bool canReset;
  final VoidCallback? onRequest;

  @override
  Widget build(BuildContext context) => StatePanel(
    icon: const Icon(Icons.place_outlined, size: 30),
    title: AppStrings.emptyTitle,
    message: AppStrings.emptyHint,
    actions: [
      if (canReset)
        FilledButton(
          onPressed: onReset,
          child: const Text(AppStrings.resetAll),
        ),
      if (onRequest != null)
        OutlinedButton(
          onPressed: onRequest,
          child: const Text(AppStrings.leaveRequest),
        ),
    ],
  );
}

class StatePanel extends StatelessWidget {
  const StatePanel({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.actions,
  });

  final Icon icon;
  final String title;
  final String message;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Semantics(
    // Ошибка каталога — объявление, как `role="alert"` в web.
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconTheme(
            data: IconThemeData(color: Tokens.muted),
            child: icon,
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: Tokens.muted),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: actions,
          ),
        ],
      ),
    ),
  );
}
