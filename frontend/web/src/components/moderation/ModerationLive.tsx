"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Lock,
  MessagesSquare,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import type { Application, ContentReport, ModerationEntry } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import {
  ModerationApiError,
  decideApplication,
  decideReport,
  fetchJournal,
  fetchQueue,
  fetchReports,
  type ModerationPage,
} from "@/lib/moderation-api";
import type { DecisionInput as DraftDecision } from "@/lib/moderation";
import { ApplicationQueue } from "@/components/moderation/ApplicationQueue";
import { ReportQueue } from "@/components/moderation/ReportQueue";
import { ModerationJournal } from "@/components/moderation/ModerationJournal";

/**
 * Живой кабинет модерации (§3.9, §12.1).
 *
 * Очереди берутся с бэкенда через прокси `/api/moderation/*`, а не из моков:
 * роль сервер перечитывает из базы на каждый запрос, поэтому кабинет показывает
 * ровно то, что сервер разрешил показать, — включая отказы 401, 403, 409 и 400
 * с полями под полем. Пустая очередь выглядит как пустая очередь: «заявок нет»,
 * а не демонстрационный набор анкет.
 */

type Tab = "queue" | "reports" | "journal";

/** Столько же, сколько принимает бэкенд (`maxLimit`), и ровно то, что умещается на экран. */
const PAGE_SIZE = 20;

type SectionState<T> =
  | { kind: "loading" }
  | { kind: "error"; error: ModerationApiError }
  | { kind: "ready"; page: ModerationPage<T> };

/** Сетевой сбой и чужой тип ошибки приводим к одному статусу: 0 рисует «сервер не отвечает». */
function toError(value: unknown): ModerationApiError {
  return value instanceof ModerationApiError
    ? value
    : new ModerationApiError(0, "Сервер модерации не отвечает");
}

export function ModerationLive() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<Tab>("queue");
  const [pages, setPages] = useState<Record<Tab, number>>({ queue: 1, reports: 1, journal: 1 });
  const [queue, setQueue] = useState<SectionState<Application>>({ kind: "loading" });
  const [reports, setReports] = useState<SectionState<ContentReport>>({ kind: "loading" });
  const [journal, setJournal] = useState<SectionState<ModerationEntry>>({ kind: "loading" });
  const [pending, setPending] = useState<string | null>(null);
  const [appErrors, setAppErrors] = useState<Record<string, Record<string, string>>>({});
  const [reportErrors, setReportErrors] = useState<Record<string, Record<string, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  /* Загрузка одной секции. Страницу передаём аргументом, а не читаем из состояния:
     иначе переход по страницам мог бы отправить запрос со старым значением. */
  const loadQueue = useCallback((page: number) => {
    setQueue({ kind: "loading" });
    fetchQueue(page, PAGE_SIZE)
      .then((result) => setQueue({ kind: "ready", page: result }))
      .catch((error) => setQueue({ kind: "error", error: toError(error) }));
  }, []);

  const loadReports = useCallback((page: number) => {
    setReports({ kind: "loading" });
    fetchReports(page, PAGE_SIZE)
      .then((result) => setReports({ kind: "ready", page: result }))
      .catch((error) => setReports({ kind: "error", error: toError(error) }));
  }, []);

  const loadJournal = useCallback((page: number) => {
    setJournal({ kind: "loading" });
    fetchJournal(page, PAGE_SIZE)
      .then((result) => setJournal({ kind: "ready", page: result }))
      .catch((error) => setJournal({ kind: "error", error: toError(error) }));
  }, []);

  /* Первая загрузка: секции уже в состоянии `loading`, поэтому эффекта хватает
     одного асинхронного вызова — синхронный setState внутри эффекта дал бы
     второй рендер до ответа сервера. */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [q, r, j] = await Promise.allSettled([
        fetchQueue(1, PAGE_SIZE),
        fetchReports(1, PAGE_SIZE),
        fetchJournal(1, PAGE_SIZE),
      ]);
      if (!alive) return;
      if (q.status === "fulfilled") setQueue({ kind: "ready", page: q.value });
      else setQueue({ kind: "error", error: toError(q.reason) });
      if (r.status === "fulfilled") setReports({ kind: "ready", page: r.value });
      else setReports({ kind: "error", error: toError(r.reason) });
      if (j.status === "fulfilled") setJournal({ kind: "ready", page: j.value });
      else setJournal({ kind: "error", error: toError(j.reason) });
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const goTo = (section: Tab, next: number) => {
    if (next < 1) return;
    setPages((current) => ({ ...current, [section]: next }));
    if (section === "queue") loadQueue(next);
    if (section === "reports") loadReports(next);
    if (section === "journal") loadJournal(next);
  };

  const reloadAll = () => {
    loadQueue(pages.queue);
    loadReports(pages.reports);
    loadJournal(pages.journal);
  };

  /** После принятого решения очередь и журнал перечитываем: статус карточки знает сервер. */
  const afterDecision = () => {
    loadQueue(pages.queue);
    loadJournal(pages.journal);
  };

  const handleDecide = async (applicationId: string, input: DraftDecision) => {
    setPending(applicationId);
    setAppErrors((current) => ({ ...current, [applicationId]: {} }));
    const title =
      queue.kind === "ready"
        ? (queue.page.items.find((row) => row.id === applicationId)?.title ?? "Анкета")
        : "Анкета";
    try {
      const result = await decideApplication(applicationId, {
        action: input.action === "publish" ? "approve" : "reject",
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.comment ? { comment: input.comment } : {}),
      });
      if (result.replayed) {
        // Повтор того же решения сервер считает успехом и новую строку журнала
        // не пишет — второй записи отсюда не появится.
        toast({
          title: "Решение уже было принято",
          description: `${title}: сервер повторил прежнее решение и не добавил запись в журнал.`,
        });
      } else {
        toast({
          title: input.action === "publish" ? "Анкета опубликована" : "Анкета отклонена",
          description:
            input.action === "publish"
              ? `${title} снята с очереди и появилась в каталоге.`
              : `${title} возвращена владельцу с причиной.`,
          tone: input.action === "publish" ? "success" : "danger",
        });
      }
      afterDecision();
    } catch (error) {
      const apiError = toError(error);
      if (apiError.status === 400) {
        setAppErrors((current) => ({ ...current, [applicationId]: apiError.fields }));
        return;
      }
      if (apiError.status === 409) {
        setNotice(`${title}: заявка уже закрыта прежним решением. Показываем актуальный статус.`);
        afterDecision();
        return;
      }
      toast({ title: "Решение не принято", description: apiError.message, tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  const handleReportDecision = async (reportId: string, action: "hide" | "dismiss", reason?: string) => {
    setPending(reportId);
    setReportErrors((current) => ({ ...current, [reportId]: {} }));
    const title =
      reports.kind === "ready"
        ? (reports.page.items.find((row) => row.id === reportId)?.activityTitle ?? "Жалоба")
        : "Жалоба";
    try {
      const result = await decideReport(reportId, { action, ...(reason ? { reason } : {}) });
      toast({
        title: action === "hide" ? "Запись скрыта" : "Жалоба отклонена",
        description:
          action === "hide"
            ? `${title}: ${result.report?.hideReason ?? reason ?? "основание принято"}.`
            : `${title}: запись остаётся видимой.`,
        tone: action === "hide" ? "danger" : "default",
      });
      loadReports(pages.reports);
      loadJournal(pages.journal);
    } catch (error) {
      const apiError = toError(error);
      if (apiError.status === 400) {
        setReportErrors((current) => ({ ...current, [reportId]: apiError.fields }));
        return;
      }
      if (apiError.status === 409) {
        setNotice(`${title}: жалоба уже разобрана прежним решением. Показываем актуальный статус.`);
        loadReports(pages.reports);
        return;
      }
      toast({ title: "Решение не принято", description: apiError.message, tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  const queueItems = queue.kind === "ready" ? queue.page.items : [];
  const reportItems = reports.kind === "ready" ? reports.page.items : [];
  const journalItems = journal.kind === "ready" ? journal.page.items : [];

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number }> = [
    { id: "queue", label: "Очередь анкет", icon: <Inbox size={15} />, count: queueItems.length },
    {
      id: "reports",
      label: "Жалобы",
      icon: <MessagesSquare size={15} />,
      count: reportItems.length,
    },
    {
      id: "journal",
      label: "Журнал решений",
      icon: <ScrollText size={15} />,
      count: journalItems.length,
    },
  ];

  return (
    <div className="cabinetPage container">
      <header className="cabinetHead">
        <div>
          <span className="eyebrow">
            <Lock size={13} /> Кабинет модератора
          </span>
          <h1>Модерация каталога</h1>
          <p className="cabinetSub">
            {user ? `Здравствуйте, ${user.name}. ` : ""}
            Очереди приходят с сервера: одно решение на анкету, срок ответа — 2 рабочих дня.
          </p>
        </div>
        <button type="button" className="btn btn--soft btn--sm" onClick={reloadAll}>
          <RefreshCw size={14} /> Обновить
        </button>
      </header>

      {notice ? (
        <p className="cabinetNotice" role="status">
          <Inbox size={16} /> {notice}
        </p>
      ) : null}

      <div className="cabinetTabs" role="tablist" aria-label="Разделы модерации">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`live-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="live-panel"
            className={cn("cabinetTab", tab === item.id && "isActive")}
            onClick={() => setTab(item.id)}
          >
            {item.icon} {item.label}
            <span className="cabinetTabCount">{item.count}</span>
          </button>
        ))}
      </div>

      <div id="live-panel" role="tabpanel" tabIndex={0} aria-labelledby={`live-tab-${tab}`}>
        {tab === "queue" ? (
          <section className="cabinetSection" aria-label="Очередь анкет на проверке">
            <div className="cabinetSectionHead">
              <h2>Очередь на проверке</h2>
              <span className="cabinetPendingNote">
                {queueItems.length}{" "}
                {plural(queueItems.length, "анкета ждёт", "анкеты ждут", "анкет ждут")} ·{" "}
                дольше всех ждёт — выше
              </span>
            </div>
            <SectionView state={queue}>
              {(phase) => (
                <>
                  <ApplicationQueue
                    queue={phase.page.items}
                    pendingId={pending}
                    fieldErrors={appErrors}
                    onDecide={handleDecide}
                  />
                  <Pager phase={phase} section="queue" pages={pages.queue} onPage={goTo} />
                </>
              )}
            </SectionView>
          </section>
        ) : null}

        {tab === "reports" ? (
          <section className="cabinetSection" aria-label="Жалобы на отзывы и медиа">
            <div className="cabinetSectionHead">
              <h2>Жалобы</h2>
              <span className="cabinetPendingNote">
                Текст автора не редактируется — только скрытие с основанием (§12.15).
              </span>
            </div>
            <SectionView state={reports}>
              {(phase) => (
                <>
                  <ReportQueue
                    reports={phase.page.items}
                    pendingId={pending}
                    fieldErrors={reportErrors}
                    onHide={(reportId, input) =>
                      void handleReportDecision(reportId, "hide", input.reason)
                    }
                    onKeep={(reportId) => void handleReportDecision(reportId, "dismiss")}
                  />
                  <Pager phase={phase} section="reports" pages={pages.reports} onPage={goTo} />
                </>
              )}
            </SectionView>
          </section>
        ) : null}

        {tab === "journal" ? (
          <section className="cabinetSection" aria-label="Журнал решений модератора">
            <div className="cabinetSectionHead">
              <h2>Журнал решений</h2>
              <span className="cabinetPendingNote">Только чтение — правки нет (§3.9.4).</span>
            </div>
            <SectionView state={journal}>
              {(phase) => (
                <>
                  <ModerationJournal entries={phase.page.items} />
                  <Pager phase={phase} section="journal" pages={pages.journal} onPage={goTo} />
                </>
              )}
            </SectionView>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Три состояния любой секции: загрузка, отказ сервера, данные. Отдельно —
 * 401 и 403: без входа и не-модератору нужен вход, а не «произошла ошибка».
 */
function SectionView<T>({
  state,
  children,
}: {
  state: SectionState<T>;
  children: (phase: { kind: "ready"; page: ModerationPage<T> }) => React.ReactNode;
}) {
  if (state.kind === "loading") {
    return (
      <div className="cabinetGate" aria-busy="true">
        <span className="cabinetGateIcon">
          <Loader2 size={22} />
        </span>
        <p>Загружаем очередь с сервера…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    const { error } = state;
    if (error.status === 401) {
      return (
        <div className="cabinetGate">
          <span className="cabinetGateIcon">
            <Lock size={22} />
          </span>
          <p>{error.message}</p>
          <div className="cabinetGateActions">
            <Link href="/login?next=%2Fmoderation" className="btn btn--primary">
              Войти модератором
            </Link>
          </div>
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="cabinetGate">
          <span className="cabinetGateIcon">
            <Lock size={22} />
          </span>
          <p>
            {error.message} Кабинет и очереди доступны только модератору: роль сервер читает из
            базы на каждый запрос.
          </p>
        </div>
      );
    }
    return (
      <div className="cabinetGate">
        <span className="cabinetGateIcon">
          <Inbox size={22} />
        </span>
        <p>{error.message}</p>
        <small>
          {error.status === 503
            ? "Серверной очереди модерации нет: витрина собрана без адреса API."
            : "Повторите попытку, когда сервер станет доступен."}
        </small>
      </div>
    );
  }

  return <>{children(state)}</>;
}

/** Страницы списка: сервер отдаёт `total`, и молча обрезать очередь до 20 анкет нельзя. */
function Pager({
  phase,
  section,
  pages,
  onPage,
}: {
  phase: { kind: "ready"; page: ModerationPage<unknown> };
  section: Tab;
  pages: number;
  onPage: (section: Tab, next: number) => void;
}) {
  const total = Math.max(1, Math.ceil(phase.page.total / Math.max(1, phase.page.limit)));
  if (total <= 1) return null;
  const current = Math.min(Math.max(1, pages), total);
  return (
    <div className="cabinetPager">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={current <= 1}
        onClick={() => onPage(section, current - 1)}
      >
        <ChevronLeft size={14} /> Назад
      </button>
      <span>
        {current} из {total}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={current >= total}
        onClick={() => onPage(section, current + 1)}
      >
        Вперёд <ChevronRight size={14} />
      </button>
    </div>
  );
}
