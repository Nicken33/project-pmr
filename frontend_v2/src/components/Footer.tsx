import { Link } from 'react-router-dom'
import { useRefs } from '../state/refs'

// Подвал — справочник направлений из API (как в макетах входа/регистрации/избранного).
export function Footer() {
  const { categories } = useRefs()
  return (
    <footer className="footer panel">
      <div className="footer__grid">
        {categories.map((c) => (
          <div key={c.id} className="footer__col">
            <Link to={`/catalog?cat=${c.id}`} className="footer__title">
              {c.name}
            </Link>
            {(c.children ?? []).map((s) => (
              <Link key={s.id} to={`/catalog?cat=${s.id}`} className="footer__item">
                {s.name}
              </Link>
            ))}
          </div>
        ))}
        <div className="footer__col footer__col--links">
          <Link to="/about" className="footer__title">
            О проекте
          </Link>
          <Link to="/terms" className="footer__title">
            Правила
          </Link>
          <Link to="/terms" className="footer__item">
            Условия пользования
          </Link>
          <Link to="/rules" className="footer__item">
            Правила публикации
          </Link>
          <Link to="/privacy" className="footer__item">
            Обработка данных
          </Link>
          <Link to="/request" className="footer__item footer__nf">
            Не нашли занятие?
          </Link>
          <Link to="/about#contacts" className="footer__title">
            Контакты
          </Link>
        </div>
      </div>
    </footer>
  )
}
