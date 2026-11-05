import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  BellOff,
  BookOpen,
  ClipboardCheck,
  Clock3,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  Globe2,
  Info,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Scale,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  UploadCloud,
  UserCheck,
  Users,
  Wallet,
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
  title: "Обработка данных",
  description:
    "Какие данные хранит Talentro, почему контакты организаций не считаются персональными данными, как мастеру или родителю убрать себя из каталога и как удалить аккаунт.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Обработка данных"
      title="Что мы храним и как это удалить"
      lead="Данных у нас немного, и все они нужны для одной вещи: чтобы карточка была честной, а отзыв — от реального человека. Здесь описано, что лежит у нас, чего не лежит и как всё это стереть."
      current="/privacy"
      chips={
        <>
          <span className={cn("badge", "badge--verified", styles.bigBadge)}>
            <Trash2 size={13} /> Удаление — по просьбе
          </span>
          <span className={cn("badge", "badge--warning", styles.bigBadge)}>
            <Clock3 size={13} /> Чистка через 30 дней
          </span>
        </>
      }
    >
      <LegalSection icon={FileText} kicker="О вас" title="Что храним">
        <LegalList columns>
          <LegalPoint icon={Mail} title="Почта">
            Один адрес на аккаунт — из профиля Google. Отдельного пароля у Talentro нет,
            поэтому восстановление не нужно.
          </LegalPoint>
          <LegalPoint icon={Users} title="Имя и аватар">
            Это подпись под вашим отзывом и комментарием. Настоящее или выдуманное — на ваше
            усмотрение, мы не требуем паспортных данных.
          </LegalPoint>
          <LegalPoint icon={MessageCircle} title="Ваши тексты">
            Отзывы и комментарии, автор и дата. Текст автор не меняет чужими руками: правит
            только сам автор.
          </LegalPoint>
          <LegalPoint icon={BadgeCheck} title="Избранное и голоса">
            Сохранённые карточки и ваши «плюс»/«минус» — чтобы счётчики были вашими, а не
            нарисованными.
          </LegalPoint>
          <LegalPoint icon={Lock} title="Пароль — только хеш">
            От регистрации по почте и паролю остаётся хеш argon2id в колонке
            users.password_hash; исходный пароль не пишется ни в базу, ни в логи,
            ни в почту и восстановить его нельзя — только заменить. Вход через
            Google пароля не создаёт вовсе.
          </LegalPoint>
          <LegalPoint icon={KeyRound} title="Сессионный куки">
            HTTP-only cookie на 30 дней: HMAC-подпись и SameSite=Lax. В логи почта и токен
            не пишутся.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={EyeOff} kicker="Не храним" title="Чего у нас нет">
        <LegalList tone="no" columns>
          <LegalPoint icon={Phone} title="Адресов, телефонов и IP у отзывов">
            Под отзывом и комментарием нет ни домашнего адреса, ни номера, ни адреса
            устройства — только автор и дата.
          </LegalPoint>
          <LegalPoint icon={Smartphone} title="Ваших координат в кармане">
            Геолокацию просим только когда вы сами нажимаете «Рядом со мной» и объясняем, зачем.
            Отказались — выбираете город вручную, а список сортируется не по расстоянию.
          </LegalPoint>
          <LegalPoint icon={Users} title="Данных детей">
            Профиля ребёнка мы не заводим: возраст в фильтре — просто число, нужное для
            подходящей группы.
          </LegalPoint>
          <LegalPoint icon={Wallet} title="Платежей">
            Talentro не принимает деньги и не хранит платёжные реквизиты: ни свои, ни чужие.
          </LegalPoint>
          <LegalPoint icon={BellOff} title="Рассылок и писем">
            Письмом мы не пишем: почтового адреса у продукта нет, заявки и претензии уходят
            через форму, а адрес подтверждает Google.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection
        icon={Landmark}
        kicker="Организации"
        title="Контакты организации — не персональные данные"
      >
        <p className={styles.text}>
          Название, адрес, телефон приёмной, направление, возраст и часы работы — это открытые
          сведения о хозяйствующем субъекте, которые он сам публикует, чтобы к нему приходили.
          Согласия на то, что мы их указали, не требуется. Мы пересказываем их своими словами и
          даём ссылку на источник.
        </p>
        <LegalNotice icon={Scale} tone="warn" title="Частный мастер — другое дело">
          Мастер (ИП, самозанятый) — физическое лицо, и его имя и телефон — уже персональные
          данные. Поэтому про мастера пишем только то, что он сам внёс в кабинете или подтвердил
          звонком, и храним отметку «согласие на публикацию»: дата и кем получено. По первому
          требованию снимаем запись в тот же день и без переспрашивания.
        </LegalNotice>
      </LegalSection>

      <LegalSection
        icon={Trash2}
        kicker="Главное"
        title="Как убрать себя из каталога"
        hint="Снимаем в тот же день"
      >
        <LegalSteps>
          <LegalStep index={1} title="Одно сообщение через форму" pill="одной строкой">
            Скажите через{" "}
            <Link href={TEAM_CONTACT_HREF}>форму заявки</Link>: «уберите мою запись» и ссылка
            на карточку или адрес организации. Можно и про себя: нашли свою фамилию в отзыве —
            просите убрать.
          </LegalStep>
          <LegalStep index={2} title="Объяснять причину не нужно" pill="без вопросов">
            Мы не спрашиваем «а точно ли» и не просим документы. Сведения о человеке должны
            убираться из открытого источника по его требованию — так и делаем.
          </LegalStep>
          <LegalStep index={3} title="Запись снимается в тот же день">
            Она перестаёт быть видна в каталоге, на карте и в поиске.
          </LegalStep>
          <LegalStep index={4} title="Персональные данные удаляем сразу" pill="без ожидания">
            Без переспрашивания и без «сначала согласуем». Если позже захотите вернуться —
            напишите снова, вернём запись с новой датой проверки.
          </LegalStep>
        </LegalSteps>
        <div className={styles.actions}>
          <Link className="btn btn--primary btn--lg" href={TEAM_CONTACT_HREF}>
            <Mail size={17} /> Убрать меня из каталога
          </Link>
          <Link className="btn btn--outline btn--lg" href="/rules">
            <ClipboardCheck size={17} /> Правила публикации
          </Link>
        </div>
      </LegalSection>

      <LegalSection icon={KeyRound} kicker="Аккаунт" title="Как удалить аккаунт">
        <LegalList>
          <LegalPoint icon={Mail} title="Сообщением с почты аккаунта">
            Через <Link href={TEAM_CONTACT_HREF}>форму заявки</Link> — адрес берём из
            подтверждённого профиля Google. Кнопки «удалить» в кабинете нет специально: так мы
            уверены, что просьба настоящая.
          </LegalPoint>
          <LegalPoint icon={Clock3} title="Через 30 дней чистим">
            Удаляем избранное и голоса — паролей мы не храним. Срок нужен, чтобы случайная
            просьба не стёрла год сохранённых карточек.
          </LegalPoint>
          <LegalPoint icon={MessageCircle} title="Ваши тексты">
            Отзыв или комментарий можно убрать раньше — автор снимает свою запись сам, это
            описано в <Link href="/rules">правилах публикации</Link>.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Flag} kicker="Жалобы" title="Жалоба на данные — тоже основание">
        <LegalList columns>
          <LegalPoint icon={TriangleAlert} title="«Это уже не работает»">
            Сообщение о том, что занятие закрылось или цена другая, — законное основание снять
            запись с публикации.
          </LegalPoint>
          <LegalPoint icon={Clock3} title="Ответ — 2 рабочих дня">
            Тот же срок у проверки анкеты, жалобы на отзыв и заявления о неточности.
          </LegalPoint>
          <LegalPoint icon={Search} title="Или кнопка в карточке">
            «Пожаловаться / данные устарели» — тот же канал, что и форма заявки.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={UploadCloud} kicker="Медиа" title="Фото, видео и чужие тексты">
        <LegalList columns>
          <LegalPoint icon={BadgeCheck} title="Только свои или свободные">
            Свои фото и видео с занятия — можно. Свободные лицензии — с указанием автора и
            лицензии; источник и лицензия каждого файла записаны в списке медиа.
          </LegalPoint>
          <LegalPoint icon={Ban} title="Без водяных знаков и чужих сайтов">
            Стоки с watermark, картинки, скачанные с чужих сайтов, и «найдено в Instagram» не
            используем.
          </LegalPoint>
          <LegalPoint icon={EyeOff} title="Без посторонних лиц">
            В отзывах — только свои фото и без лиц посторонних людей, включая чужих детей.
            Списки учеников и фамилии детей не публикуем ни в каком виде.
          </LegalPoint>
          <LegalPoint icon={BookOpen} title="Без чужих текстов и знаков">
            Описания с чужих сайтов слово в слово не переносим, чужие логотипы и товарные знаки
            как иконки занятий не ставим.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Globe2} kicker="Лицензии" title="Открытые данные и карта">
        <p className={styles.text}>
          Данные каталога мы держим открыто и ссылаемся на источник в каждой записи. Тайлы карты
          — OpenStreetMap по лицензии ODbL, которая просит указывать источник: на карте и внизу
          сайта стоит «© OpenStreetMap contributors».
        </p>
        <div className={styles.actions}>
          <a
            className="btn btn--outline btn--lg"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe2 size={17} /> Условия ODbL
          </a>
          <Link className="btn btn--soft btn--lg" href="/about">
            <Info size={17} /> Откуда данные в каталоге
          </Link>
        </div>
      </LegalSection>

      <LegalSection icon={ShieldCheck} kicker="Защита" title="Как это устроено внутри">
        <LegalList columns>
          <LegalPoint icon={Lock} title="Вход и сессия">
            Токен Google сверяется на сервере, сессия — HTTP-only cookie с HMAC-подписью.
            Пароля у продукта нет, поэтому в базу и в лог он попасть не может.
          </LegalPoint>
          <LegalPoint icon={Gauge} title="Сессию не подделать">
            Подпись на куке сверяется до выдачи данных: изменённую или чужую куку сервер
            отклоняет. Перебирать пароль нечего — его нет.
          </LegalPoint>
          <LegalPoint icon={FileText} title="Вывод экранируется">
            Все поля идут через параметризованные запросы, вывод защищается фреймворком.
          </LegalPoint>
          <LegalPoint icon={UploadCloud} title="Загрузки с устройства нет">
            Принимать картинки с телефона сервер не умеет: фото в каталоге — из открытых
            источников и от организаций, они лежат на нашем сервере.
          </LegalPoint>
          <LegalPoint icon={UserCheck} title="Права проверяются на сервере">
            Чужая анкета, модерация без роли, правка чужого отзыва и любое действие
            заблокированного получают отказ, даже если кнопка где-то и показалась.
          </LegalPoint>
          <LegalPoint icon={Megaphone} title="Секреты не в коде">
            Ключи живут только в .env на сервере; в репозиторий попадает образец без значений.
          </LegalPoint>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Users} kicker="Согласие" title="Где вы нажимаете «согласен»">
        <p className={styles.text}>
          На странице входа ссылка на эту страницу стоит под кнопкой Google, а в форме отзыва —
          чекбокс с условиями пользования: без галочки кнопка неактивна. Мы не прячем
          обработку данных мелким шрифтом — всё вот здесь, обычными словами.
        </p>
        <LegalNotice icon={Info} title="И снова про честность">
          Talentro — неофициальный каталог для конкурса, а не сайт перечисленных организаций.
          Данные взяты из открытых источников и от самих организаций и актуальны на дату
          проверки в карточке. По просьбе правим или убираем запись — через{" "}
          <Link href={TEAM_CONTACT_HREF}>форму заявки</Link>.
        </LegalNotice>
      </LegalSection>

      <LegalSection icon={Mail} kicker="Связь" title="Куда писать">
        <LegalList>
          <LegalPoint icon={Trash2} title="Убрать запись или данные">
            <Link href={TEAM_CONTACT_HREF}>Форма заявки</Link> — снимаем в тот же день.
          </LegalPoint>
          <LegalPoint icon={TriangleAlert} title="Почему запись неправдивая">
            В карточке — «Пожаловаться / данные устарели», или форма заявки.
          </LegalPoint>
          <LegalPoint icon={FileText} title="Удалить аккаунт">
            Сообщением через форму заявки с почты аккаунта: вход прекращается сразу,
            избранное и голоса стираем в течение 30 дней — паролей мы не храним.
          </LegalPoint>
        </LegalList>
        <div className={styles.actions}>
          <Link className="btn btn--primary btn--lg" href={TEAM_CONTACT_HREF}>
            <Mail size={17} /> Написать через форму заявки
          </Link>
          <Link className="btn btn--ghost btn--lg" href="/login">
            <KeyRound size={17} /> Войти
          </Link>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
