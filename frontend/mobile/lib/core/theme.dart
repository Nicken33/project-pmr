import 'package:flutter/material.dart';

/// Значения перенесены дословно из `:root` в web/src/app/globals.css
/// ( read-only источник, 4 ноября 2026) — ТЗ §10.16 требует один визуальный
/// язык у сайта и приложения. Классы не копируем: переносим только значения
/// в ThemeData, как договорились с координатором.
class Tokens {
  const Tokens._();

  static const Color bg = Color(0xFFF6F2FF);
  static const Color bgDeep = Color(0xFFEFE8FF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceSoft = Color(0xFFFBF9FF);
  static const Color surfacePurple = Color(0xFFF3EDFF);
  static const Color accent = Color(0xFF6D48DB);
  static const Color accentStrong = Color(0xFF5A35C9);
  static const Color accentLight = Color(0xFF8F6DF1);
  static const Color accentSoft = Color(0xFFEEE7FF);
  static const Color accentWash = Color(0xFFF7F1FF);
  static const Color ink = Color(0xFF201B3D);
  static const Color inkSoft = Color(0xFF353052);
  static const Color muted = Color(0xFF625E78);
  static const Color mutedLight = Color(0xFF85819A);
  static const Color line = Color(0xFFEAE4F8);
  static const Color lineStrong = Color(0xFFDED5F3);
  static const Color success = Color(0xFF169B6B);
  static const Color successSoft = Color(0xFFE7F8F1);

  /// Предупреждение и danger нужны для статусов анкеты и жалоб (§3.8, §3.9);
  /// для цены красный не используется вообще — ТЗ §10.3.
  static const Color warning = Color(0xFFB56B00);
  static const Color warningSoft = Color(0xFFFFF4D8);
  static const Color danger = Color(0xFFE23B3B);
  static const Color dangerSoft = Color(0xFFFFEDED);

  static const double radiusXs = 8;
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 18;
  static const double radiusXl = 22;
  static const double radiusPill = 999;

  /// --tap: зона нажатия 44×44 — ТЗ §10.6 п.6, обязательна и для приложения.
  static const double tap = 44;

  /// Шкала карточек после подъёма с 7–9 px (решение владельца, 4 ноября):
  /// заголовок 14/16, цена 13–14, подпись действия 11–12, тег 8–9.
  static const double cardTitle = 14;
  static const double cardTitleStrong = 16;
  static const double cardPrice = 13;
  static const double cardAction = 11;
  static const double cardTag = 9;

  /// Поля ввода на мобильных — не мельче 16 px (§3.5 п.5, §15.6 п.6).
  static const double inputFont = 16;
}

class AppTheme {
  const AppTheme._();

  static ThemeData get mobile {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: Tokens.accent,
      onPrimary: Colors.white,
      primaryContainer: Tokens.accentSoft,
      onPrimaryContainer: Tokens.ink,
      secondary: Tokens.accentLight,
      onSecondary: Colors.white,
      surface: Tokens.surface,
      onSurface: Tokens.ink,
      surfaceContainerLowest: Tokens.surfaceSoft,
      surfaceContainerLow: Tokens.bg,
      error: Tokens.danger,
      onError: Colors.white,
      outline: Tokens.lineStrong,
      outlineVariant: Tokens.line,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: Tokens.bg,
      splashFactory: InkSparkle.splashFactory,
    );

    return base.copyWith(
      textTheme: base.textTheme
          .apply(bodyColor: Tokens.ink, displayColor: Tokens.ink)
          .copyWith(
            // Текст в поле ввода — 16 px (§3.5 п.5): меньше — и фокус зумит экран.
            bodyLarge: base.textTheme.bodyLarge?.copyWith(
              fontSize: Tokens.inputFont,
              color: Tokens.ink,
            ),
            titleLarge: base.textTheme.titleLarge?.copyWith(
              fontSize: Tokens.cardTitleStrong,
              fontWeight: FontWeight.w700,
              height: 1.25,
            ),
            titleMedium: base.textTheme.titleMedium?.copyWith(
              fontSize: Tokens.cardTitle,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
            bodyMedium: base.textTheme.bodyMedium?.copyWith(
              fontSize: 13,
              color: Tokens.inkSoft,
              height: 1.45,
            ),
            bodySmall: base.textTheme.bodySmall?.copyWith(
              fontSize: Tokens.cardTag,
              color: Tokens.muted,
              height: 1.4,
            ),
            labelLarge: base.textTheme.labelLarge?.copyWith(
              fontSize: Tokens.cardAction,
              fontWeight: FontWeight.w600,
              color: Tokens.accentStrong,
            ),
          ),
      // Кнопка: минимальная зона 44 px по высоте, как требует §10.6 п.6.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, Tokens.tap),
          backgroundColor: Tokens.accent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Tokens.radiusSm),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, Tokens.tap),
          foregroundColor: Tokens.accentStrong,
          side: const BorderSide(color: Tokens.lineStrong),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Tokens.radiusSm),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(0, Tokens.tap),
          foregroundColor: Tokens.accentStrong,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Tokens.surfaceSoft,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        hintStyle: base.textTheme.bodyMedium?.copyWith(
          color: Tokens.mutedLight,
          fontSize: Tokens.inputFont,
        ),
        // 16 px в поле — иначе при фокусе экран зумит (§3.5 п.5).
        labelStyle: base.textTheme.bodyMedium?.copyWith(
          fontSize: Tokens.inputFont,
        ),
        enabledBorder: _inputBorder(Tokens.lineStrong),
        focusedBorder: _inputBorder(Tokens.accent),
        errorBorder: _inputBorder(Tokens.danger),
        focusedErrorBorder: _inputBorder(Tokens.danger),
      ),
    );
  }

  static OutlineInputBorder _inputBorder(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(Tokens.radiusSm),
    borderSide: BorderSide(color: color, width: 1),
  );
}
