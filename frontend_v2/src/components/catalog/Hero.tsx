import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import heroArt from '../../assets/hero-art.webp'
import leaves from '../../assets/leaves.webp'

export function Hero({ query, onSearch, compact }: { query: string; onSearch: (q: string) => void; compact?: boolean }) {
  const [q, setQ] = useState(query)
  useEffect(() => setQ(query), [query])
  return (
    <section className={`hero ${compact ? 'hero--compact' : ''}`}>
      <img className="hero__leaves" src={leaves} alt="" aria-hidden />
      <div className="hero__text">
        <h1>
          Найди занятие
          <br />
          <span>по душе</span>
        </h1>
        <p>
          Секции, кружки, услуги и хобби рядом с вами.
          <br />
          Развивайся. Открывай новое. Вдохновляйся.
        </p>
        <form
          className="hero__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            onSearch(q.trim())
          }}
        >
          <Search size={20} className="hero__search-icon" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск секций, услуг, занятий..."
            aria-label="Поиск секций, услуг, занятий"
          />
          <button type="submit" className="btn btn--solid">
            Найти
          </button>
        </form>
      </div>
      <img className="hero__art" src={heroArt} alt="Твори. Развивайся. Открывай мир" />
    </section>
  )
}
