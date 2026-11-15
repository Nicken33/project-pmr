import 'json.dart';

/// Элемент `photos[]`, `videos[]` и `locations[].photos`.
///
/// Форма снята с живого ответа `tiraspol-studiya-palitra` и совпадает с
/// контрактом: `{path, caption, source_url, author, order_num}`. `source_url` и
/// `author` — требования ТЗ §14 к источнику и правообладателю, на стенде они
/// `null`.
class MediaItem {
  const MediaItem({
    required this.path,
    this.caption,
    this.sourceUrl,
    this.author,
    this.orderNum,
  });

  /// Относительный путь из базы: полный адрес собирает вызывающий, абсолютных
  /// URL в базе нет. Медиа-хост (домен, отдающий `infra/`) ещё не согласован,
  /// поэтому сетку картинок приложение не тянет — см. README, вопрос 5.
  final String path;
  final String? caption;
  final String? sourceUrl;
  final String? author;

  /// Порядок в галерее (§8 табл. 5).
  final int? orderNum;

  factory MediaItem.fromJson(Map<String, dynamic> json) => MediaItem(
    path: asString(json['path']) ?? '',
    caption: asString(json['caption']),
    sourceUrl: asString(json['source_url']),
    author: asString(json['author']),
    orderNum: asInt(json['order_num']),
  );
}

/// Список медиа. Контракт обещает пустой массив, а не `null`, но снимок до
/// правки сервера приносил `photos: null` у точки без фото — оба варианта
/// значат «медиа нет», и клиент не падает ни на одном.
List<MediaItem> mediaList(Object? value) =>
    asMapList(value).map(MediaItem.fromJson).toList();
