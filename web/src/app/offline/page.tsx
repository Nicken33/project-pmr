import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Нет сети",
  description: "Похоже, соединение пропало. Показываем то, что успели сохранить на телефоне.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="offlineScreen container">
      <span className="offlineIcon">
        <CloudOff size={30} />
      </span>
      <h1>Похоже, вы офлайн</h1>
      <p>
        Каталог, карта и сохранённые карточки работают и без сети: мы держим их в памяти телефона.
        Когда соединение вернётся — обновите страницу: сервис-воркер не перезагружает данные сам,
        он отдаёт их заново при переходе.
      </p>
      <div className="offlineActions">
        <Link href="/" className="btn btn--primary">
          <RefreshCw size={16} /> Открыть каталог
        </Link>
        <Link href="/favorites" className="btn btn--soft">
          Избранное
        </Link>
      </div>
      <p className="offlineHint">
        Цены и расписание без сети могут быть не самыми свежими — перед записью позвоните организации.
      </p>
    </div>
  );
}
