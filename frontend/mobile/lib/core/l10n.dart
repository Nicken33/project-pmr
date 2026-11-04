/// Строки интерфейса. Скопированы дословно из web-клиента (read-only,
/// 4 ноября 2026), потому что ТЗ требует: «Приложение и сайт выглядят как один
/// продукт: те же категории, те же подписи полей, те же состояния» (§10.16).
///
/// Источник каждой группы — в комментариях к блокам. Менять формулировки здесь
/// можно только вместе с web, иначе приёмка §15 разойдётся по клиентам.
class AppStrings {
  const AppStrings._();

  // Каталог — web/src/components/catalog/CatalogClient.tsx
  static const String found = 'Найдено';
  static const String catalogLoadFailed = 'Каталог не загрузился';
  static const String loadFailedHint =
      'Данные могли не дойти — попробуйте ещё раз.';
  static const String retry = 'Повторить';
  static const String leaveRequest = 'Оставить заявку';
  static const String emptyTitle = 'Пока ничего не нашлось';
  static const String emptyHint =
      'Попробуйте убрать один из фильтров или расширить географию. '
      'Если занятия действительно нет — оставьте заявку, и мы поищем вместе.';
  static const String resetAll = 'Сбросить всё';
  static const String showMore = 'Показать ещё';
  static const String loadingMore = 'Загружаем…';
  static const String shownOf = 'Показано';

  // Карточка в списке — web/src/components/catalog/ActivityCard.tsx, lib/api-server.ts
  static const String noPhoto = 'Фото нет';
  static const String addressClarifying = 'Адрес уточняется';
  static const String priceNotSpecified = 'Цена не указана';

  // Голоса и цена — web/src/lib/utils.ts, ТЗ §10.2 и §10.3
  static const String noVotes = 'голосов нет';
  static const String free = 'Бесплатно';
  static const String currency = 'руб. ПМР';

  // Проверка данных — ТЗ §3.3.11, §10.5; web: app/about/page.tsx
  static const String verifiedPrefix = 'данные проверены';
  static const String tentativeData = 'данные ориентировочные';

  // Ошибки транспорта. Конверт сервера: {error: {code, message, fields}},
  // 400 «проверь поля», 401 «нужен вход», 403 «нет прав», 429 «слишком часто» (§9.3).
  static const String networkError = 'Сервер не отвечает';
  static const String unexpectedAnswer = 'Неожиданный ответ сервера';

  // Карточка занятия — web/src/components/activity/ActivityDetail.tsx
  static const String sectionSchedule = 'Расписание и стоимость';
  static const String groupsHeading = 'Группы';
  static const String groupHeading = 'Группа и расписание';
  static const String serviceHeading = 'Услуга и запись';
  static const String aboutHeading = 'О занятии';
  static const String whereHeading = 'Расположение';
  static const String whereEyebrow = 'Где заниматься';
  static const String labelWhere = 'Где оказывается';
  static const String labelAge = 'Возраст';
  static const String labelFormat = 'Формат';
  static const String labelType = 'Тип';
  static const String labelAddresses = 'Адреса';
  static const String labelPrice = 'Стоимость';
  static const String labelOrgPhone = 'Телефон организации';
  static const String call = 'Позвонить';
  // web/src/app/activities/[slug]/page.tsx:35 — заголовок отсутствующей карточки.
  static const String activityNotFound = 'Занятие не найдено';
  static const String ageClarifying = 'Возраст уточняется';
  static const String forWholeFamily = 'Для всей семьи';
  static const String priceOnRequest = 'Цена по запросу';
  static const String formatOnline = 'Онлайн';
  static const String formatBoth = 'Офлайн и онлайн';
  static const String formatOffline = 'Офлайн';
  static const String typeIndividual = 'Индивидуально';
  static const String typeBoth = 'Группы и индивидуально';
  static const String typeGroup = 'Групповые занятия';
  static const String typeService = 'Услуга по записи';

  // §9.3 — подписи кодов ошибок.
  static const String checkFields = 'проверь поля';
}
