"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Application } from "@/lib/types";
import { moderationRejectReasons } from "@/lib/data";
import { validateDecision, type DecisionInput } from "@/lib/moderation";

interface DecisionFormProps {
  application: Application;
  onDecide: (applicationId: string, input: DecisionInput) => void;
}

/**
 * Кнопки «опубликовать» и «отклонить» — одно решение на карточку целиком (§3.9.3, §3.9.6).
 * Для отказа обязателен пункт типового списка + свободный текст; для публикации причина не нужна.
 */
export function DecisionForm({ application, onDecide }: DecisionFormProps) {
  const [panel, setPanel] = useState<null | "reject">(null);
  const [reason, setReason] = useState(moderationRejectReasons[0]);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const publish = () => {
    setPanel(null);
    setErrors([]);
    onDecide(application.id, { action: "publish" });
  };

  const confirmReject = () => {
    const input: DecisionInput = { action: "reject", reason, comment };
    const validation = validateDecision(input, moderationRejectReasons);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setPanel(null);
    setComment("");
    onDecide(application.id, input);
  };

  return (
    <div className="modDecision">
      <div className="modDecisionRow">
        <button type="button" className="btn btn--primary" onClick={publish}>
          <Check size={16} /> Опубликовать
        </button>
        <button
          type="button"
          className="btn btn--danger"
          aria-expanded={panel === "reject"}
          onClick={() => {
            setPanel((current) => (current === "reject" ? null : "reject"));
            setErrors([]);
          }}
        >
          <X size={16} /> Отклонить
        </button>
      </div>

      {panel === "reject" ? (
        <div className="modRejectPanel">
          <p className="modPanelNote">Выберите типовую причину и добавьте пояснение владельцу.</p>
          <fieldset className="modReasons">
            <legend className="modLabel">Типовая причина отказа</legend>
            {moderationRejectReasons.map((item) => (
              <label key={item} className="modReason">
                <input
                  type="radio"
                  name={`${application.id}-reason`}
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>

          <label className="modLabel" htmlFor={`${application.id}-comment`}>
            Свободный текст владельцу
          </label>
          <textarea
            id={`${application.id}-comment`}
            className="textarea textarea--sm"
            rows={2}
            value={comment}
            placeholder="Что именно исправиться — коротко и по-человечески"
            onChange={(event) => setComment(event.target.value)}
          />

          {errors.length ? (
            <p className="modError" role="alert">
              {errors.join(" ")}
            </p>
          ) : null}

          <div className="modDecisionRow">
            <button type="button" className="btn btn--danger" onClick={confirmReject}>
              <X size={16} /> Подтвердить отказ
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setPanel(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
