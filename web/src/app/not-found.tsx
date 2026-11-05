import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="statePage container">
      <div className="emptyState">
        <span className="emptyStateIcon">
          <Compass size={30} />
        </span>
        <h2>Такой страницы нет</h2>
        <p>
          Возможно, карточку сняли с публикации или ссылка устарела. Начните с каталога — там все
          опубликованные занятия и услуги.
        </p>
        <div className="emptyStateActions">
          <Link href="/" className="btn btn--primary">
            <Home size={16} /> В каталог
          </Link>
          <Link href="/map" className="btn btn--soft">
            <Search size={16} /> Открыть карту
          </Link>
        </div>
        <Link href="/request" className="sectionLink">
          Не нашли нужное — оставьте заявку
        </Link>
      </div>
    </div>
  );
}
