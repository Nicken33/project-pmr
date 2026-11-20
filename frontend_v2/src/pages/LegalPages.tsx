// Четыре страницы «О проекте / правила» (ТЗ §3.11, текст по §11–12). Язык — человеческий.
import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { CONTACT_EMAIL } from '../config'
import { ABOUT_BLOCKS, ABOUT_TITLE } from '../content/about'

function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

function LegalNav() {
  return (
    <nav className="legal-nav" aria-label="Правила">
      <NavLink to="/about">О проекте</NavLink>
      <NavLink to="/terms">Условия пользования</NavLink>
      <NavLink to="/rules">Правила публикации</NavLink>
      <NavLink to="/privacy">Обработка данных</NavLink>
    </nav>
  )
}

const Disclaimer = () => (
  <p className="legal-note">
    Каталог неофициальный: он сделан командой проекта и не является сайтом перечисленных организаций. Данные взяты из открытых источников и от самих
    организаций и актуальны на дату проверки, указанную в карточке. По просьбе правим или убираем запись. Почта для претензий: <Mail />.
  </p>
)

export function AboutPage() {
  useHashScroll()
  return (
    <article className="prose panel narrow about">
      <LegalNav />
      <h1>{ABOUT_TITLE}</h1>
      {ABOUT_BLOCKS.map((b, i) => (
        <section key={i} className={`about-block ${b.layout && b.images?.length ? `about-block--${b.layout}` : ''}`}>
          <div className="about-block__text">
            {b.title && <h2>{b.title}</h2>}
            {b.text?.split(/\n\s*\n/).map((p, k) => (
              <p key={k}>{p.trim()}</p>
            ))}
          </div>
          {!!b.images?.length && (
            <div className={`about-block__images about-block__images--${Math.min(b.images.length, 3)}`}>
              {b.images.map((im) => (
                <figure key={im.src}>
                  <img src={im.src} alt={im.alt ?? im.caption ?? ''} loading="lazy" />
                  {im.caption && <figcaption>{im.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </section>
      ))}
      <Disclaimer />
      <h2 id="contacts">Контакты</h2>
      <p>
        Вопросы, исправления и просьбы убрать запись: <Mail />.
      </p>
      <h2>Карта</h2>
      <p>
        Карта — © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, лицензия ODbL.
      </p>
      <p>
        <Link to="/catalog">Перейти в каталог →</Link>
      </p>
    </article>
  )
}

export function TermsPage() {
  useHashScroll()
  return (
    <article className="prose panel narrow">
      <LegalNav />
      <h1>Условия пользования</h1>
      <p>Эти условия одинаковы для сайта и приложения.</p>
      <h2>Что можно</h2>
      <ul>
        <li>Писать своё мнение о занятиях и услугах — один отзыв на карточку.</li>
        <li>Прикладывать свои фото и видео — без лиц посторонних людей, в том числе чужих детей.</li>
        <li>Организации — отвечать на отзывы; такой ответ помечается «ответ организации».</li>
      </ul>
      <h2>Что нельзя</h2>
      <ul>
        <li>Мат и оскорбления в адрес людей и организаций, дискриминационные формулировки.</li>
        <li>Чужие персональные данные: ФИО, телефоны, адреса.</li>
        <li>Рекламу и ссылки на продажу, спам, один и тот же текст на нескольких карточках.</li>
        <li>Выдуманные факты о занятиях.</li>
        <li>Обходить блокировку вторым аккаунтом.</li>
      </ul>
      <h2 id="sanctions">Что за это бывает</h2>
      <ul>
        <li>Первый раз — запись скрыта, автор получает уведомление.</li>
        <li>Второй раз или оскорбление человека — блокировка на 7 дней.</li>
        <li>Третий раз, угрозы или клевета — блокировка навсегда.</li>
        <li>Обход блокировки — навсегда блокируются все аккаунты.</li>
      </ul>
      <p>
        Отзывы и комментарии публикуются сразу. Модератор смотрит запись только после жалобы и не редактирует текст: запись либо видна целиком, либо
        скрыта целиком, а причина скрытия видна автору.
      </p>
      <h2>Как обжаловать</h2>
      <p>
        Напишите на <Mail /> — укажите ссылку на запись и почему вы не согласны. Ответим в течение 2 рабочих дней.
      </p>
    </article>
  )
}

export function RulesPage() {
  useHashScroll()
  return (
    <article className="prose panel narrow">
      <LegalNav />
      <h1>Правила публикации</h1>
      <h2>Что проверяем</h2>
      <ul>
        <li>Название, направление, адреса с точкой на карте, телефон.</li>
        <li>Возрастные группы, цены и расписание — по дням недели и часам.</li>
        <li>Фото — свои или со свободной лицензией с указанием автора.</li>
      </ul>
      <p>Срок проверки — 2 рабочих дня. После любой правки групп или адресов анкета снова уходит на проверку.</p>
      <h2>Что не публикуем</h2>
      <ul>
        <li>Цены «договорная», возраст «примерно», расписание «по договорённости», адреса без улицы.</li>
        <li>Чужие фотографии, логотипы и дословные тексты с чужих сайтов.</li>
        <li>Персональные данные третьих лиц: домашние адреса, личные телефоны, фото детей, списки учеников.</li>
      </ul>
      <h2>Когда снимаем с публикации</h2>
      <ul>
        <li>Жалоба «данные устарели» подтвердилась: секция закрылась, сменились телефон или цена.</li>
        <li>Нарушены правила выше.</li>
        <li>Организация или мастер попросили убрать запись — убираем в тот же день, без объяснения причин.</li>
      </ul>
      <h2>Как удалить свой отзыв</h2>
      <p>
        Напишите на <Mail /> со ссылкой на отзыв — скроем его целиком.
      </p>
    </article>
  )
}

export function PrivacyPage() {
  useHashScroll()
  return (
    <article className="prose panel narrow">
      <LegalNav />
      <h1>Обработка данных</h1>
      <h2>Какие данные храним</h2>
      <ul>
        <li>У пользователя — почту, имя, аватар и его тексты: отзывы и комментарии (автор и дата).</li>
        <li>Адресов, телефонов и IP у отзывов и комментариев не храним.</li>
        <li>Пароли храним только в виде хэша.</li>
        <li>
          Контакты организаций — не персональные данные: организация публикует их сама. Имя и телефон частного мастера — персональные данные; публикуем
          только то, что он ввёл сам или подтвердил по телефону.
        </li>
      </ul>
      <h2>Как удалить аккаунт</h2>
      <p>
        Напишите на <Mail /> с почты, на которую зарегистрирован аккаунт. В течение 30 дней удалим избранное, голоса и пароль.
      </p>
      <h2 id="remove">Как убрать себя из каталога</h2>
      <p>
        Письмо на <Mail /> — запись снимается в тот же день, персональные данные удаляются без переспрашивания.
      </p>
      <Disclaimer />
    </article>
  )
}
