import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  BadgeCheck,
  Clock3,
  EyeOff,
  Flag,
  Layers,
  Mail,
  Megaphone,
  MessageCircle,
  Pencil,
  Scale,
  ShieldCheck,
  Smartphone,
  ThumbsUp,
  Trash2,
  TriangleAlert,
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
  title: "Условия пользования",
  description:
    "Что можно и чего нельзя в каталоге Talentro, что бывает за нарушения и как обжаловать решение модератора. Правила одинаковы для сайта и приложения.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Условия пользования"
      title="Что можно, что нельзя и что бывает за это"
      lead="Правила короткие и человеческие. Говорите честно, выкладывайте своё, не обижайте людей — и вам здесь будет удобно. Эти условия действуют для сайта и для приложения одинаково."
      current="/terms"
      chips={
        <>
          <span className={cn("badge", "badge--category", styles.bigBadge)}>
            <Smartphone size={13} /> Сайт и приложение
          </span>
          <span className={cn("badge", "badge--verified", styles.bigBadge)}>
            <Clock3 size={13} /> Ответ за 2 рабочих дня
          </span>
        </>
      }
    >
      <LegalSection
        icon={Scale}
        kicker="Согласие"
        title="Где вы с этим соглашаетесь"
        hint="Без галочки не работает"
      >
        <LegalList>
          <LegalPoint icon={Users} title="При входе">
            Под кнопкой Google — ссылка на эти правила и на{" "}
            <Link href="/privacy">обработку данных</Link>. Отдельной регистрации с паролем
            нет: аккаунт появляется при первом входе.
          </LegalPoint>
          <LegalPoint icon={MessageCircle} title="При отзыве">
            В форме отзыва отдельный чекбокс «согласен с условиями пользования»: без него
            кнопка неактивна. Текст отзыва — 60–600 знаков.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Где ещё лежит ссылка">
            Ссылка на эти условия есть на странице входа, в подвале сайта и в приложении.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={ThumbsUp}
        kicker="Разрешено"
        title="Что можно"
        hint="Смело"
      >
        <LegalList tone="ok" columns>
          <LegalPoint icon={MessageCircle} title="Своё мнение">
            Отзыв о занятии или услуге: что понравилось, что стоит учесть, как с группами и
            оплатой. 60–600 знаков, один отзыв на карточку.
          </LegalPoint>
          <LegalPoint icon={Pencil} title="Фото и видео из своего занятия">
            До 5 фото и одно видео до 30 секунд — только свои. В кадре не должно быть
            посторонних лиц, особенно чужих детей.
          </LegalPoint>
          <LegalPoint icon={Users} title="Ответ организации">
            Владелец карточки может ответить под отзывом — его реплика помечена «ответ
            организации». Спор по-человечески здесь полезен всем.
          </LegalPoint>
          <LegalPoint icon={ThumbsUp} title="Голос «плюс» или «минус»">
            И у карточки, и у отзыва. Свой голос можно поменять или отозвать. Звёзд у нас нет
            нигде.
          </LegalPoint>
          <LegalPoint icon={MessageCircle} title="Комментарии под отзывом">
            Их пишет любой участник, а не только автор и организация.
          </LegalPoint>
          <LegalPoint icon={Flag} title="Пожаловаться">
            На отзыв, комментарий, фото и на саму карточку — «данные устарели», «неверная
            цена», «некорректный отзыв». Жалоба не публикуется.
          </LegalPoint>
          <LegalPoint icon={Trash2} title="Убрать свой отзыв">
            Автор снимает свою запись сам, модератор для этого не нужен. Новый отзыв того же
            автора заменяет первый.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Избранное и «Поделиться»">
            Сохранять карточки и отправлять ссылку кому угодно — можно. Ссылка в мессенджере
            приходит превью с фото и ценой.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Ban} kicker="Запрещено" title="Что нельзя" hint="Скрываем сразу">
        <LegalList tone="no" columns>
          <LegalPoint icon={Megaphone} title="Мат и оскорбления">
            В адрес людей и организаций. Грубое «мне не понравилось» — можно, переход на
            личности — нет.
          </LegalPoint>
          <LegalPoint icon={EyeOff} title="Чужие персональные данные">
            ФИО, телефоны, адреса, домашний адрес и личный мобильный тренера, фотографии
            детей, списки учеников.
          </LegalPoint>
          <LegalPoint icon={Ban} title="Дискриминационные формулировки">
            Оценки людей по национальности, языку, религии, здоровью или семье.
          </LegalPoint>
          <LegalPoint icon={Megaphone} title="Реклама и ссылки на продажу">
            Промокоды, «напишите мне в личку», продажа курса, переклейка в чужой чат.
          </LegalPoint>
          <LegalPoint icon={TriangleAlert} title="Выдуманные факты о занятиях">
            «Секция закрылась», «цена 100 рублей», «тренера уволили», если это не так.
          </LegalPoint>
          <LegalPoint icon={Layers} title="Спам">
            Один и тот же текст на нескольких карточках, повторяющиеся комментарии, пустые
            отзывы ради счётчика.
          </LegalPoint>
          <LegalPoint icon={Pencil} title="Чужие фото и видео">
            Картинки с чужих сайтов, стоки с водяными знаками, скриншоты из чужих аккаунтов,
            чужие логотипы и товарные знаки.
          </LegalPoint>
          <LegalPoint icon={ShieldCheck} title="Обход блокировки">
            Второй аккаунт после блокировки — самая серьёзная история, см. ниже.
          </LegalPoint>
        </LegalList>
        <LegalNotice icon={Smartphone} title="Для сайта и приложения — одни и те же правила">
          Нельзя в браузере — нельзя и в Android-сборке, и наоборот. Модератор видит одну
          очередь для обоих.
        </LegalNotice>
      </LegalSection>

      <LegalSection
        icon={TriangleAlert}
        kicker="Санкции"
        title="Что за это бывает"
        hint="Решение — в журнале модерации"
      >
        <LegalSteps tone="late">
          <LegalStep index={1} title="Первый раз" pill="запись скрыта">
            Запись скрывается, а вам приходит уведомление с причиной. Причина всегда видна
            автору. Тексты модератор не редактирует и не «смягчает»: запись либо видна
            целиком, либо скрыта целиком.
          </LegalStep>
          <LegalStep index={2} title="Второй раз — или оскорбление человека" pill="7 дней">
            Блокировка на 7 дней. Всё это время каталог можно читать, но нельзя писать: ни
            отзывов, ни комментариев, ни голосов, ни жалоб.
          </LegalStep>
          <LegalStep index={3} title="Третий раз, угрозы или клевета" pill="навсегда">
            Блокировка навсегда. Клевета — это не «не понравилось», а утверждение о том,
            чего не было.
          </LegalStep>
          <LegalStep index={4} title="Обход блокировки вторым аккаунтом" pill="навсегда">
            Закрываем навсегда все связанные аккаунты. Это единственный случай, где мы не
            разбираем обстоятельства.
          </LegalStep>
        </LegalSteps>
        <LegalList>
          <LegalPoint icon={EyeOff} title="Заблокированному можно читать">
            Каталог, карточки, отзывы и карта остаются открыты — закрывается только
            возможность писать. Причина и срок блокировки видны в момент попытки.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Нам не нужно наказывать">
            Мы скрываем запись, чтобы не навредить ребёнку и организации, а не чтобы
            проучить автора. Почти всё заканчивается первым пунктом.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Mail}
        kicker="Апелляция"
        title="Как обжаловать"
        hint="Ответ в течение 2 рабочих дней"
      >
        <LegalSteps>
          <LegalStep index={1} title="Опишите, что не так">
            <Link href={TEAM_CONTACT_HREF}>Форма заявки</Link> — одной строки достаточно.
            Укажите, о какой записи речь: ссылка на карточку или отзыв, скриншот, адрес.
          </LegalStep>
          <LegalStep index={2} title="Что вы хотите получить">
            Вернуть запись, убрать чужие данные из отзыва, снять карточку, объяснить
            блокировку. Мы читаем по смыслу, а не по юридической форме.
          </LegalStep>
          <LegalStep index={3} title="Ответ — за 2 рабочих дня">
            Тот же срок, что у проверки анкеты и у жалобы на данные. Просроченные заявки
            подсвечиваются у модератора в очереди.
          </LegalStep>
          <LegalStep index={4} title="Решение отменяется, если оно было ошибочным">
            Блокировка снимается новой записью в журнале: старое решение остаётся видимым в
            истории, сверху появляется отмена.
          </LegalStep>
        </LegalSteps>
        <LegalNotice icon={Flag} title="Если писать не хочется">
          В карточке занятия есть кнопка «Пожаловаться / данные устарели»: заявка уходит
          модератору автоматически и попадает в тот же журнал.
        </LegalNotice>
        <div className={styles.actions}>
          <Link className="btn btn--primary btn--lg" href={TEAM_CONTACT_HREF}>
            <Mail size={17} /> Написать через форму заявки
          </Link>
          <Link className="btn btn--outline btn--lg" href="/request">
            Не нашли занятие?
          </Link>
        </div>
      </LegalSection>

      <LegalSection
        icon={MessageCircle}
        kicker="Про отзывы"
        title="Как они живут"
        hint="Без предварительной проверки"
      >
        <LegalList>
          <LegalPoint icon={BadgeCheck} title="Публикуется сразу">
            Отзыв, комментарий и медиа видны всем в момент отправки. Модератор смотрит запись
            только после жалобы.
          </LegalPoint>
          <LegalPoint icon={EyeOff} title="Мы не знаем, был ли автор на занятии">
            Поэтому над блоком отзывов висит «мнение посетителя: мы не проверяем, что он был
            на занятии». Средний балл из отзывов мы не считаем.
          </LegalPoint>
          <LegalPoint icon={TriangleAlert} title="Клевета в отзыве">
            Если организация считает отзыв клеветой — запись временно скрывается до разбора,
            ответ приходит за 2 рабочих дня.
          </LegalPoint>
          <LegalPoint icon={Users} title="Текст автора не правится">
            Никаких «перефразируем за вас». Либо запись видна целиком, либо скрыта целиком.
            Удалить своё можно в любой момент — см. <Link href="/rules">правила публикации</Link>.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Scale} kicker="Рядом" title="Что почитать ещё">
        <LegalList columns>
          <LegalPoint icon={ShieldCheck} title="Обработка данных">
            Что мы храним про вас и как удалить аккаунт или запись из каталога — на{" "}
            <Link href="/privacy">отдельной странице</Link>.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Правила публикации">
            Что проверяем перед публикацией, сколько идёт проверка и на каком основании
            запись снимают — в <Link href="/rules">правилах</Link>.
          </LegalPoint>
        </LegalList>
        <p className={styles.note}>
          Про сам каталог, источники данных и карту — на странице{" "}
          <Link href="/about">«О проекте»</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
