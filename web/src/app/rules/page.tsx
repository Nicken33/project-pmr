import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  BookOpen,
  ClipboardCheck,
  Clock3,
  EyeOff,
  FileClock,
  FileText,
  Flag,
  Hourglass,
  Inbox,
  KeyRound,
  Landmark,
  Layers,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UploadCloud,
  UserCheck,
  Users,
} from "lucide-react";
import {
  LegalLayout,
  LegalList,
  LegalNotice,
  LegalPoint,
  LegalSection,
  LegalStep,
  LegalSteps,
  TEAM_CONTACT_HREF,
} from "@/components/legal/LegalLayout";
import styles from "@/components/legal/legal.module.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Правила публикации",
  description:
    "Что Talentro проверяет перед публикацией анкеты, чего в каталоге не бывает, сколько длится проверка, на каком основании запись снимают и как удалить свой отзыв.",
  alternates: { canonical: "/rules" },
};

export default function RulesPage() {
  return (
    <LegalLayout
      eyebrow="Правила публикации"
      title="Как анкета попадает в каталог и как из него уходит"
      lead="Страница для организаций, частных мастеров и авторов отзывов. Смысл один: мы публикуем только то, что можно показать пальцем — источник, дату проверки и разрешение владельца."
      current="/rules"
      chips={
        <>
          <span className={cn("badge", "badge--verified", styles.bigBadge)}>
            <Clock3 size={13} /> 2 рабочих дня
          </span>
          <span className={cn("badge", "badge--category", styles.bigBadge)}>
            <FileClock size={13} /> Дата проверки в карточке
          </span>
        </>
      }
    >
      <LegalSection
        icon={Inbox}
        kicker="Проверка"
        title="Что происходит с анкетой"
        hint="Очередь «дольше всех ждёт — выше»"
      >
        <LegalSteps>
          <LegalStep index={1} title="Вы заполняете анкету в кабинете">
            Занятие или услуга, возрастные группы, точки проведения, контакты, фото. Форма
            разбита на шаги, черновик сохраняется, обязательные поля помечены.
          </LegalStep>
          <LegalStep index={2} title="Анкета уходит на проверку">
            Статусы три: «на проверке», «опубликовано», «отклонено» — с причиной отказа.
            Свою непубликованную анкету можно снять с публикации или удалить.
          </LegalStep>
          <LegalStep index={3} title="Модератор смотрит карточку целиком">
            Ровно так, как её увидят люди: со всеми группами и всеми адресами. Решение одно на
            карточку — группы и точки по отдельности не модерируются.
          </LegalStep>
          <LegalStep index={4} title="Публиует или отклоняет с комментарием">
            Причина обязательна и берётся из списка типовых, плюс свободный текст.
          </LegalStep>
          <LegalStep index={5} title="Претензия к одному адресу — не повод для отказа">
            Модератор правит его сам в служебных полях — город, район, направление,
            координаты — и публикует остальное. Причину владельцу пишет отдельно.
          </LegalStep>
          <LegalStep index={6} title="Правка группы или точки возвращает на проверку">
            Изменили состав группы или адрес — анкета снова едет к модератору. Тексты
            владельца модератор не правит.
          </LegalStep>
        </LegalSteps>
      </LegalSection>

      <LegalSection
        icon={Hourglass}
        kicker="Сроки"
        title="Сколько ждать ответа"
        hint="Просрочка подсвечивается в очереди"
      >
        <div className={styles.kv}>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Новая анкета или правка</span>
            <span className={styles.kvValue}>2 рабочих дня</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Жалоба «данные устарели»</span>
            <span className={styles.kvValue}>2 рабочих дня</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Жалоба на отзыв или фото</span>
            <span className={styles.kvValue}>
              2 рабочих дня; при подозрении на клевету запись скрыта до разбора
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Просьба «уберите меня из каталога»</span>
            <span className={styles.kvValue}>
              Снятие в тот же день, без объяснения причины и без переспрашивания
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Запись старше 90 дней</span>
            <span className={styles.kvValue}>
              Перепроверяем звонком; молча ничего не «чиним»
            </span>
          </div>
        </div>
        <LegalNotice icon={Scale} title="Все решения остаются в журнале">
          Кто, когда, что опубликовал или скрыл и почему — видно в журнале модерации. Он не
          редактируется, поэтому спорные случаи разбираются по истории, а не по памяти.
        </LegalNotice>
      </LegalSection>

      <LegalSection
        icon={ClipboardCheck}
        kicker="Проверяем"
        title="Что смотрим перед публикацией"
        hint="И глазами, и запросом"
      >
        <LegalList tone="ok" columns>
          <LegalPoint icon={BookOpen} title="Источник">
            Сайт учреждения, соцсети, звонок или «лично». Без источника запись не существует.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Дату проверки">
            Подтверждаем звонком — ставим дату. Не дозвонились — поля нет, и карточка живёт с
            плашкой «данные ориентировочные».
          </LegalPoint>
          <LegalPoint icon={Users} title="Группы">
            У опубликованного занятия минимум одна группа: возраст, цена, дни и часы, свободные
            места — если заявлены.
          </LegalPoint>
          <LegalPoint icon={MapPin} title="Точки проведения">
            Минимум одна точка с адресом, районом, городом и координатами. Второй адрес той же
            организации — не дубль, а точка.
          </LegalPoint>
          <LegalPoint icon={Phone} title="Контакты">
            Телефон организации или точки, мессенджеры, сайт. Всё кликабельное и проверенное
            звонком.
          </LegalPoint>
          <LegalPoint icon={UploadCloud} title="Фото">
            Свои или со свободной лицензией, с автором и лицензией в списке источников. Первое
            фото становится обложкой.
          </LegalPoint>
          <LegalPoint icon={Layers} title="Дубли">
            Одна организация с двумя написаниями названия — дубль, такие сводим вручную при
            импорте.
          </LegalPoint>
          <LegalPoint icon={UserCheck} title="Основание публикации">
            У организации — открытый источник, у частного мастера — его анкета или
            подтверждение звонком.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Ban}
        kicker="Не публикуем"
        title="Чего в каталоге не появится"
        hint="Даже если очень просить"
      >
        <LegalList tone="no" columns>
          <LegalPoint icon={FileText} title="Правдоподобные догадки">
            Цена «договорная», возраст «примерно», расписание «по договорённости», «уточнить на
            месте» вместо телефона, выдуманные дни и часы.
          </LegalPoint>
          <LegalPoint icon={MapPin} title="Адрес без адреса">
            «Балка», «центр города», «напротив рынка» — это не адрес. Нужны улица, район и
            город.
          </LegalPoint>
          <LegalPoint icon={Megaphone} title="Рекламу и продажу">
            Промоакции, ссылки на магазин, переклейки в чужие чаты, один текст на нескольких
            карточках.
          </LegalPoint>
          <LegalPoint icon={EyeOff} title="Персональные данные третьих лиц">
            Домашний адрес, личный мобильный, ФИО тренера без его воли, фотографии детей,
            списки учеников.
          </LegalPoint>
          <LegalPoint icon={BookOpen} title="Чужое как своё">
            Дословные тексты с чужих сайтов, чужие логотипы и товарные знаки, картинки с
            водяными знаками и «найдено в Instagram».
          </LegalPoint>
          <LegalPoint icon={TriangleAlert} title="Пустые списки">
            У опубликованного занятия не бывает нуля групп или нуля адресов — такая карточка
            просто не проходит проверку.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Landmark}
        kicker="Частный мастер"
        title="Мастера — по его собственным словам"
      >
        <LegalNotice icon={ShieldCheck} tone="warn" title="Имя и телефон мастера — его персональные данные">
          Поэтому про него пишем только то, что он сам внёс в кабинете или подтвердил звонком, и
          храним отметку «согласие на публикацию»: дата и кем получено. По первому требованию
          снимаем запись с публикации в тот же день и без переспрашивания. Подробности — в{" "}
          <Link href="/privacy">обработке данных</Link>.
        </LegalNotice>
        <p className={styles.text}>
          Организации в этом смысле проще: название, адрес, телефон приёмной, направление,
          возраст и часы — открытые сведения о хозяйствующем субъекте, которые он сам
          публикует, чтобы к нему приходили. Мы пересказываем их своими словами и даём ссылку
          на источник.
        </p>
      </LegalSection>

      <LegalSection
        icon={Flag}
        kicker="Снятие"
        title="На каком основании запись уходит с публикации"
      >
        <LegalList tone="warn" columns>
          <LegalPoint icon={Mail} title="Просьба владельца">
            Сообщение от организации или мастера — снимаем в тот же день, без объяснения причины.
            Это право, а не одолжение.
          </LegalPoint>
          <LegalPoint icon={Clock3} title="Данные больше не верны">
            Жалоба «это уже не работает» или «занятие закрылось», подтверждённая при
            проверке.
          </LegalPoint>
          <LegalPoint icon={FileText} title="Нечем подтвердить">
            Источник пропал, дозвониться не удалось, а поле пустое — карточка прячется, пока
            не появятся данные.
          </LegalPoint>
          <LegalPoint icon={MessageCircle} title="Отзыв с клеветой">
            Временное скрытие до разбора, ответ за 2 рабочих дня. После разбора запись либо
            возвращается целиком, либо остаётся скрытой.
          </LegalPoint>
          <LegalPoint icon={Ban} title="Нарушение условий пользования">
            Мат, чужие данные, реклама, спам — запись скрыта целиком (см.{" "}
            <Link href="/terms">условия пользования</Link>).
          </LegalPoint>
          <LegalPoint icon={UserCheck} title="Решение самого владельца">
            «Снять с публикации» доступно из кабинета. Удалить уже опубликованную анкету можно
            только через модератора по заявке.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Trash2}
        kicker="Отзывы"
        title="Как удалить свой отзыв"
        hint="Модератор не редактирует чужие тексты"
      >
        <LegalSteps>
          <LegalStep index={1} title="Откройте карточку и найдите свой отзыв">
            Отзывы лежат под блоком групп; если их много — «показать все».
          </LegalStep>
          <LegalStep index={2} title="Нажмите удалить">
            Автор снимает свою запись сам. Вместе с отзывом исчезают прикреплённые вами фото и
            видео и ответы под ним.
          </LegalStep>
          <LegalStep index={3} title="Хотите написать другой — пишите">
            Второй отзыв того же автора на ту же карточку заменяет первый, дублей не
            накапливается.
          </LegalStep>
          <LegalStep index={4} title="Не можете войти в аккаунт">
            Скажите через{" "}
            <Link href={TEAM_CONTACT_HREF}>форму заявки</Link> и ссылку на отзыв — разберёмся
            в течение 2 рабочих дней.
          </LegalStep>
        </LegalSteps>
        <LegalNotice icon={EyeOff} title="Почему отзыв мог исчезнуть без вас">
          Запись либо видна целиком, либо скрыта целиком. Мы не «подчищаем» и не
          перефразируем чужие тексты — причина скрытия всегда видна автору.
        </LegalNotice>
      </LegalSection>

      <LegalSection icon={KeyRound} kicker="Аккаунт" title="Вход и тип аккаунта">
        <LegalList columns>
          <LegalPoint icon={Mail} title="Вход почтой и паролем или через Google">
            Аккаунт создаётся при регистрации по почте и пароле либо при первом входе
            через Google — там почта берётся из профиля, и своего пароля у Talentro нет.
            Пароль хранится только как хеш argon2id (см. «Обработку данных»).
          </LegalPoint>
          <LegalPoint icon={UserCheck} title="Тип аккаунта">
            Роль не выбирают: аккаунт начинается участником, а кабинет владельца и модератора
            открывает только модератор, когда подтверждён профиль организации.
          </LegalPoint>
          <LegalPoint icon={KeyRound} title="Если вход не получается">
            Повторите вход. Отдельного восстановления пароля у Talentro нет — он хранится
            только как необратимый хеш, поэтому опишите ситуацию через{" "}
            <Link href={TEAM_CONTACT_HREF}>форму заявки</Link> с почты аккаунта: ответ за 2
            рабочих дня.
          </LegalPoint>
          <LegalPoint icon={ShieldCheck} title="Вход через сервисы">
            Пока один сервис — Google. Отдельного аккаунта с логином и паролем у Talentro нет,
            поэтому вход через сервис является основным, а не запасным.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Users} kicker="Роли" title="Кто что может">
        <div className={styles.kv}>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Гость</span>
            <span className={styles.kvValue}>
              Каталог, поиск, фильтры, карта, карточка, страница организации, «Позвонить» и
              «Поделиться». Избранное и отзывы гостю предлагают войти.
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Участник</span>
            <span className={styles.kvValue}>
              Всё выше плюс избранное, голос на карточку, отзыв, голос и комментарий под
              отзывом.
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Владелец секции или услуги</span>
            <span className={styles.kvValue}>
              Всё выше плюс профиль-анкета организации, свои анкеты: создать, править, снять с
              публикации. Видит статус проверки и причину отказа.
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Модератор</span>
            <span className={styles.kvValue}>
              Очередь «на проверке», опубликовать или отклонить с комментарием, служебные поля
              (город, район, направление, координаты), жалобы на отзывы и комментарии,
              блокировки. Тексты владельца не правит.
            </span>
          </div>
        </div>
      </LegalSection>

      <LegalSection icon={Search} kicker="Если данных нет" title="Честная пустота лучше выдумки">
        <p className={styles.text}>
          Не нашли своё занятие или услугу в каталоге?{" "}
          <Link href="/request">Оставьте заявку</Link> — что ищете и в каком городе. Пустые
          запросы мы собираем и превращаем в план наполнения. Вы — организация и хотите
          появиться здесь сами? <Link href="/register">Заведите анкету в кабинете</Link>,
          это быстрее, чем ждать звонка.
        </p>
        <div className={styles.actions}>
          <Link className="btn btn--primary btn--lg" href="/request">
            <Search size={17} /> Не нашёл занятие
          </Link>
          <Link className="btn btn--outline btn--lg" href="/register">
            <FileText size={17} /> Завести анкету
          </Link>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
