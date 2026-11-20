import { Link } from 'react-router-dom'

/** Главная страница. Пока заготовка — содержимое (описание, блоки и т. д.) добавим позже. */
export default function HomePage() {
  return (
    <section className="panel home-stub">
      <div>
        <h1>Talentro</h1>
        <p>Каталог секций, кружков и услуг Приднестровья.</p>
      </div>
      <div className="row row--wrap" style={{ justifyContent: 'center' }}>
        <Link to="/catalog" className="btn btn--solid">
          Открыть каталог
        </Link>
        <Link to="/map" className="btn btn--soft">
          Карта
        </Link>
        <Link to="/about" className="btn btn--soft">
          О проекте
        </Link>
      </div>
    </section>
  )
}
