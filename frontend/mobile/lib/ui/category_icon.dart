import 'package:flutter/material.dart';

/// Иконка направления по каноническому имени из `categories.icon`.
///
/// Сервер (`GET /api/v1/categories`) присылает короткие имена (`palette`,
/// `dumbbell`, `graduation-cap`, …), а не готовые глифы: клиент не должен
/// рисовать «что попало». Единственное место, где имя превращается в
/// [IconData], — этот файл, поэтому каталогу достаточно передать `icon`.
///
/// Набор имён сверен с живым `:8080/api/v1/categories` и с сидом
/// `database/init.sql` (там же лежат имена, которых в текущей выдаче ещё нет:
/// `ball`, `calendar`, `code`, `dog`, `school`, `tent`, `tool`, …). Плюс
/// синонимы из макета web (`paw-print`, `layout-grid`, `graduation-cap`),
/// чтобы одна и та же категория выглядела одинаково в сайте и приложении.
const Map<String, IconData> categoryIcons = {
  'backpack': Icons.backpack,
  'ball': Icons.sports_soccer,
  'basketball': Icons.sports_basketball,
  'book': Icons.menu_book,
  'brush': Icons.brush,
  'calendar': Icons.calendar_month,
  'camera': Icons.photo_camera,
  'chef': Icons.restaurant,
  'chess': Icons.grid_on,
  'code': Icons.code,
  'compass': Icons.explore,
  'cpu': Icons.memory,
  'cube': Icons.view_in_ar,
  // Отдельной иконки танца в Material нет; `directions_run` уже занят бегом,
  // поэтому танец — «вечер/дискотека», а не дубль лёгкой атлетики.
  'dance': Icons.nightlife,
  'dice': Icons.casino,
  // Иконки собаки в Material нет: `pets` остаётся за лапой/животными, а
  // дрессировка получает отдельный звериный глиф, чтобы не сливаться с `paw`.
  'dog': Icons.cruelty_free,
  'dots': Icons.more_horiz,
  'dumbbell': Icons.fitness_center,
  'fist': Icons.sports_mma,
  'flower': Icons.local_florist,
  'gamepad': Icons.sports_esports,
  'globe': Icons.language,
  'graduation-cap': Icons.school,
  'gym': Icons.accessibility_new,
  'hand': Icons.pan_tool,
  'hands': Icons.volunteer_activism,
  'heart': Icons.favorite,
  'landmark': Icons.account_balance,
  'layout-grid': Icons.grid_view,
  'leaf': Icons.eco,
  'logic': Icons.psychology,
  'map': Icons.map,
  'mountain': Icons.landscape,
  'music': Icons.music_note,
  'nail': Icons.back_hand,
  'palette': Icons.palette,
  // `paw` и `paw-print` — одно и то же в двух клиентах: web пишет `paw-print`,
  // сервер — `paw`. Иконка обязана быть одинаковой, иначе «Природа» на сайте
  // и в приложении выглядит по-разному.
  'paw': Icons.pets,
  'paw-print': Icons.pets,
  'robot': Icons.smart_toy,
  'run': Icons.directions_run,
  'saw': Icons.carpenter,
  'school': Icons.class_,
  'scissors': Icons.content_cut,
  'sigma': Icons.functions,
  'speech': Icons.chat_bubble_outline,
  'tent': Icons.cabin,
  'theater': Icons.theater_comedy,
  'tool': Icons.handyman,
  'truck': Icons.local_shipping,
  'user': Icons.person,
  'users': Icons.groups,
  'volleyball': Icons.sports_volleyball,
  'water': Icons.pool,
  'wrench': Icons.build,
  // Рукоделие/пряжа: ножницы — тот же образ, что у стрижки (`scissors`),
  // но это осознанный синоним «рукоделие = работа с нитью и ножницами».
  'yarn': Icons.content_cut,
  'yoga': Icons.self_improvement,
};

/// Осознанный запасной вариант для имени, которого нет в [categoryIcons]:
/// пустой `icon` в ответе, новый слага сервера или чужая категория. На
/// канонических именах не срабатывает — это закреплено тестом.
const IconData categoryIconFallback = Icons.category_outlined;

/// Иконка для `CategoryNode.icon`. Принимает и `null`: сервер вправе не
/// прислать поле, и это не должно ронять список.
IconData categoryIconData(String? name) =>
    categoryIcons[name?.trim().toLowerCase()] ?? categoryIconFallback;

/// Готовая иконка-виджет: размер и цвет задаются в одном месте, чтобы чипы
/// каталога не повторяли `Icon(categoryIconData(...))`.
class CategoryIcon extends StatelessWidget {
  const CategoryIcon({super.key, this.name, this.size = 18, this.color});

  final String? name;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) =>
      Icon(categoryIconData(name), size: size, color: color);
}
