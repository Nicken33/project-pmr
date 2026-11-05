"use client";

import type { GapRequest, SearchGap } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";
import { getCity } from "@/lib/filters";

const decisionLabels: Record<string, string> = {
  taken: "взяли в работу",
  exists: "уже есть",
  rejected: "не берём",
};

function cityTitle(slug?: string) {
  if (!slug) return "все города";
  return getCity(slug)?.title ?? slug;
}

/** Дефициты каталога (§3.12, таблица 17, §15 п.19): заявки «не нашли занятие» и топ пустых запросов. */
export function GapsSection({
  gapRequests,
  searchGaps,
}: {
  gapRequests: GapRequest[];
  searchGaps: SearchGap[];
}) {
  const openRequests = gapRequests.filter((request) => !request.decision);

  return (
    <div className="modGaps">
      <section className="modJournalGroup">
        <h3>Заявки «не нашли занятие»</h3>
        <p className="modPanelNote">
          {openRequests.length}{" "}
          {plural(openRequests.length, "заявка без ответа", "заявки без ответа", "заявок без ответа")} из{" "}
          {gapRequests.length}.
        </p>
        <div className="modTableWrap">
          <table className="modTable">
            <thead>
              <tr>
                <th scope="col">Что ищут</th>
                <th scope="col">Город</th>
                <th scope="col">Когда</th>
                <th scope="col">Решение</th>
              </tr>
            </thead>
            <tbody>
              {gapRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.query}</td>
                  <td>{cityTitle(request.citySlug)}</td>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>
                    {request.decision ? (
                      <span className="modVerdict modVerdict--ok">{decisionLabels[request.decision]}</span>
                    ) : (
                      <span className="modVerdict modVerdict--wait">в очереди</span>
                    )}
                    {request.note ? <small className="modJournalComment">{request.note}</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modJournalGroup">
        <h3>Топ пустых запросов</h3>
        <p className="modPanelNote">
          Демо-выборка: счётчика пустых запросов на сервере нет, недельное окно (§15 п.19) считает бэкенд.
        </p>
        <div className="modTableWrap">
          <table className="modTable">
            <thead>
              <tr>
                <th scope="col">Запрос</th>
                <th scope="col">Город</th>
                <th scope="col">Промахов</th>
                <th scope="col">Последний раз</th>
              </tr>
            </thead>
            <tbody>
              {searchGaps.map((gap) => (
                <tr key={`${gap.query}-${gap.citySlug ?? "all"}`}>
                  <td>{gap.query}</td>
                  <td>{cityTitle(gap.citySlug)}</td>
                  <td>{gap.misses}</td>
                  <td>{formatDate(gap.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
