"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { OwnerCardEditor } from "@/components/account/OwnerCardEditor";
import { fetchMyOrganization, type OwnedOrganization, toOwnerError } from "@/lib/owner-api";
import type { ActivityKind } from "@/lib/types";

export function OwnerActivityEditClient({
  id,
  sessionRole,
}: {
  id: string;
  sessionRole?: string;
}) {
  const router = useRouter();
  const [orgState, setOrgState] = useState<{
    kind: "loading" | "ready" | "error";
    org: OwnedOrganization | null;
  }>({ kind: "loading", org: null });

  const kind: ActivityKind =
    sessionRole === "owner_service" || sessionRole === "service_owner"
      ? "service"
      : "activity";

  useEffect(() => {
    let alive = true;
    fetchMyOrganization()
      .then((org) => {
        if (!alive) return;
        setOrgState({ kind: "ready", org });
      })
      .catch((err) => {
        if (!alive) return;
        // Даже если организации пока нет, форму редактирования секции открывать можно
        toOwnerError(err);
        setOrgState({ kind: "ready", org: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (orgState.kind === "loading") {
    return (
      <div className="container" style={{ padding: "60px 16px", textAlign: "center" }}>
        <Loader2 className="spinner" size={32} style={{ margin: "0 auto 12px" }} />
        <p style={{ color: "var(--muted)", fontSize: "15px" }}>Загрузка редактора секции…</p>
      </div>
    );
  }

  const numericOrgId = orgState.org && orgState.org.id ? Number(orgState.org.id) : undefined;

  return (
    <div className="cabinetPage container" style={{ paddingBottom: "60px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/account"
          className="btn btn--ghost btn--sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={16} /> Назад в кабинет
        </Link>
      </div>

      <OwnerCardEditor
        id={id}
        kind={kind}
        orgId={numericOrgId}
        cityId={orgState.org?.city_id ?? undefined}
        orgPhase={orgState.kind}
        onCreated={() => {}}
        onSaved={() => {
          router.push("/account");
        }}
        onClose={() => {
          router.back();
        }}
      />
    </div>
  );
}
