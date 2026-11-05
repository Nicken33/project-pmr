import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { safeInternalPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Аккаунт в Talentro",
  description:
    "Аккаунт по почте и паролю или через Google — с ним доступны избранное, голоса и отзывы.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);
  return (
    <AuthShell>
      <AuthForm intent="register" next={next} />
    </AuthShell>
  );
}
