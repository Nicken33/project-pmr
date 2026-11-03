import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Регистрация",
  description:
    "Создайте аккаунт Talentro: участник — избранное и отзывы, владелец секции или услуги — свои анкеты и профиль организации.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  return (
    <AuthShell>
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
