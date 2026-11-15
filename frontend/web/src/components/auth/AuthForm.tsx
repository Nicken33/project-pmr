"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { safeInternalPath } from "@/lib/navigation";
import { useGoogleLogin } from "@react-oauth/google";

/**
 * Единственная форма входа.
 *
 * Почту и пароль сервер умеет с 2026-11-05: `POST /api/auth/register` и
 * `POST /api/auth/login` (`internal/delivery/http/handlers/auth_local.go`)
 * выдают ту же подписанную куку, что вход через Google. Поля здесь настоящие, а
 * подсказки к ним — те, что возвращает сервер: локальную валидацию не дублируем,
 * иначе текст формы разошёлся бы с §3.7 и начал спорить с тем самым полем,
 * которое сервер посчитал неверным.
 */
export function AuthForm({ next = "/", intent = "login" }: { next: string; intent?: "login" | "register" }) {
  const router = useRouter();
  const { user, loginWithGoogle, loginWithTesterToken, loginWithEmail, registerWithEmail } = useApp();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [pendingTester, setPendingTester] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotPending, setForgotPending] = useState(false);

  /* `next` приходит из адресной строки, поэтому проверяется здесь, а не только на
     странице: этот компонент вызывает навигацию, и новый вызов не должен
     полагаться на добросовестность того, кто передал проп. */
  const target = safeInternalPath(next);

  const triggerGoogleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      if (!tokenResponse.access_token) {
        setFormError("Google не вернул данные аккаунта. Попробуйте ещё раз.");
        return;
      }
      setPending(true);
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        if (!userInfoRes.ok) {
          throw new Error("Не удалось получить профиль от Google");
        }
        // Пересылаем токен для авторизации
        const result = await loginWithGoogle(tokenResponse.access_token);
        setPending(false);
        if (!result.ok) {
          setFormError(result.error ?? "Не удалось войти через Google.");
          return;
        }
        router.push(target);
      } catch (err) {
        setPending(false);
        setFormError(String(err) || "Ошибка при входе через Google");
      }
    },
    onError: () => setFormError("Не удалось войти через Google. Попробуйте ещё раз."),
  });

  const handleGoogleClick = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setFormError("Вход через Google недоступен: не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
      return;
    }
    setFormError("");
    try {
      triggerGoogleLogin();
    } catch {
      // Прямой переход если хук заблокирован браузером
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const redirectUri = `${siteUrl}/api/auth/google/callback`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid%20email%20profile`;
      window.location.href = googleAuthUrl;
    }
  };

  if (user) {
    return (
      <div className="authCard surface">
        <span className="authDoneIcon">
          <ShieldCheck size={26} />
        </span>
        <h2>Вы уже вошли</h2>
        <p className="muted">Аккаунт {user.email || user.name}. Можно вернуться к каталогу.</p>
        <div className="authActions">
          <Link className="btn btn--primary btn--lg btn--block" href={target}>
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    setPending(true);
    const result =
      intent === "register"
        ? await registerWithEmail(email, password, name)
        : await loginWithEmail(email, password);
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setFieldErrors(result.fieldErrors);
      }
      setFormError(
        result.retryAfterSeconds
          ? `${result.error ?? "Слишком много попыток"}. Попробуйте через ${result.retryAfterSeconds} сек.`
          : result.error ?? "Не удалось войти. Проверьте данные.",
      );
      return;
    }
    router.push(target);
  };

  const submitTester = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setPendingTester(true);
    const result = await loginWithTesterToken(token.trim());
    setPendingTester(false);
    if (!result.ok) {
      setFormError(
        result.retryAfterSeconds
          ? `${result.error ?? "Слишком много попыток"}. Попробуйте через ${result.retryAfterSeconds} сек.`
          : result.error ?? "Неверный токен тестировщика",
      );
      return;
    }
    router.push(target);
  };

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!email.trim()) {
      setFormError("Укажите адрес электронной почты");
      return;
    }
    setForgotPending(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setForgotPending(false);
      if (res.ok) {
        setForgotSent(true);
      } else {
        setFormError(data?.error?.message || data?.message || "Не удалось отправить запрос на сброс пароля");
      }
    } catch {
      setForgotPending(false);
      setFormError("Ошибка соединения с сервером");
    }
  };

  if (isForgot) {
    return (
      <div className="authCard surface">
        <h2>Восстановление пароля</h2>
        <p className="authLead">
          {forgotSent
            ? "Инструкция по восстановлению отправлена."
            : "Введите почту вашего аккаунта, и мы отправим ссылку для смены пароля."}
        </p>

        {formError ? (
          <div className="authErrorBanner" role="alert">
            {formError}
          </div>
        ) : null}

        {forgotSent ? (
          <div className="authSuccessBlock" style={{ marginTop: "16px", textAlign: "center" }}>
            <p className="muted" style={{ marginBottom: "20px" }}>
              Если аккаунт с адресом <b>{email}</b> зарегистрирован, проверьте входящие письма (и папку «Спам»).
            </p>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => {
                setIsForgot(false);
                setForgotSent(false);
                setFormError("");
              }}
            >
              Вернуться ко входу
            </button>
          </div>
        ) : (
          <form className="authForm" onSubmit={submitForgot} noValidate>
            <div className="authField">
              <label className="fieldLabel" htmlFor="forgot-email">
                Почта аккаунта
              </label>
              <div className="authInputWrap">
                <Mail size={17} />
                <input
                  id="forgot-email"
                  type="email"
                  className="fieldInput"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={forgotPending}>
              {forgotPending ? "Отправляем…" : "Отправить ссылку"}
            </button>

            <div style={{ marginTop: "16px", textAlign: "center" }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setIsForgot(false);
                  setFormError("");
                }}
              >
                ← Вернуться ко входу
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="authCard surface">
      <h2>{intent === "register" ? "Аккаунт в Talentro" : "Вход в Talentro"}</h2>
      <p className="authLead">
        {intent === "register"
          ? "Почта и пароль — либо вход через Google, тогда аккаунт создаётся сам. С аккаунтом доступны избранное, голоса и отзывы."
          : "Избранное, голоса и отзывы — под одним аккаунтом. Каталог доступен и без входа."}
      </p>

      <form className="authForm" onSubmit={submitEmail} noValidate>
        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-email">
            Почта
          </label>
          <div className="authInputWrap">
            <Mail size={17} />
            <input
              id="auth-email"
              type="email"
              className={fieldErrors.email ? "fieldInput fieldInput--error" : "fieldInput"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
            />
          </div>
          {fieldErrors.email ? (
            <p className="formHint formHint--error" id="auth-email-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        {intent === "register" ? (
          <div className="authField">
            <label className="fieldLabel" htmlFor="auth-name">
              Как вас называть <span>можно не заполнять</span>
            </label>
            <div className="authInputWrap">
              <ShieldCheck size={17} />
              <input
                id="auth-name"
                type="text"
                className="fieldInput"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Иван"
                autoComplete="name"
              />
            </div>
          </div>
        ) : null}

        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-password">
            Пароль
          </label>
          <div className="authInputWrap">
            <Lock size={17} />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className={fieldErrors.password ? "fieldInput fieldInput--error" : "fieldInput"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="не короче 8 символов"
              autoComplete={intent === "register" ? "new-password" : "current-password"}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
            />
            <button
              type="button"
              className="passwordToggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="formHint formHint--error" id="auth-password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {intent === "login" ? (
          <div style={{ textAlign: "right", marginTop: "-6px", marginBottom: "14px" }}>
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "12px",
                color: "var(--accent)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
              onClick={() => {
                setIsForgot(true);
                setFormError("");
                setForgotSent(false);
              }}
            >
              Забыли пароль?
            </button>
          </div>
        ) : null}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Проверяем…" : intent === "register" ? "Создать аккаунт" : "Войти"}
        </button>
      </form>

      <p className="authOr">или через Google</p>

      <div className="authSocial">
        <button
          type="button"
          className="btn btn--outline btn--block"
          onClick={handleGoogleClick}
          disabled={pending}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
            />
          </svg>
          Войти через Google
        </button>
      </div>

      <p className="formHint">
        Входя, вы принимаете <Link href="/terms">условия использования</Link> и{" "}
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
        <button type="submit" className="btn btn--outline btn--block" disabled={pendingTester}>
          {pendingTester ? "Проверяем…" : "Войти для проверки"}
        </button>
      </form>

      <div className="authSwitch">
        <Link href="/" className="authBack">
          <ArrowLeft size={16} /> В каталог без входа
        </Link>
        {intent === "register" ? (
          <p className="authSwitchText">
            Уже есть аккаунт? <Link href={`/login?next=${encodeURIComponent(target)}`}>Войти</Link>
          </p>
        ) : (
          <p className="authSwitchText">
            Нет аккаунта? <Link href={`/register?next=${encodeURIComponent(target)}`}>Создать</Link>
          </p>
        )}
      </div>
    </div>
  );
}
