import Link from "next/link";
import { MapPin } from "lucide-react";
import { readView } from "@/lib/session";

export async function Footer() {
  const { mode } = await readView();
  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div className="footerBrand">
          <Link href="/" className="brand brand--footer" aria-label="Talentro">
            <img src="/brand/logo.svg" alt="Talentro" width={150} height={48} />
          </Link>
          <p>
            Каталог занятий и услуг Приднестровья. Помогаем найти секцию, кружок или
            мастера рядом с домом.
          </p>
          <div className="footerContacts">
            {/* Подтверждённых телефона и почты у конкурса-каталога нет: вместо
                выдуманных контактов — то, что действительно открывается. */}
            <span>
              <MapPin size={15} /> Тирасполь, Приднестровье
            </span>
          </div>
        </div>

        <div className="footerColumn">
          <h3>Каталог</h3>
          <Link href="/">Все занятия</Link>
          <Link href="/?kind=service">Услуги</Link>
          <Link href="/map">Карта</Link>
          <Link href="/favorites">Избранное</Link>
        </div>

        <div className="footerColumn">
          <h3>О проекте</h3>
          <Link href="/about">О проекте</Link>
          <Link href="/rules">Правила публикации</Link>
          <Link href="/terms">Условия пользования</Link>
          <Link href="/privacy">Обработка данных</Link>
        </div>

        <div className="footerColumn">
          <h3>Организациям</h3>
          {/* Кабинет открыт только там, где он реально работает (§6): анониму эти
              ссылки вели бы в 404. */}
          {mode === "demo" ? (
            <>
              <Link href="/account/activities/new">Добавить занятие</Link>
              <Link href="/account">Кабинет владельца</Link>
            </>
          ) : (
            <Link href="/login">Войти через Google</Link>
          )}
          <Link href="/request">Не нашли занятие?</Link>
        </div>
      </div>

      <div className="footerBottom">
        <span>© 2026 Talentro. Неофициальный каталог для конкурса.</span>
        <span className="footerAttribution">
          Тайлы карты © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL
        </span>
        <span>Сделано с заботой о детях и родителях</span>
      </div>
    </footer>
  );
}
