"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ошибки экрана показываем в консоли разработки; в прод — отчёт по digest.
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="statePage container">
      <div className="emptyState">
        <span className="emptyStateIcon">
          <AlertTriangle size={30} />
        </span>
        <h2>Что-то пошло не так</h2>
        <p>
          Страница не дорисовалась. Обычно помогает повтор — данные каталога не потеряются. Если
          ошибка повторяется, напишите команде, мы посмотрим по коду {error.digest ?? "случая"}.
        </p>
        <div className="emptyStateActions">
          <button type="button" className="btn btn--primary" onClick={reset}>
            <RotateCcw size={16} /> Повторить
          </button>
          <Link href="/" className="btn btn--soft">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    </div>
  );
}
