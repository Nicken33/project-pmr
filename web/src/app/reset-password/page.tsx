import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Восстановление пароля — Talentro",
  description: "Установка нового пароля для учетной записи Talentro",
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="container authLayout" style={{ padding: "40px 16px" }}>
      <Suspense fallback={<div className="authCard surface" style={{ maxWidth: "480px", margin: "0 auto" }}><p className="muted">Загрузка формы сброса…</p></div>}>
        <ResetPasswordClient />
      </Suspense>
    </main>
  );
}
