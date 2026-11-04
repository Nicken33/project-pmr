import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  BookOpen,
  ClipboardCheck,
  Clock3,
  Globe2,
  Info,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Scale,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  LegalLayout,
  LegalList,
  LegalNotice,
  LegalPoint,
  LegalSection,
  LegalStat,
  LegalStep,
  LegalSteps,
} from "@/components/legal/LegalLayout";
import { readView } from "@/lib/session";
import styles from "@/components/legal/legal.module.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "О проекте",
  description:
    "Talentro — неофициальный каталог занятий и услуг Приднестровья, сделанный для конкурса. Кто мы, откуда данные, как они проверяются и куда писать по претензиям.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  // Проценты наполнения — план, а не факт о каталоге: анониму их не показываем (§6).
  const { mode } = await readView();
  const demo = mode === "demo";
  return (
    <LegalLayout
      eyebrow="О проекте"
      title="Что такое Talentro и откуда здесь данные"
      lead="Каталог секций, кружков, студий и услуг Приднестровья. Мы собрали то, что и так лежит на сайтах учреждений, в соцсетях и у самих организаций, и привели к одному виду, чтобы было понятно за пару минут."
      current="/about"
      chips={
        <>
          <span className={cn("badge", "badge--warning", styles.bigBadge)}>
            <Info size={13} /> Неофициальный каталог
          </span>
          <span className={cn("badge", "badge--category", styles.bigBadge)}>
            <Sparkles size={13} /> Сделан для конкурса
          </span>
          <Link href="/request" className={cn("badge", "badge--verified", styles.bigBadge)}>
            <Mail size={13} /> Правки и заявки — через форму
          </Link>
        </>
      }
    >
      <LegalSection
        icon={ShieldCheck}
        kicker="Дисклеймер"
        title="Коротко и по-честному"
        hint="Прямым текстом"
      >
        <div className={styles.disclaimer}>
          <LegalList>
            <LegalPoint icon={Ban} title="Мы не сайт этих организаций">
              Talentro — неофициальный каталог, собранный командой для конкурса. Мы не
              представляем перечисленные здесь школы, студии и мастеров и не действуем от их
              имени.
            </LegalPoint>
            <LegalPoint icon={BookOpen} title="Откуда данные">
              Из открытых источников и от самих организаций: сайт учреждения, страница в
              соцсетях, звонок в приёмную, анкета из кабинета. Описание пересказано своими
              словами, а не скопировано.
            </LegalPoint>
            <LegalPoint icon={BadgeCheck} title="Про актуальность">
              Данные верны на дату проверки — она стоит в каждой карточке. Если до человека
              не дозвонились, карточка честно помечена как ориентировочная.
            </LegalPoint>
            <LegalPoint icon={Mail} title="По претензиям">
              Не согласны с записью — скажите через{" "}
              <Link href="/request">форму заявки</Link>, и мы поправим или уберём её.
              Публичной почты и телефона у проекта нет: они не подтверждены, а
              неподтверждённый контакт выглядит как настоящий.
            </LegalPoint>
          </LegalList>
          <p className={styles.text}>
            Юриста у нас нет, поэтому мы держимся простых границ: не публикуем чужие
            логотипы и товарные знаки, чужие тексты слово в слово и чужие персональные
            данные. Всё это записано в{" "}
            <Link href="/rules">правилах публикации</Link>, а про данные — в{" "}
            <Link href="/privacy">обработке данных</Link>.
          </p>
          <div className={styles.actions}>
            <Link className="btn btn--primary btn--lg" href="/request">
              <Mail size={17} /> Оставить заявку
            </Link>
            <Link className="btn btn--outline btn--lg" href="/privacy">
              <ShieldCheck size={17} /> Обработка данных
            </Link>
          </div>
        </div>
      </LegalSection>

      <LegalSection
        icon={Search}
        kicker="Зачем"
        title="Одна страница вместо пяти источников"
        hint="Проблема и решение"
      >
        <p className={styles.text}>
          В Приднестровье нет места, где родитель или подросток за пару минут понимает, что
          рядом с домом есть из кружков и секций: где занимается ребёнок, сколько это стоит,
          на какой возраст, когда и как связаться. Половина этих сведений живёт на сайтах
          учреждений, половина — в соцсетях, часть не опубликована вообще. И актуальность
          никто не проверяет.
        </p>
        <LegalList tone="ok" columns>
          <LegalPoint icon={Search} title="Найти">
            Поиск и фильтры по городу, району, возрасту, цене, формату и дню недели. Фильтры
            живут в ссылке, чтобы ею можно было поделиться.
          </LegalPoint>
          <LegalPoint icon={MapPin} title="Понять, далеко ли">
            Адрес всегда с районом и городом, метка на карте, рядом — ближайшая точка
            проведения.
          </LegalPoint>
          <LegalPoint icon={Users} title="Сравнить группы">
            Возраст, цена, расписание и свободные места — по каждой группе отдельно, не в
            одну строку.
          </LegalPoint>
          <LegalPoint icon={Phone} title="Сразу позвонить">
            «Позвонить» — самое заметное действие в карточке. Без него экран не считается
            готовым.
          </LegalPoint>
        </LegalList>
        <LegalNotice icon={ClipboardCheck} title="Анкету ведёт тот, кому она нужна">
          Занятие добавляет сама организация или мастер в кабинете, команда проверяет и
          публикует. Поэтому в каталог попадает то, что человек готов подтвердить.
        </LegalNotice>
      </LegalSection>

      <LegalSection
        icon={ClipboardCheck}
        kicker="Как проверяем"
        title="Каждую запись можно показать пальцем"
        hint="Срок ответа — 2 рабочих дня"
      >
        <LegalSteps>
          <LegalStep index={1} title="У записи есть источник" pill="обязательно">
            Сайт, звонок, соцсети или лично. Без источника запись в каталог не идёт — это
            проверяется запросом к базе, а не глазами.
          </LegalStep>
          <LegalStep index={2} title="Есть дата проверки" pill="видна в карточке">
            Подтвердили звонком — пишем дату: «данные проверены 12.11.2026». Не дозвонились —
            поле пустое, и на экране висит плашка «данные ориентировочные».
          </LegalStep>
          <LegalStep index={3} title="Пустое поле лучше догадки" pill="честно">
            Цен «договорная», возрастов «примерно» и расписаний «по договорённости» у нас не
            бывает. Лучше ничего, чем правдоподобная выдумка.
          </LegalStep>
          <LegalStep index={4} title="Спор покрывает жалоба" pill="2 рабочих дня">
            В карточке есть кнопка «Пожаловаться / данные устарели». Заявка попадает в журнал
            модерации, ответ приходит в течение 2 рабочих дней.
          </LegalStep>
          <LegalStep index={5} title="Раз в 90 дней — новый звонок" pill="свежесть">
            Записи старше 90 дней мы не чиним молча: их перепроверяют звонком и только потом
            меняют.
          </LegalStep>
        </LegalSteps>
        <LegalNotice icon={Clock3} tone="warn" title="Неточность дороже отсутствия записи">
          Если секция закрылась, а мы зовём — это уже не безобидная ошибка, а претензия к
          нам. Поэтому поля «источник» и «дата проверки» есть у каждой опубликованной
          карточки.
        </LegalNotice>
      </LegalSection>

      <LegalSection
        icon={Ban}
        kicker="Чего в данных не бывает"
        title="Формулировки, которые мы не публикуем"
      >
        <LegalList tone="no" columns>
          <LegalPoint title="Цена «договорная»">
            Либо сумма с периодом, либо пустое поле. «Уточнить на месте» — не цена.
          </LegalPoint>
          <LegalPoint title="Возраст «примерно»">
            Диапазон в годах, без звёздочек и размытых границ.
          </LegalPoint>
          <LegalPoint title="Расписание «по договорённости»">
            Дни и часы существуют или их нет. Выдуманные строки не пишем.
          </LegalPoint>
          <LegalPoint title="Адрес «центр города»">
            Адрес всегда с районом и городом; «Балка / центр» адресом не считается.
          </LegalPoint>
          <LegalPoint title="Рейтинг без голосов">
            Оценок и отзывов в API нет: шкала одна — «плюс» и «минус», счётчик
            голосов показываем только там, где голоса действительно есть.
          </LegalPoint>
          <LegalPoint title="Телефон «уточнить»">
            Кликабельный номер либо пустое поле.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Landmark}
        kicker="Объём и покрытие"
        title="Правила наполнения каталога"
        hint="Чтобы не один город"
      >
        <p className={styles.text}>
          Каталог нужен не только тем, кто живёт в Тирасполе. Поэтому у наполнения есть
          измеримые правила — они проверяются тем же запросом, что и остальные данные.
        </p>
        {demo ? (
          <div className={cn("factGrid", styles.statGrid)}>
            <LegalStat icon={MapPin} label="Тирасполь" value="не больше 70% карточек" />
            <LegalStat icon={Sparkles} label="Услуги" value="каждая пятая запись" />
            <LegalStat icon={Globe2} label="Координаты" value="у 100% точек" />
            <LegalStat icon={BadgeCheck} label="Фото" value="минимум у 80% занятий" />
          </div>
        ) : (
          <LegalNotice
            icon={Info}
            tone="warn"
            title="Честнее показать покрытие, чем обещать проценты"
          >
            Правила наполнения из техзадания — план, а не факт о текущем каталоге:
            сколько карточек, услуг, координат и фотографий лежит в базе, видно по
            самому каталогу. Пустое поле в карточке означает, что данных нет.
          </LegalNotice>
        )}
        <p className={styles.note}>
          Это правила наполнения, а не красивые цифры: если данных нет, поле остаётся
          пустым, а вместо фото — аккуратная заглушка с направлением.
        </p>
      </LegalSection>

      <LegalSection
        icon={Scale}
        kicker="Основание публикации"
        title="Без разрешения запись в каталог не идёт"
      >
        <LegalList columns>
          <LegalPoint icon={Landmark} title="Организация">
            Открытый источник: ссылка на сайт учреждения, страницу в соцсетях или звонок в
            приёмную. Согласия на то, что мы указали название, адрес и часы, не нужно — это
            открытые сведения о хозяйствующем субъекте.
          </LegalPoint>
          <LegalPoint icon={Users} title="Частный мастер">
            Его анкета из кабинета или подтверждение по телефону: «разрешает опубликовать имя
            и телефон», с датой. Для мастера имя и телефон — персональные данные, подробнее
            об этом — в <Link href="/privacy">обработке данных</Link>.
          </LegalPoint>
        </LegalList>
        <p className={styles.text}>
          Дубли мы сводим: одна организация с двумя написаниями названия — это дубль. А
          второй адрес той же организации — не дубль: это точка проведения, карточка при этом
          остаётся одна.
        </p>
      </LegalSection>

      <LegalSection icon={MapPin} kicker="Карта" title="Мы на OpenStreetMap">
        <p className={styles.text}>
          Тайлы карты берём у OpenStreetMap по лицензии ODbL — она просит указывать источник.
          Поэтому на карте и внизу сайта стоит «© OpenStreetMap contributors». Google Maps не
          используем: своих ключей и квот не нужно, а данные остаются открытыми. Ссылку на
          условия лицензии держим и здесь.
        </p>
        <div className={styles.actions}>
          <a
            className="btn btn--outline btn--lg"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe2 size={17} /> © OpenStreetMap contributors
            <ArrowRight size={15} />
          </a>
          <Link className="btn btn--soft btn--lg" href="/map">
            <MapPin size={17} /> Открыть карту
          </Link>
        </div>
      </LegalSection>

      <LegalSection
        icon={Smartphone}
        kicker="Где открыть"
        title="Сайт, приложение и одно и то же на iPhone"
      >
        <LegalList columns>
          <LegalPoint icon={Smartphone} title="Ставится на телефон как приложение">
            Talentro работает как PWA: манифест, иконки, офлайн-кэш последнего списка и
            карточек, экран «нет сети». На Android ставится из Chrome, на iPhone — через
            Safari, «Добавить на экран Домой».
          </LegalPoint>
          <LegalPoint icon={Ban} title="Приложения на iPhone мы не делаем">
            Ни TestFlight, ни симулятор, ни сборки. Владелец iPhone получает тот же продукт в
            браузере: каталог, фильтры, карточку, «Позвонить». Push-уведомления в iOS-версии
            PWA не обещаем.
          </LegalPoint>
        </LegalList>
        <p className={styles.note}>
          Сайт и приложение выглядят как один продукт: те же категории, те же подписи полей,
          те же состояния экранов. Отличается только навигация — табы вместо шапки.
        </p>
      </LegalSection>

      <LegalSection icon={Info} kicker="Команда" title="Кто это делает и чего у нас нет">
        <p className={styles.text}>
          Нас небольшая команда: капитан, аналитик, дизайнер, фронтенд, бэкенд, база, QA и
          DevOps — каждый отвечает за свой кусок. Каталог делает не робот: анкету создаёт
          организация или мастер, <Link href="/rules">проверяет и публикует модератор</Link>,
          а тексты владельцев модератор не редактирует.
        </p>
        <p className={styles.text}>
          Что считать важным, мы решали не по вкусу: приоритеты и формулировки взяты из
          онлайн-опросов детей и родителей, а пустые поисковые запросы уходят в план
          наполнения. Искали и не нашли — <Link href="/request">оставьте заявку</Link>{" "}
          «не нашли занятие».
        </p>
        <LegalNotice icon={Wallet} title="Мы не берём деньги">
          Talentro ничего не продаёт и не принимает оплату: ни за занятие, ни за отзыв, ни за
          размещение в каталоге. Все договорённости — напрямую с организацией, а наличие мест
          лучше уточнить звонком.
        </LegalNotice>
      </LegalSection>
    </LegalLayout>
  );
}
