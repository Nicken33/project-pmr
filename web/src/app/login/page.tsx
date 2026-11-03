import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Вход",
  description: "Войдите в Talentro, чтобы сохранять занятия в избранное, голосовать и писать отзывы.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  return (
    <AuthShell>
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
