"use client";

import { useState } from "react";
import { CalendarClock, Inbox, PencilLine } from "lucide-react";
import type { Application } from "@/lib/types";
import { getCategoryTitle, plural } from "@/lib/utils";
import { MODERATION_SLA_DAYS } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getCity } from "@/lib/filters";
import { isOverdue, type DecisionInput, type LocationPatch } from "@/lib/moderation";
import { cn } from "@/lib/utils";
import { workingDaysWaiting } from "@/lib/utils";
import { ApplicationPreview } from "@/components/moderation/ApplicationPreview";
import { QuickEditForm, ServiceEditBadge } from "@/components/moderation/QuickEditForm";
import { DecisionForm } from "@/components/moderation/DecisionForm";

interface ApplicationQueueProps {
  queue: Application[];
  editedIds: Set<string>;
  onDecide: (applicationId: string, input: DecisionInput) => void;
  onSaveLocation: (applicationId: string, locationId: string, patch: LocationPatch) => void;
  onSaveDirection: (applicationId: string, categorySlug: string, superSlug: string) => void;
  onEdited: (applicationId: string) => void;
}

export function ApplicationQueue({
  queue,
  editedIds,
  onDecide,
  onSaveLocation,
  onSaveDirection,
  onEdited,
}: ApplicationQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="emptyState">
        <span className="emptyStateIcon">
          <Inbox size={28} />
        </span>
        <h3>Очередь пуста</h3>
        <p>Новых анкет на проверке нет. Как только владелец отправит анкету, она появится здесь.</p>
      </div>
    );
  }

  return (
    <div className="modQueue">
      {queue.map((application) => (
        <QueueCard
          key={application.id}
          application={application}
          edited={editedIds.has(application.id)}
          onDecide={onDecide}
          onSaveLocation={onSaveLocation}
          onSaveDirection={onSaveDirection}
          onEdited={onEdited}
        />
      ))}
    </div>
  );
}

interface QueueCardProps {
  application: Application;
  edited: boolean;
  onDecide: (applicationId: string, input: DecisionInput) => void;
  onSaveLocation: (applicationId: string, locationId: string, patch: LocationPatch) => void;
  onSaveDirection: (applicationId: string, categorySlug: string, superSlug: string) => void;
  onEdited: (applicationId: string) => void;
}

function QueueCard({
  application,
  edited,
  onDecide,
  onSaveLocation,
  onSaveDirection,
  onEdited,
}: QueueCardProps) {
  const [editOpen, setEditOpen] = useState(false);

  const waiting = workingDaysWaiting(application.submittedAt);
  const overdue = isOverdue(application);
  const primaryCity = getCity(application.locations[0]?.citySlug ?? "")?.title;

  return (
    <article className={cn("appRow", "modCard", overdue && "appRow--overdue")}>
      <div className="appRowMain">
        <div className="appRowTop">
          <h3 className="appRowTitle">{application.title}</h3>
          <span className="statusPill statusPill--pending">На проверке</span>
          <ServiceEditBadge edited={edited} />
        </div>

        <p className="appRowMeta">
          {primaryCity ? <span>{primaryCity}</span> : null}
          <span>{getCategoryTitle(application.categorySlug)}</span>
          <span>
            <CalendarClock size={12} /> подана {formatDate(application.submittedAt)}
          </span>
        </p>

        <p className={cn("appRowWait", overdue && "appRowWait--overdue")}>
          Ждёт{" "}
          {waiting} {plural(waiting, "рабочий день", "рабочих дня", "рабочих дней")}
          {overdue
            ? ` — дольше норматива ${MODERATION_SLA_DAYS} рабочих дней`
            : ` (норматив ${MODERATION_SLA_DAYS} рабочих дней)`}
        </p>

        <ApplicationPreview application={application} />

        <div className="modCardTools">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={editOpen}
            onClick={() => setEditOpen((open) => !open)}
          >
            <PencilLine size={14} /> Быстрая правка служебных полей
          </button>
        </div>

        {editOpen ? (
          <QuickEditForm
            application={application}
            onSaveLocation={onSaveLocation}
            onSaveDirection={onSaveDirection}
            onEdited={onEdited}
          />
        ) : null}

        <DecisionForm application={application} onDecide={onDecide} />
      </div>
    </article>
  );
}
