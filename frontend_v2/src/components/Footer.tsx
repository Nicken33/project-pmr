import { Link } from 'react-router-dom'
import { useRefs } from '../state/refs'
import { Logo } from './Logo'

// Подвал — компактный: направления одной строкой и ссылки на правила.
export function Footer() {
  const { categories } = useRefs()
  return (
    <footer className="footer panel">
      <nav className="footer__cats" aria-label="Направления">
        {categories.map((c) => (
          <Link key={c.id} to={`/catalog?cat=${c.id}`}>
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="footer__bottom">
        <Logo height={28} />
        <nav className="footer__links" aria-label="О проекте">
          <Link to="/about">О проекте</Link>
          <Link to="/terms">Условия пользования</Link>
          <Link to="/rules">Правила публикации</Link>
          <Link to="/privacy">Обработка данных</Link>
          <Link to="/request">Не нашли занятие?</Link>
          <Link to="/about#contacts">Контакты</Link>
        </nav>
      </div>
    </footer>
  )
}
