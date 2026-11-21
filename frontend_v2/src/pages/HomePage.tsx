import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, MapPin, PhoneCall, Search, ShieldCheck } from 'lucide-react'
import { Api } from '../api/endpoints'
import type { Card } from '../api/types'
import { Hero } from '../components/catalog/Hero'
import { CardMini } from '../components/cards/CardMini'
import { useRefs } from '../state/refs'
import { categoryHint, categoryIcon } from '../lib/categoryIcons'
import { fmtNum, plural } from '../lib/format'

const STEPS = [
  { icon: Search, title: 'Найдите', text: 'Поиск и фильтры по городу, возрасту, цене и дням недели.' },
  { icon: MapPin, title: 'Сравните', text: 'Расписание, группы, адреса на карте и отзывы родителей.' },
  { icon: PhoneCall, title: 'Свяжитесь', text: 'Позвоните или напишите в мессенджер прямо из карточки.' },
]

/** Главная: поиск, направления, как это работает, рекомендуемое, блок для организаций. */
export default function HomePage() {
  const nav = useNavigate()
  const { categories } = useRefs()
  const [total, setTotal] = useState<number | null>(null)
  const [recommended, setRecommended] = useState<Card[] | null>(null)

  useEffect(() => {
    Api.search({ limit: 1 })
      .then((r) => setTotal(r.total))
      .catch(() => {})
    Api.recommended()
      .then((r) => setRecommended((r.items ?? []).slice(0, 6)))
      .catch(() => setRecommended([]))
  }, [])

  return (
    <div className="home">
      <Hero query="" onSearch={(q) => nav(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')} />

      <section className="home-stats">
        <div>
          <b>{total == null ? '—' : fmtNum(total)}</b>
          <span>{total == null ? 'секций и услуг' : plural(total, 'секция и услуга', 'секции и услуги', 'секций и услуг')} в каталоге</span>
        </div>
        <div>
          <b>{categories.length || '—'}</b>
          <span>направлений — от спорта до программирования</span>
        </div>
        <div>
          <ShieldCheck size={26} />
          <span>каждую анкету проверяет команда перед публикацией</span>
        </div>
      </section>

      <section className="home-sec">
        <div className="sec-head">
          <h2>Направления</h2>
          <Link to="/catalog" className="sec-head__more">
            Весь каталог <ChevronRight size={16} />
          </Link>
        </div>
        <div className="home-cats">
          {categories.map((c) => (
            <Link key={c.id} to={`/catalog?cat=${c.id}`} className="home-cat">
              <span className="home-cat__icon">
                <i style={{ maskImage: `url("${categoryIcon(c.name)}")`, WebkitMaskImage: `url("${categoryIcon(c.name)}")` }} />
              </span>
              <span className="home-cat__text">
                <b>{c.name}</b>
                <small>{categoryHint(c.children)}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-sec">
        <h2>Как это работает</h2>
        <ol className="home-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel">
              <span className="home-steps__num">{i + 1}</span>
              <s.icon size={28} className="home-steps__icon" />
              <b>{s.title}</b>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {(recommended === null || recommended.length > 0) && (
        <section className="home-sec">
          <div className="sec-head">
            <h2>Рекомендуемое</h2>
            <Link to="/catalog?sort=rating" className="sec-head__more">
              Смотреть все <ChevronRight size={16} />
            </Link>
          </div>
          <div className="rec__row">
            {recommended === null ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton cmini-skel" />) : recommended.map((c) => <CardMini key={c.id} c={c} />)}
          </div>
        </section>
      )}

      <section className="home-org panel">
        <Building2 size={40} className="home-org__icon" />
        <div>
          <h2>Ведёте секцию или оказываете услуги?</h2>
          <p>Добавьте организацию бесплатно: адреса на карте, группы, расписание и контакты — родители найдут вас сами.</p>
        </div>
        <Link to="/register/org" className="btn btn--primary btn--lg">
          Добавить организацию
        </Link>
      </section>

      <section className="home-about">
        <p>
          Talentro — каталог секций, кружков и услуг Приднестровья. <Link to="/about">Подробнее о проекте →</Link>
        </p>
      </section>
    </div>
  )
}
