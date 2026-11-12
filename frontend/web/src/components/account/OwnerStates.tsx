"use client";

import Link from "next/link";
import { Loader2, Lock, ShieldAlert, Store } from "lucide-react";
import type { OwnerApiError } from "@/lib/owner-api";

/**
 * Состояния живого кабинета. Отказ сервера показывается его текстом и его
 * кодом: 403 не превращается в «произошла ошибка», а 503 не рисуется как пустой
 * список — иначе витрина без адреса API выглядела бы как кабинет без карточек.
 */
export function OwnerLoading({ label }: { label: string }) {
  return (
    <div className="cabinetGate" aria-busy="true">
      <span className="cabinetGateIcon">
        <Loader2 size={22} />
      </span>
      <p>{label}</p>
    </div>
  );
}

export function OwnerErrorView({
  error,
  notFound,
}: {
  error: OwnerApiError;
  /** Что означает 404 именно здесь: нет организации или нет карточки. */
  notFound?: string;
}) {
  if (error.status === 401) {
    return (
      <div className="cabinetGate">
        <span className="cabinetGateIcon">
          <Lock size={22} />
        </span>
        <p>{error.message}</p>
        <small>Ответ 401: сессия не найдена или истекла.</small>
        <div className="cabinetGateActions">
          <Link href="/login?next=%2Faccount" className="btn btn--primary">
            Войти
          </Link>
        </div>
      </div>
    );
  }

  if (error.status === 403) {
    return (
      <div className="cabinetGate">
        <span className="cabinetGateIcon">
          <ShieldAlert size={22} />
        </span>
        <p>{error.message}</p>
        <small>
          Ответ 403: сервер отказал. Кабинет открыт только владельцу — owner_activity для занятий и
          owner_service для услуг; чужую карточку сервер не отдаёт и не правит.
        </small>
      </div>
    );
  }

  if (error.status === 404 && notFound) {
    return (
      <div className="cabinetGate">
        <span className="cabinetGateIcon">
          <Store size={22} />
        </span>
        <p>{notFound}</p>
        <small>Ответ 404: {error.message}</small>
      </div>
    );
  }

  if (error.status === 503) {
    return (
      <div className="cabinetGate">
        <span className="cabinetGateIcon">
          <Store size={22} />
        </span>
        <p>{error.message}</p>
        <small>
          Ответ 503: адрес бэкенда не настроен (NEXT_PUBLIC_API_URL) либо сессии на сервере не
          включены. Демонстрационные анкеты вместо настоящих мы не показываем.
        </small>
      </div>
    );
  }

  return (
    <div className="cabinetGate">
      <span className="cabinetGateIcon">
        <ShieldAlert size={22} />
      </span>
      <p>{error.message}</p>
      <small>
        {error.status === 0
          ? "Сервер кабинета не отвечает — повторите попытку позже."
          : `Ответ ${error.status}. Повторите попытку, когда сервер станет доступен.`}
      </small>
    </div>
  );
}

/** Ошибки полей из конверта §9 — под самим полем, а не общей строкой. */
export function fieldHint(errors: Record<string, string>, name: string): string | null {
  return errors[name] ?? null;
}