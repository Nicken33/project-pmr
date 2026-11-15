import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, MapPin, Phone, ShieldCheck } from "lucide-react";

/** Общий каркас экранов входа (§3.7): слева — зачем аккаунт, справа — форма. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="authScreen container">
      <aside className="authAside">
        <span className="eyebrow">
          <ShieldCheck size={14} /> Без оплаты и без спама
        </span>
        <h1>Аккаунт в Talentro</h1>
        <p>
          Каталог открыт всем без регистрации. Аккаунт нужен, чтобы сохранять занятия,
          голосовать «плюс/минус» и оставлять отзывы — и чтобы модератор видел, кто правит анкету.
        </p>
        <ul className="authBenefits">
          <li>
            <span className="authBenefitIcon">
              <Bookmark size={16} />
            </span>
            <span>
              <strong>Избранное</strong>
              <small>Сохранённое открывается с ближайшей точкой и подходящей группой.</small>
            </span>
          </li>
          <li>
            <span className="authBenefitIcon">
              <Phone size={16} />
            </span>
            <span>
              <strong>Звонок в один тап</strong>
              <small>Телефон проверен звонком — дата проверки видна в карточке.</small>
            </span>
          </li>
          <li>
            <span className="authBenefitIcon">
              <MapPin size={16} />
            </span>
            <span>
              <strong>Свои фильтры</strong>
              <small>Ссылка с фильтрами работает у кого угодно — можно поделиться.</small>
            </span>
          </li>
        </ul>
        <p className="authAsideFoot">
          Данные о вас — только почта, имя, аватар и ваши тексты. Удалить аккаунт можно письмом,{" "}
          <Link href="/privacy">как это работает</Link>.
        </p>
      </aside>
      <div className="authMain">{children}</div>
    </div>
  );
}
