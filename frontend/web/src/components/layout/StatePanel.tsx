import Link from "next/link";
import { ShieldCheck, WifiOff } from "lucide-react";

/**
 * Две честные заглушки витрины (§6).
 *
 * Ни та, ни другая не передают клиенту коллекций: «данных нет» и «раздел закрыт»
 * не должны превращаться в подставные анкеты — ровно тот класс утечки, который
 * требует ловить граница real/demo.
 */

export function UnavailablePanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="emptyState catalogEmpty" role="alert">
      <span className="emptyStateIcon">
        <WifiOff size={30} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="emptyStateActions">
        <Link href="/" className="btn btn--primary">
          В каталог
        </Link>
        <Link href="/request" className="btn btn--soft">
          Оставить заявку
        </Link>
      </div>
    </div>
  );
}

export function TesterOnlyPanel() {
  return (
    <div className="emptyState catalogEmpty">
      <span className="emptyStateIcon">
        <ShieldCheck size={30} />
      </span>
      <h3>Раздел доступен по тестовому входу</h3>
      <p>
        Кабинеты собираются из демонстрационных данных, поэтому обычному
        посетителю их не показываем. Войти для проверки может тестировщик.
      </p>
      <div className="emptyStateActions">
        <Link href="/login" className="btn btn--primary">
          Вход для проверки
        </Link>
        <Link href="/" className="btn btn--soft">
          В каталог
        </Link>
      </div>
    </div>
  );
}
