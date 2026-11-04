"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { GoogleLogin } from "@react-oauth/google";

/**
 * Единственная форма входа.
 *
 * Почты и пароля у продукта нет: `backend/Talentro` знает только Google-токен и
 * токен тестировщика, поэтому поля «email + пароль» здесь были бы обещанием,
 * которое сервер не выполнит. Аккаунт появляется сам при первом входе через
 * Google — отдельной регистрации тоже нет.
 */
export function AuthForm({ next = "/", intent = "login" }: { next: string; intent?: "login" | "register" }) {
  const router = useRouter();
  const { user, loginWithGoogle, loginWithTesterToken } = useApp();
  const [token, setToken] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  if (user) {
    return (
      <div className="authCard surface">
        <span className="authDoneIcon">
          <ShieldCheck size={26} />
        </span>
        <h2>Вы уже вошли</h2>
        <p className="muted">Аккаунт {user.email || user.name}. Можно вернуться к каталогу.</p>
        <div className="authActions">
          <Link className="btn btn--primary btn--lg btn--block" href={next}>
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const submitTester = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (token.trim().length === 0) {
      setFormError("Введите токен тестировщика — его выдаёт координатор проверки.");
      return;
    }
    setPending(true);
    const result = await loginWithTesterToken(token.trim());
    setPending(false);
    if (!result.ok) {
      setFormError(result.error ?? "Сервер не принял токен.");
      return;
    }
    router.push(next);
  };

  return (
    <div className="authCard surface">
      <h2>{intent === "register" ? "Как появился бы аккаунт" : "Вход в Talentro"}</h2>
      <p className="authLead">
        {intent === "register"
          ? "Регистрации с паролем нет. Аккаунт создаётся сам при первом входе через Google — с ним доступны избранное, голоса и отзывы."
          : "Избранное, голоса и отзывы — под одним аккаунтом. Каталог доступен и без входа."}
      </p>

      <div className="authSocial">
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
          <GoogleLogin
            onSuccess={async (response) => {
              if (!response.credential) {
                setFormError("Google не вернул данные аккаунта. Попробуйте ещё раз.");
                return;
              }
              setPending(true);
              const result = await loginWithGoogle(response.credential);
              setPending(false);
              if (!result.ok) {
                setFormError(result.error ?? "Не удалось войти через Google.");
                return;
              }
              router.push(next);
            }}
            onError={() => setFormError("Не удалось войти через Google. Попробуйте ещё раз.")}
            text="signin_with"
            theme="outline"
            size="large"
            width="100%"
          />
        ) : (
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() =>
              setFormError("Вход через Google недоступен: не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID.")
            }
          >
            <LogIn size={17} /> Войти через Google
          </button>
        )}
      </div>

      <p className="formHint">
        Входя через Google, вы принимаете{" "}
        <Link href="/terms">условия использования</Link> и{" "}
        <Link href="/privacy">обработку данных</Link>.
      </p>

      {formError ? (
        <p className="authError" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="authForm" onSubmit={submitTester} noValidate>
        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-tester-token">
            Токен тестировщика <span>для проверки витрины</span>
          </label>
          <div className="authInputWrap">
            <KeyRound size={17} />
            <input
              id="auth-tester-token"
              type="password"
              className="fieldInput"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="выдаётся координатором проверки"
              autoComplete="off"
            />
          </div>
          <p className="formHint">
            Даёт доступ к демонстрационным разделам кабинета и модерации; наполнение из базы он не меняет.
          </p>
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Проверяем…" : "Войти для проверки"}
        </button>
      </form>

      <div className="authSwitch">
        <Link href={intent === "login" ? "/register" : "/login"} className="linkButton">
          {intent === "login" ? "Как создаётся аккаунт?" : "Уже есть аккаунт? Войти"}
        </Link>
        <Link href="/" className="authBack">
          <ArrowLeft size={14} /> Вернуться в каталог
        </Link>
      </div>
    </div>
  );
}
