import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Аккаунт в Talentro",
  description:
    "Регистрации с паролем нет: аккаунт появляется при первом входе через Google — с ним доступны избранное, голоса и отзывы.",
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
      <AuthForm intent="register" next={next} />
    </AuthShell>
  );
}
