import { Link } from 'react-router-dom'

export default function NotFoundPage({ text }: { text?: string }) {
  return (
    <div className="notfound panel">
      <b>404</b>
      <h1>Страница не найдена</h1>
      <p>{text ?? 'Возможно, ссылка устарела или в адресе опечатка.'}</p>
      <Link to="/" className="btn btn--solid">
        На главную
      </Link>
    </div>
  )
}
