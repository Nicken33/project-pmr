import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Info,
  Mail,
  Scale,
  ShieldCheck,
} from "lucide-react";
import styles from "@/components/legal/legal.module.css";
import { cn } from "@/lib/utils";

/**
 * Единственный подтверждённый канал связи с командой — форма заявок; почты и
 * телефона проекта нет, неподтверждённый контакт выглядел бы настоящим (§6).
 */
export const TEAM_CONTACT_HREF = "/request";

export const legalPages = [
  {
    href: "/about",
    label: "О проекте",
    note: "Кто мы и откуда данные",
    icon: Info,
  },
  {
    href: "/terms",
    label: "Условия пользования",
    note: "Что можно и что нельзя",
    icon: Scale,
  },
  {
    href: "/rules",
    label: "Правила публикации",
    note: "Как анкета проходит проверку",
    icon: ClipboardCheck,
  },
  {
    href: "/privacy",
    label: "Обработка данных",
    note: "Что храним и как удалить",
    icon: ShieldCheck,
  },
] as const;

export type LegalRoute = (typeof legalPages)[number]["href"];

interface LegalLayoutProps {
  /** Мелкая метка над заголовком. */
  eyebrow: string;
  title: string;
  lead: string;
  current: LegalRoute;
  chips?: ReactNode;
  children: ReactNode;
}

export function LegalLayout({
  eyebrow,
  title,
  lead,
  current,
  chips,
  children,
}: LegalLayoutProps) {
  const hub = current !== "/about" ? legalPages[0] : null;
  const others = legalPages.filter((page) => page.href !== current);

  return (
    <div className={cn("container", styles.page)}>
      <div className={styles.inner}>
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link href="/">
            <ArrowLeft size={14} /> Каталог
          </Link>
          <span>/</span>
          {hub ? (
            <>
              <Link href={hub.href}>{hub.label}</Link>
              <span>/</span>
            </>
          ) : null}
          <span aria-current="page">{title}</span>
        </nav>

        <header className={styles.head}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {chips ? <div className={styles.chips}>{chips}</div> : null}
        </header>

        <div className={styles.shell}>
          <div className={styles.body}>
            {children}

            <section className={cn("detailCard", styles.card)} aria-label="Другие разделы">
              <h2 className={styles.sub}>Ещё три страницы про правила</h2>
              <div className={styles.alsoRead}>
                {others.map((page) => (
                  <Link key={page.href} href={page.href} className={styles.alsoLink}>
                    <span>{page.label}</span>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
              <p className={styles.note}>
                Что-то не так с записью или не нашли своё занятие? Скажите через{" "}
                <Link href={TEAM_CONTACT_HREF}>форму заявки</Link> — отвечаем за 2
                рабочих дня.
              </p>
            </section>
          </div>

          <aside className={styles.aside} aria-label="Разделы о проекте и правилах">
            <nav className={styles.sideCard}>
              <h2 className={styles.sideTitle}>
                <Mail size={13} /> Разделы
              </h2>
              <ul className={styles.sideList}>
                {legalPages.map((page) => {
                  const isActive = page.href === current;
                  const Icon = page.icon;
                  return (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(styles.sideLink, isActive && styles.sideLinkActive)}
                      >
                        <Icon size={16} className={styles.sideLinkIcon} />
                        <span className={styles.sideText}>
                          <span>{page.label}</span>
                          <span className={styles.sideNote}>{page.note}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className={cn("safetyCard", styles.helpCard)}>
              <span className={cn("safetyIcon", styles.helpIcon)}>
                <ShieldCheck size={17} />
              </span>
              <div className={styles.helpBody}>
                <strong>Каталог неофициальный</strong>
                <p>
                  Talentro не является сайтом перечисленных организаций. Данные из
                  открытых источников и от самих организаций, актуальны на дату
                  проверки в карточке.
                </p>
                <Link href={TEAM_CONTACT_HREF}>Сообщить о расхождении</Link>
              </div>
            </div>

            <div className={styles.sideCard}>
              <h2 className={styles.sideTitle}>
                <Check size={13} /> Быстрые ссылки
              </h2>
              <ul className={styles.sideList}>
                <li>
                  <Link href="/" className={styles.sideLink}>
                    <ArrowLeft size={16} className={styles.sideLinkIcon} />
                    <span className={styles.sideText}>
                      <span>В каталог</span>
                      <span className={styles.sideNote}>Секции, кружки, услуги</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/request" className={styles.sideLink}>
                    <Mail size={16} className={styles.sideLinkIcon} />
                    <span className={styles.sideText}>
                      <span>Не нашли занятие?</span>
                      <span className={styles.sideNote}>Заявка на наполнение</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={styles.sideLink}>
                    <ClipboardCheck size={16} className={styles.sideLinkIcon} />
                    <span className={styles.sideText}>
                      <span>Войти через Google</span>
                      <span className={styles.sideNote}>Избранное, отзывы, кабинеты</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

interface LegalSectionProps {
  icon: LucideIcon;
  kicker: string;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function LegalSection({ icon: Icon, kicker, title, hint, children }: LegalSectionProps) {
  return (
    <section className={cn("detailCard", styles.card)}>
      <div className={cn("detailCardHead", styles.headTitle)}>
        <div className={styles.headMain}>
          <span className={styles.headIcon}>
            <Icon size={19} />
          </span>
          <div>
            <span className="eyebrow">{kicker}</span>
            <h2>{title}</h2>
          </div>
        </div>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

type Tone = "neutral" | "ok" | "no" | "warn";

interface LegalListProps {
  tone?: Tone;
  columns?: boolean;
  children: ReactNode;
}

export function LegalList({ tone = "neutral", columns = false, children }: LegalListProps) {
  return (
    <ul
      className={cn(
        styles.list,
        columns && styles.cols,
        tone === "ok" && styles.ok,
        tone === "no" && styles.no,
        tone === "warn" && styles.warn,
      )}
    >
      {children}
    </ul>
  );
}

interface LegalPointProps {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
}

export function LegalPoint({ icon: Icon = Check, title, children }: LegalPointProps) {
  return (
    <li className={styles.point}>
      <span className={styles.pointIcon}>
        <Icon size={15} />
      </span>
      <span className={styles.pointBody}>
        <span className={styles.pointTitle}>{title}</span>
        {children ? <span className={styles.pointText}>{children}</span> : null}
      </span>
    </li>
  );
}

interface LegalStepProps {
  index: number;
  title: string;
  pill?: string;
  pillTone?: Tone;
  children?: ReactNode;
}

export function LegalStep({ index, title, pill, pillTone = "neutral", children }: LegalStepProps) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNum} aria-hidden="true">
        {index}
      </span>
      <span className={styles.stepBody}>
        <span className={styles.stepTop}>
          <span className={styles.stepTitle}>{title}</span>
          {pill ? (
            <span
              className={cn(
                styles.pill,
                pillTone === "ok" && styles.pillOk,
                pillTone === "no" && styles.pillDanger,
                pillTone === "warn" && styles.pillWarn,
              )}
            >
              {pill}
            </span>
          ) : null}
        </span>
        {children ? <span className={styles.stepText}>{children}</span> : null}
      </span>
    </li>
  );
}

export function LegalSteps({ children, tone }: { children: ReactNode; tone?: "ban" | "late" }) {
  return <ol className={cn(styles.steps, tone === "ban" && styles.ban, tone === "late" && styles.late)}>{children}</ol>;
}

interface LegalNoticeProps {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  children: ReactNode;
}

export function LegalNotice({ icon: Icon = Info, tone = "neutral", title, children }: LegalNoticeProps) {
  return (
    <div
      className={cn(
        styles.notice,
        tone === "ok" && styles.okNotice,
        tone === "no" && styles.dangerNotice,
        tone === "warn" && styles.warnNotice,
      )}
    >
      <span className={styles.noticeIcon}>
        <Icon size={16} />
      </span>
      <div className={styles.noticeBody}>
        <span className={styles.noticeTitle}>{title}</span>
        <p className={styles.noticeText}>{children}</p>
      </div>
    </div>
  );
}

interface LegalStatProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

export function LegalStat({ icon: Icon, label, value }: LegalStatProps) {
  return (
    <div className={cn("fact", styles.stat)}>
      <span className={cn("factIcon", styles.statIcon)}>
        <Icon size={18} />
      </span>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </span>
    </div>
  );
}
