import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talentro_mobile/ui/category_icon.dart';

/// Полный набор имён поля `categories.icon`.
///
/// Объединение трёх источников, чтобы ни одно каноническое имя не осталось на
/// заглушке:
/// * живой `GET /api/v1/categories` (`palette`, `brush`, `dumbbell`,
///   `graduation-cap`, `layout-grid`, …);
/// * сид `database/init.sql` — там есть имена, которых в текущей выдаче нет
///   (`ball`, `calendar`, `code`, `compass`, `dog`, `school`, `tent`, `tool`);
/// * макет web/`CategoryIcon` (`paw-print` вместо серверного `paw`,
///   `layout-grid` для «Другого»).
const List<String> canonicalCategoryIcons = [
  'backpack',
  'ball',
  'basketball',
  'book',
  'brush',
  'calendar',
  'camera',
  'chef',
  'chess',
  'code',
  'compass',
  'cpu',
  'cube',
  'dance',
  'dice',
  'dog',
  'dots',
  'dumbbell',
  'fist',
  'flower',
  'gamepad',
  'globe',
  'graduation-cap',
  'gym',
  'hand',
  'hands',
  'heart',
  'landmark',
  'layout-grid',
  'leaf',
  'logic',
  'map',
  'mountain',
  'music',
  'nail',
  'palette',
  'paw',
  'paw-print',
  'robot',
  'run',
  'saw',
  'school',
  'scissors',
  'sigma',
  'speech',
  'tent',
  'theater',
  'tool',
  'truck',
  'user',
  'users',
  'volleyball',
  'water',
  'wrench',
  'yarn',
  'yoga',
];

/// Верхний уровень из плана дизайнера — его видит пользователь в чипах
/// каталога, поэтому заглушка здесь заметнее всего.
const List<String> designTopLevelIcons = [
  'palette',
  'dumbbell',
  'cpu',
  'graduation-cap',
  'paw-print',
  'mountain',
  'wrench',
  'users',
  'layout-grid',
];

/// Имена из снимка ответа сервера: если справочник пополнится, тест начнёт
/// падать раньше, чем пользователь увидит серый ромбик вместо иконки.
List<String> _fixtureIconNames() {
  final raw = File('test/fixtures/api/categories.json').readAsStringSync();
  final tree = jsonDecode(raw) as List<dynamic>;
  final names = <String>{};

  void walk(List<dynamic> nodes) {
    for (final node in nodes.cast<Map<String, dynamic>>()) {
      final icon = node['icon'];
      if (icon is String && icon.isNotEmpty) names.add(icon);
      walk((node['children'] as List<dynamic>?) ?? const []);
    }
  }

  walk(tree);
  return names.toList()..sort();
}

void main() {
  group('Маппинг иконок направлений', () {
    test('каждое каноническое имя даёт свою иконку, а не заглушку', () {
      for (final name in canonicalCategoryIcons) {
        expect(
          categoryIconData(name),
          isNot(categoryIconFallback),
          reason: 'Для канонического "$name" не задана осмысленная иконка',
        );
      }
    });

    test('верхний уровень плана дизайнера покрыт', () {
      for (final name in designTopLevelIcons) {
        expect(
          categoryIconData(name),
          isNot(categoryIconFallback),
          reason: 'Верхний уровень "$name" остался без иконки',
        );
      }
    });

    test('имена из ответа сервера покрыты', () {
      final names = _fixtureIconNames();
      expect(names, isNotEmpty);
      for (final name in names) {
        expect(
          categoryIconData(name),
          isNot(categoryIconFallback),
          reason: 'Сервер прислал "$name", которого нет в маппинге',
        );
      }
    });

    test('неизвестное имя — осознанная заглушка, а не исключение', () {
      expect(categoryIconData('no-such-icon'), Icons.category_outlined);
      expect(categoryIconData(null), Icons.category_outlined);
      expect(categoryIconData(''), Icons.category_outlined);
    });

    test('маппинг не схлопнут в одну иконку-заглушку', () {
      final unique = canonicalCategoryIcons.map(categoryIconData).toSet();
      // Разрешены только две осознанные пары синонимов:
      // paw/paw-print (одна лапа в двух клиентах) и yarn/scissors (ножницы).
      expect(unique, hasLength(canonicalCategoryIcons.length - 2));
    });
  });
}
