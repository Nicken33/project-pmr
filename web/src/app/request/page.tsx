import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchX, ShieldCheck } from "lucide-react";
import { RequestForm } from "@/components/request/RequestClient";
import { cities } from "@/lib/data";

export const metadata: Metadata = {
  title: "Не нашли занятие — оставьте заявку",
  description:
    "Расскажите, чего не хватает в каталоге: что ищете и в каком городе. Модератор проверит источник и добавит анкету либо ответит вам на почту.",
  alternates: { canonical: "/request" },
};

export default function RequestPage() {
  return (
    <div className="requestPage container">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">
          <ArrowLeft size={14} /> Каталог
        </Link>
        <span>/</span>
        <span>Заявка</span>
      </nav>

      <div className="requestLayout">
        <section className="requestMain">
          <span className="eyebrow">
            <SearchX size={13} /> Пробел в каталоге
          </span>
          <h1>Не нашли то, чем хотите заниматься?</h1>
          <p className="requestLead">
            Оставьте пару слов о занятии и город. Такие заявки мы собираем в статистику пропусков: что
            ищут чаще всего — то и идём проверять в первую очередь.
          </p>
          <RequestForm cities={cities} />
        </section>

        <aside className="requestAside">
          <div className="requestCard">
            <h2>Что происходит с заявкой</h2>
            <ol className="requestSteps">
              <li>
                <strong>Попадаем в очередь</strong>
                <span>Модератор видит текст, город и почту — без неё заявка идёт только в статистику.</span>
              </li>
              <li>
                <strong>Ищем источник</strong>
                <span>Проверяем, есть ли такое занятие у нас или у организации: сайт, соцсеть, звонок.</span>
              </li>
              <li>
                <strong>Решение</strong>
                <span>«взяли в работу», «уже есть» со ссылкой на карточку или «не берём» с причиной.</span>
              </li>
            </ol>
          </div>
          <div className="safetyCard">
            <span className="safetyIcon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Без персональных данных</strong>
              <p>
                Почту не показываем нигде и не передаём организациям. Не нужно вписывать в заявку
                телефоны, адреса и имена детей — мы всё равно не сможем это проверить.
              </p>
              <Link href="/privacy">Как мы храним данные</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
