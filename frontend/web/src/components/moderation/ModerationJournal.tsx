"use client";

import { Lock } from "lucide-react";
import type { ModerationEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { getOrganization } from "@/lib/utils";
import { groupJournalByDate } from "@/lib/moderation";

/**
 * Журнал всех решений (§8, таблица 11). Видно, но не редактируется (§3.9.4):
 * колонок ровно столько, сколько в типах — ID карточки в моках нет, не выдумываем.
 */
export function ModerationJournal({ entries }: { entries: ModerationEntry[] }) {
  const groups = groupJournalByDate(entries);

  return (
    <div className="modJournal">
      <p className="modPanelNote">
        <Lock size={13} /> Запись добавляется на каждое решение, правки и удаления нет.
      </p>
      {groups.map((group) => (
        <section key={group.date} className="modJournalGroup">
          <h3 className="modJournalDate">{formatDate(group.date)}</h3>
          <div className="modTableWrap">
            <table className="modTable">
              <thead>
                <tr>
                  <th scope="col">Анкета</th>
                  <th scope="col">Кто проверял</th>
                  <th scope="col">Решение</th>
                  <th scope="col">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="modJournalTitle">{entry.applicationTitle}</span>
                      <small className="modJournalOrg">
                        {getOrganization(entry.organizationSlug)?.name ?? entry.organizationSlug}
                      </small>
                    </td>
                    <td>{entry.actor}</td>
                    <td>
                      <span className={entry.decision === "published" ? "modVerdict modVerdict--ok" : "modVerdict modVerdict--no"}>
                        {entry.decision === "published" ? "Опубликовано" : "Отклонено"}
                      </span>
                    </td>
                    <td className="modJournalComment">{entry.comment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
