"use client";

import { useState } from "react";
import { Ban, ChevronDown, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import type { Blocking, ContentReport } from "@/lib/types";
import { blockReasons } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import {
  validateBlocking,
  validateReportDecision,
  type BlockingInput,
  type ReportDecisionInput,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";

const typeLabels: Record<ContentReport["targetType"], string> = {
  review: "отзыв",
  comment: "комментарий",
  media: "фото или видео",
  card: "карточка",
};

interface ReportQueueProps {
  reports: ContentReport[];
  blockings: Blocking[];
  onHide: (reportId: string, input: ReportDecisionInput) => void;
  onKeep: (reportId: string) => void;
  onBlock: (input: Required<Pick<BlockingInput, "user" | "reason" | "term">> & { note?: string }) => void;
}

export function ReportQueue({ reports, blockings, onHide, onKeep, onBlock }: ReportQueueProps) {
  const open = reports.filter((report) => report.status === "open");

  // Блокировки (§12.15) остаются и когда открытых жалоб нет: иначе список
  // «кого заблокировали» пропал бы вместе с очередью, и снять блокировку было бы нельзя.
  const blockingList = blockings.length ? (
    <section className="modBlockingList" aria-label="Текущие блокировки">
      <h3>Текущие блокировки</h3>
      <ul>
        {blockings.map((blocking) => (
          <li key={blocking.id} className="modBlockingRow">
            <span>
              <b>{blocking.user}</b> · {blocking.term}
            </span>
            <small>
              {blocking.reason}
              {blocking.note ? ` — ${blocking.note}` : ""} · {blocking.actor},{" "}
              {formatDate(blocking.createdAt)}
            </small>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  if (open.length === 0) {
    return (
      <>
        <div className="emptyState">
          <span className="emptyStateIcon">
            <ShieldCheck size={28} />
          </span>
          <h3>Жалоб без ответа нет</h3>
          <p>Все жалобы на отзывы, комментарии и медиа разобраны.</p>
        </div>
        {blockingList}
      </>
    );
  }

  return (
    <div className="modQueue">
      {open.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          onHide={onHide}
          onKeep={onKeep}
          onBlock={onBlock}
        />
      ))}

      {blockingList}
    </div>
  );
}

interface ReportCardProps {
  report: ContentReport;
  onHide: (reportId: string, input: ReportDecisionInput) => void;
  onKeep: (reportId: string) => void;
  onBlock: (input: Required<Pick<BlockingInput, "user" | "reason" | "term">> & { note?: string }) => void;
}

function ReportCard({ report, onHide, onKeep, onBlock }: ReportCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [panel, setPanel] = useState<null | "hide" | "block">(null);
  const [hideReason, setHideReason] = useState(blockReasons[0]);
  const [blockTerm, setBlockTerm] = useState<Blocking["term"]>("7 дней");
  const [blockReason, setBlockReason] = useState(blockReasons[0]);
  const [blockNote, setBlockNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const submitHide = () => {
    const input: ReportDecisionInput = { action: "hide", reason: hideReason };
    const validation = validateReportDecision(input, blockReasons);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setPanel(null);
    onHide(report.id, input);
  };

  const submitBlock = () => {
    const input: BlockingInput = {
      user: report.author,
      reason: blockReason,
      term: blockTerm,
      note: blockNote,
    };
    const validation = validateBlocking(input, blockReasons);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setPanel(null);
    setBlockNote("");
    onBlock({ user: report.author, reason: blockReason, term: blockTerm, note: blockNote });
  };

  return (
    <article className="appRow modCard">
      <div className="appRowMain">
        <div className="appRowTop">
          <span className="statusPill statusPill--pending">
            Жалоба · {typeLabels[report.targetType]}
          </span>
          <span className="modReportAuthor">Автор: {report.author}</span>
        </div>

        <p className="appRowMeta">
          <span>{report.reason}</span>
          <span>
            <Link href={`/activities/${report.activitySlug}`} className="sectionLink">
              {report.activityTitle}
            </Link>
          </span>
          <span>{formatDate(report.createdAt)}</span>
        </p>

        <button
          type="button"
          className={cn("cardMetaButton", previewOpen && "isOpen")}
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}
        >
          <span>
            <ChevronDown size={14} /> Показать запись целиком
          </span>
        </button>
        {previewOpen ? (
          <blockquote className="modExcerpt">
            {report.targetExcerpt}
            {report.detail ? <p className="modExcerptDetail">{report.detail}</p> : null}
            <footer className="modExcerptFoot">Текст автора модератор не редактирует — только скрывает.</footer>
          </blockquote>
        ) : null}

        <div className="modDecisionRow">
          <button
            type="button"
            className="btn btn--danger"
            aria-expanded={panel === "hide"}
            onClick={() => {
              setPanel((current) => (current === "hide" ? null : "hide"));
              setErrors([]);
            }}
          >
            <X size={16} /> Скрыть с причиной
          </button>
          <button type="button" className="btn btn--soft" onClick={() => onKeep(report.id)}>
            Оставить
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            aria-expanded={panel === "block"}
            onClick={() => {
              setPanel((current) => (current === "block" ? null : "block"));
              setErrors([]);
            }}
          >
            <Ban size={15} /> Заблокировать участника
          </button>
        </div>

        {panel === "hide" ? (
          <div className="modRejectPanel">
            <label className="modLabel" htmlFor={`${report.id}-hide`}>
              Причина скрытия (видна автору)
            </label>
            <select
              id={`${report.id}-hide`}
              className="fieldSelect"
              value={hideReason}
              onChange={(event) => setHideReason(event.target.value)}
            >
              {blockReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {renderErrors(errors)}
            <div className="modDecisionRow">
              <button type="button" className="btn btn--danger" onClick={submitHide}>
                Скрыть запись
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPanel(null)}>
                Отмена
              </button>
            </div>
          </div>
        ) : null}

        {panel === "block" ? (
          <div className="modRejectPanel">
            <p className="modPanelNote">Блокировка {report.author} (§12.15, таблица 15).</p>
            <div className="modEditGrid">
              <div className="modField">
                <label className="modLabel" htmlFor={`${report.id}-term`}>
                  Срок
                </label>
                <select
                  id={`${report.id}-term`}
                  className="fieldSelect"
                  value={blockTerm}
                  onChange={(event) => setBlockTerm(event.target.value as Blocking["term"])}
                >
                  <option value="7 дней">7 дней</option>
                  <option value="навсегда">навсегда</option>
                </select>
              </div>
              <div className="modField">
                <label className="modLabel" htmlFor={`${report.id}-blockreason`}>
                  Основание
                </label>
                <select
                  id={`${report.id}-blockreason`}
                  className="fieldSelect"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                >
                  {blockReasons.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="modLabel" htmlFor={`${report.id}-blocknote`}>
              Свободный текст (необязательно)
            </label>
            <textarea
              id={`${report.id}-blocknote`}
              className="textarea textarea--sm"
              rows={2}
              value={blockNote}
              onChange={(event) => setBlockNote(event.target.value)}
            />
            {renderErrors(errors)}
            <div className="modDecisionRow">
              <button type="button" className="btn btn--danger" onClick={submitBlock}>
                <Ban size={15} /> Заблокировать
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPanel(null)}>
                Отмена
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function renderErrors(errors: string[]) {
  if (!errors.length) return null;
  return (
    <p className="modError" role="alert">
      {errors.join(" ")}
    </p>
  );
}
