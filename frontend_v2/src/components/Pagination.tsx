import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return (
    <nav className="pager" aria-label="Страницы">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Назад">
        <ChevronLeft size={18} />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`d${i}`}>…</span>
        ) : (
          <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Вперёд">
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
