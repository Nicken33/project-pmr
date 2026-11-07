"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, Lock, MessagesSquare, ScrollText, ShieldAlert } from "lucide-react";
import type { Application, Blocking, ContentReport, ModerationEntry } from "@/lib/types";
import {
  applications,
  blockReasons,
  blockings as seedBlockings,
  contentReports,
  gapRequests,
  moderationJournal,
  moderationRejectReasons,
  searchGaps,
} from "@/lib/data";
import { plural } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";
import {
  applyDecision,
  applyDirectionEdit,
  applyLocationEdit,
  applyReportDecision,
  makeBlocking,
  pendingQueue,
  validateBlocking,
  type BlockingInput,
  type DecisionInput,
  type LocationPatch,
  type ReportDecisionInput,
} from "@/lib/moderation";
import { ApplicationQueue } from "@/components/moderation/ApplicationQueue";
import { ReportQueue } from "@/components/moderation/ReportQueue";
import { ModerationJournal } from "@/components/moderation/ModerationJournal";
import { GapsSection } from "@/components/moderation/GapsSection";
import { ModerationLive } from "@/components/moderation/ModerationLive";

type Tab = "queue" | "reports" | "journal" | "gaps";

/**
 * Кабинет модерации.
 *
 * `demo` — витрина из локального набора данных: её видит тестировщик (§6), чтобы
 * оценить интерфейс до наполнения каталога, и только если серверной очереди нет.
 * Живой кабинет (`demo === false`) грузит очереди с бэкенда и ничего не выдумывает.
 */
export function ModerationClient({ demo }: { demo: boolean }) {
  if (!demo) return <ModerationLive />;
  return <ModerationDemo />;
}

function ModerationDemo() {
  const { user, ready, toast } = useApp();

  /* Демо-кабинет держит очереди в локальном состоянии: это витрина для тестировщика,
     а не рабочий инструмент. Живые очереди загружает `ModerationLive` — и тоже на
     клиенте: серверный компонент, который передаёт анкеты как пропсы, попадает ими же
     в RSC-поток ответа. */
  const [rows, setRows] = useState<Application[]>(applications);
  const [journal, setJournal] = useState<ModerationEntry[]>(moderationJournal);
  const [reports, setReports] = useState<ContentReport[]>(contentReports);
  const [blockings, setBlockings] = useState<Blocking[]>(seedBlockings);
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("queue");

  const queue = useMemo(() => pendingQueue(rows), [rows]);

  /* `ready` — конец первой клиентской загрузки: до него роль ещё не прочитана, и
     показывать кабинет с чужим именем нельзя. Права при этом решает сервер: роль
     приходит из `GET /api/auth/me`, а очереди отдаёт прокси под той же кукой. */
  if (!ready) {
    return (
      <div className="cabinetGate container">
        <span className="cabinetGateIcon">
          <Loader2 size={24} />
        </span>
        <h1>Кабинет модератора</h1>
        <p>Проверяем доступ…</p>
      </div>
    );
  }

  if (!user || user.role !== "moderator") {
    return (
      <div className="cabinetGate container">
        <span className="cabinetGateIcon">
          <Lock size={24} />
        </span>
        <h1>Кабинет модератора</h1>
        <p>Эта страница доступна модератору. Войдите под учётной записью модератора, чтобы видеть очередь анкет.</p>
        <div className="cabinetGateActions">
          <Link href="/login?next=/moderation" className="btn btn--primary">
            Войти
          </Link>
        </div>
      </div>
    );
  }

  const moderatorName = user.name;
  const actorName = user.name;

  const markEdited = (applicationId: string) =>
    setEditedIds((current) => new Set(current).add(applicationId));

  const handleDecide = (applicationId: string, input: DecisionInput) => {
    const now = new Date().toISOString();
    const result = applyDecision(rows, applicationId, input, moderationRejectReasons, {
      actor: actorName,
      now,
      entryId: `mj-${now}`,
    });
    if (!result.entry) return;
    setRows(result.applications);
    setJournal((current) => [...current, result.entry as ModerationEntry]);
    const title = rows.find((row) => row.id === applicationId)?.title ?? "Анкета";
    if (input.action === "publish") {
      toast({
        title: "Снята с очереди",
        description: `${title} опубликована только в этом интерфейсе: бэкенд не отдаёт статус карточки, поэтому в каталог она не попала.`,
        tone: "success",
      });
    } else {
      toast({
        title: "Отклонена",
        description: `${title} возвращена в черновик с причиной. Отдельного уведомления владельцу нет — POST-эндпоинтов на сервере нет.`,
        tone: "danger",
      });
    }
  };

  const handleSaveLocation = (applicationId: string, locationId: string, patch: LocationPatch) => {
    setRows((current) => applyLocationEdit(current, applicationId, locationId, patch, new Date().toISOString()));
    markEdited(applicationId);
    toast({
      title: "Служебная правка применена",
      description: "Город, район и координаты обновлены локально (§3.9.6). PATCH-эндпоинта нет — правка живёт до перезагрузки.",
    });
  };

  const handleSaveDirection = (applicationId: string, categorySlug: string, superSlug: string) => {
    setRows((current) => applyDirectionEdit(current, applicationId, categorySlug, superSlug, new Date().toISOString()));
    markEdited(applicationId);
  };

  const handleHideReport = (reportId: string, input: ReportDecisionInput) => {
    setReports((current) => applyReportDecision(current, reportId, input, blockReasons));
    toast({
      title: "Запись скрыта локально",
      description: "Причина выбрана из списка §12.15. Показать её автору сервер не может — текста жалобы в API нет.",
      tone: "danger",
    });
  };

  const handleKeepReport = (reportId: string) => {
    setReports((current) => applyReportDecision(current, reportId, { action: "keep" }, blockReasons));
    toast({ title: "Жалоба отклонена", description: "Запись осталась видна." });
  };

  const handleBlock = (input: Required<Pick<BlockingInput, "user" | "reason" | "term">> & { note?: string }) => {
    const validation = validateBlocking(input, blockReasons);
    if (!validation.ok) return;
    const now = new Date().toISOString();
    const blocking = makeBlocking(input, { actor: actorName, now, id: `blk-${now}` });
    setBlockings((current) => [blocking, ...current]);
    toast({
      title: "Блокировка добавлена локально",
      description: `${input.user} · ${input.term}. Сервер не отдаёт 403 (§12.15) — для участника ничего не изменится.`,
      tone: "danger",
    });
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number }> = [
    { id: "queue", label: "Очередь анкет", icon: <Inbox size={15} />, count: queue.length },
    { id: "reports", label: "Жалобы", icon: <MessagesSquare size={15} />, count: reports.filter((r) => r.status === "open").length },
    { id: "journal", label: "Журнал решений", icon: <ScrollText size={15} />, count: journal.length },
    { id: "gaps", label: "Дефициты и заявки", icon: <ShieldAlert size={15} />, count: gapRequests.filter((request) => !request.decision).length },
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
            Здравствуйте, {moderatorName}. Проверяем анкеты целиком: одну публикуем, одну отклоняем с причиной.
            Срок ответа — 2 рабочих дня.
          </p>
        </div>
      </header>

      <p className="cabinetNotice">
        <ShieldAlert size={16} />
        Это демонстрационная витрина кабинета: анкеты и жалобы взяты из локального набора,
        решения живут до перезагрузки страницы и ничего не меняют в каталоге. Настоящие
        очереди — у модератора, вошедшего в аккаунт с ролью модератора.
      </p>

      <div className="cabinetTabs" role="tablist" aria-label="Разделы модерации">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`mod-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="mod-panel"
            className={cn("cabinetTab", tab === item.id && "isActive")}
            onClick={() => setTab(item.id)}
          >
            {item.icon} {item.label}
            <span className="cabinetTabCount">{item.count}</span>
          </button>
        ))}
      </div>

      <div id="mod-panel" role="tabpanel" tabIndex={0} aria-labelledby={`mod-tab-${tab}`}>
      {tab === "queue" ? (
        <section className="cabinetSection" aria-label="Очередь анкет на проверке">
          <div className="cabinetSectionHead">
            <h2>Очередь на проверке</h2>
            <span className="cabinetPendingNote">
              {queue.length} {plural(queue.length, "анкета ждёт", "анкеты ждут", "анкет ждут")} ·{" "}
              дольше всех ждёт — выше
            </span>
          </div>
          <ApplicationQueue
            queue={queue}
            editedIds={editedIds}
            onDecide={handleDecide}
            onSaveLocation={handleSaveLocation}
            onSaveDirection={handleSaveDirection}
            onEdited={markEdited}
          />
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="cabinetSection" aria-label="Жалобы на отзывы и медиа">
          <div className="cabinetSectionHead">
            <h2>Жалобы и блокировки</h2>
            <span className="cabinetPendingNote">Тексты авторов не редактируются — только скрытие.</span>
          </div>
          <ReportQueue
            reports={reports}
            blockings={blockings}
            onHide={handleHideReport}
            onKeep={handleKeepReport}
            onBlock={handleBlock}
          />
        </section>
      ) : null}

      {tab === "journal" ? (
        <section className="cabinetSection" aria-label="Журнал решений модератора">
          <div className="cabinetSectionHead">
            <h2>Журнал решений</h2>
            <span className="cabinetPendingNote">Только чтение — правки нет (§3.9.4).</span>
          </div>
          <ModerationJournal entries={journal} />
        </section>
      ) : null}

      {tab === "gaps" ? (
        <section className="cabinetSection" aria-label="Дефициты и заявки">
          <div className="cabinetSectionHead">
            <h2>Дефициты и заявки</h2>
            <span className="cabinetPendingNote">Что ищут и не находят — план наполнения (§3.12, таблица 17).</span>
          </div>
          <GapsSection gapRequests={gapRequests} searchGaps={searchGaps} />
        </section>
      ) : null}
      </div>
    </div>
  );
}
