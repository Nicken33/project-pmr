import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/core/theme.dart';

void main() {
  group('требования приёмки §10.6 и §15.6 в цифрах', () {
    test('зона нажатия — 44 px', () {
      expect(Tokens.tap, 44);

      final theme = AppTheme.mobile;
      const states = <WidgetState>{};
      expect(
        theme.filledButtonTheme.style!.minimumSize!.resolve(states),
        const Size(0, 44),
      );
      expect(
        theme.outlinedButtonTheme.style!.minimumSize!.resolve(states),
        const Size(0, 44),
      );
      expect(
        theme.textButtonTheme.style!.minimumSize!.resolve(states),
        const Size(0, 44),
      );
    });

    test('кегль в карточках лежит в шкале 9–14 px, заголовок — 16', () {
      expect(Tokens.cardTag, 9);
      expect(Tokens.cardAction, 11);
      expect(Tokens.cardPrice, 13);
      expect(Tokens.cardTitle, 14);
      expect(Tokens.cardTitleStrong, 16);
    });

    test('в поле ввода шрифт не мельче 16 px — иначе фокус зумит экран', () {
      final theme = AppTheme.mobile;

      expect(Tokens.inputFont, greaterThanOrEqualTo(16));
      expect(
        theme.inputDecorationTheme.hintStyle?.fontSize,
        greaterThanOrEqualTo(16),
      );
      expect(theme.textTheme.bodyLarge?.fontSize, greaterThanOrEqualTo(16));
    });

    test('цена не используется красным (§10.3)', () {
      final theme = AppTheme.mobile;
      expect(theme.textTheme.titleMedium?.color, isNot(Tokens.danger));
    });
  });

  group('значение токенов перенесено из web/src/app/globals.css', () {
    test('акцент и фон совпадают с CSS-переменными :root', () {
      expect(Tokens.accent, const Color(0xFF6D48DB)); // --accent
      expect(Tokens.bg, const Color(0xFFF6F2FF)); // --bg
      expect(Tokens.ink, const Color(0xFF201B3D)); // --ink
      expect(Tokens.line, const Color(0xFFEAE4F8)); // --line
      expect(Tokens.radiusMd, 14); // --radius-md
    });
  });
}
