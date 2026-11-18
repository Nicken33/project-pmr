"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Building, Eye, EyeOff, Lock, Mail, ShieldCheck, Store, User } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { safeInternalPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { verifyAuthSession } from "@/lib/auth-client";
import { useGoogleLogin, useGoogleOAuth, type UseGoogleLoginOptionsImplicitFlow } from "@react-oauth/google";

interface GoogleButtonProps {
  options: UseGoogleLoginOptionsImplicitFlow;
  pending: boolean;
  onBegin: () => boolean;
  onOpenFailure: () => void;
  onUnavailable: () => void;
  children: ReactNode;
}

// Missing Google configuration must not break email/password login.
function GoogleSignInButton(props: GoogleButtonProps) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <button type="button" className="btn btn--outline btn--lg authGoogleButton" disabled={props.pending} onClick={props.onUnavailable}>{props.children}</button>;
  }
  return <ConfiguredGoogleButton {...props} />;
}

function ConfiguredGoogleButton(props: GoogleButtonProps) {
  const trigger = useGoogleLogin(props.options);
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  return (
    <button type="button" className="btn btn--outline btn--lg authGoogleButton"
      disabled={props.pending || !scriptLoadedSuccessfully}
      onClick={() => {
        if (!props.onBegin()) return;
        try { trigger(); } catch { props.onOpenFailure(); }
      }}>
      {props.children}
    </button>
  );
}

/**
 * Единственная форма входа.
 *
 * Почту и пароль сервер умеет с 2026-11-05: `POST /api/auth/register` и
 * `POST /api/auth/login` (`internal/delivery/http/handlers/auth_local.go`)
 * выдают ту же подписанную куку, что вход через Google. Сервер остаётся
 * источником истины, а обязательные поля регистрации проверяются и до запроса.
 */
export function AuthForm({ next = "/", intent = "login" }: { next: string; intent?: "login" | "register" }) {
  const router = useRouter();
  const { user, loginWithGoogle, loginWithEmail, registerWithEmail } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"user" | "section_owner" | "service_owner">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const pendingAction = useRef(false);
  const [sessionUnconfirmed, setSessionUnconfirmed] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotPending, setForgotPending] = useState(false);
  const [googleCredentialForSignup, setGoogleCredentialForSignup] = useState("");
  const [googleSignupEmail, setGoogleSignupEmail] = useState("");

  /* `next` приходит из адресной строки, поэтому проверяется здесь, а не только на
     странице: этот компонент вызывает навигацию, и новый вызов не должен
     полагаться на добросовестность того, кто передал проп. */
  const target = safeInternalPath(next);

  const googleOptions: UseGoogleLoginOptionsImplicitFlow = {
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      if (!tokenResponse.access_token) {
        pendingAction.current = false;
        setPending(false);
        setFormError("Google не вернул данные аккаунта. Попробуйте ещё раз.");
        return;
      }
      setPending(true);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        setPending(false);
        if (result.needsAccountType) {
          setGoogleCredentialForSignup(tokenResponse.access_token);
          setGoogleSignupEmail(result.googleEmail ?? "");
          setFormError("");
          return;
        }
        if (!result.ok) {
          setSessionUnconfirmed(Boolean(result.sessionUnconfirmed));
          setFormError(result.error ?? "Не удалось войти через Google.");
          return;
        }
        router.push(target);
      } catch {
        setFormError("Не удалось завершить вход через Google. Попробуйте ещё раз.");
      } finally {
        pendingAction.current = false;
        setPending(false);
      }
    },
    onError: () => {
      pendingAction.current = false;
      setPending(false);
      setFormError("Не удалось войти через Google. Попробуйте ещё раз.");
    },
    onNonOAuthError: (error) => {
      pendingAction.current = false;
      setPending(false);
      if (error.type !== "popup_closed") setFormError("Не удалось открыть окно Google. Разрешите всплывающие окна и повторите вход.");
    },
  };

  const handleGoogleClick = (): boolean => {
    if (pendingAction.current) return false;
    setFormError("");
    pendingAction.current = true;
    setPending(true);
    return true;
  };

  const googleOpenFailure = () => {
    pendingAction.current = false;
    setPending(false);
    setFormError("Не удалось открыть окно Google. Разрешите всплывающие окна и повторите вход.");
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
    if (pendingAction.current) return;
    setFormError("");
    setFieldErrors({});
    if (intent === "register" && !name.trim()) {
      setFieldErrors({ name: "Укажите, как к вам обращаться." });
      return;
    }
    pendingAction.current = true;
    setPending(true);
    let result;
    try {
      result = intent === "register"
        ? await registerWithEmail(email, password, name.trim(), accountType)
        : await loginWithEmail(email, password);
    } catch {
      setFormError("Не удалось связаться с сервером авторизации.");
      return;
    } finally {
      pendingAction.current = false;
      setPending(false);
    }
    if (!result.ok) {
      setSessionUnconfirmed(Boolean(result.sessionUnconfirmed));
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      setFormError(result.retryAfterSeconds
        ? (result.error ?? "Слишком много попыток") + ". Попробуйте через " + result.retryAfterSeconds + " сек."
        : result.error ?? "Не удалось войти. Проверьте данные.");
      return;
    }
    const destination =
      intent === "register" && accountType !== "user" && target === "/" ? "/account" : target;
    router.push(destination);
  };

  const finishGoogleSignup = async () => {
    if (!googleCredentialForSignup || pendingAction.current) return;
    pendingAction.current = true;
    setFormError("");
    setPending(true);
    try {
      const result = await loginWithGoogle(googleCredentialForSignup, accountType);
      if (!result.ok) {
        setSessionUnconfirmed(Boolean(result.sessionUnconfirmed));
        setFormError(result.error ?? "Не удалось создать аккаунт через Google.");
        return;
      }
      setGoogleCredentialForSignup("");
      setGoogleSignupEmail("");
      const destination = accountType !== "user" && target === "/" ? "/account" : target;
      router.push(destination);
    } catch {
      setFormError("Не удалось завершить регистрацию. Попробуйте ещё раз.");
    } finally {
      pendingAction.current = false;
      setPending(false);
    }
  };

  const retrySession = async () => {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setPending(true);
    try {
      const result = await verifyAuthSession();
      if (!result.ok) { setFormError(result.error ?? "Вход пока не подтверждён."); return; }
      const destination = accountType !== "user" && target === "/" ? "/account" : target;
      router.push(destination);
      router.refresh();
    } finally {
      pendingAction.current = false;
      setPending(false);
    }
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

  if (sessionUnconfirmed) {
    return (
      <div className="authCard surface">
        <h2>Подтверждение входа</h2>
        <p className="authLead">Сервер принял запрос. Повторно создавать аккаунт не нужно — сначала проверим сессию.</p>
        {formError ? <p className="authError" role="alert">{formError}</p> : null}
        <div className="authForm">
          <button type="button" className="btn btn--primary btn--block" disabled={pending} onClick={retrySession}>
            {pending ? "Проверяем…" : "Проверить вход"}
          </button>
          <Link className="btn btn--outline btn--block" href="/login">Вернуться ко входу</Link>
        </div>
      </div>
    );
  }

  if (googleCredentialForSignup) {
    return (
      <div className="authCard surface">
        <h2>Завершить регистрацию через Google</h2>
        <div className="authField" role="group" aria-label="Выбор типа нового Google-аккаунта">
          <span className="fieldLabel">Новый Google-аккаунт — выберите тип аккаунта</span>
          <p className="formHint">
            {googleSignupEmail ? `Google подтвердил ${googleSignupEmail}. ` : ""}
            Аккаунт будет создан только после выбора типа.
          </p>
          <div className="accountTypeToggleGrid roleToggleGrid" role="radiogroup" aria-label="Тип нового аккаунта">
            <button
              type="button"
              className={cn("accountTypeOption roleOption", accountType === "user" && "isActive")}
              onClick={() => setAccountType("user")}
              role="radio"
              aria-checked={accountType === "user"}
            >
              <User size={16} />
              <div>
                <strong>Участник / родитель</strong>
                <small>Ищу кружки и секции</small>
              </div>
            </button>
            <button
              type="button"
              className={cn("accountTypeOption roleOption", accountType === "service_owner" && "isActive")}
              onClick={() => setAccountType("service_owner")}
              role="radio"
              aria-checked={accountType === "service_owner"}
            >
              <Store size={16} />
              <div>
                <strong>Владелец услуги</strong>
                <small>Предлагаю услуги и принимаю клиентов</small>
              </div>
            </button>
            <button
              type="button"
              className={cn("accountTypeOption roleOption", accountType === "section_owner" && "isActive")}
              onClick={() => setAccountType("section_owner")}
              role="radio"
              aria-checked={accountType === "section_owner"}
            >
              <Building size={16} />
              <div>
                <strong>Организация / педагог</strong>
                <small>Публикую кружки и секции</small>
              </div>
            </button>
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={finishGoogleSignup} disabled={pending}>
            {pending ? "Создаём аккаунт…" : "Продолжить и создать аккаунт"}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() => {
              setGoogleCredentialForSignup("");
              setGoogleSignupEmail("");
            }}
            disabled={pending}
          >
            Отмена
          </button>
        </div>
        {formError ? <p className="authError" role="alert">{formError}</p> : null}
        <p className="formHint">Продолжая, вы принимаете <Link href="/terms">условия использования</Link> и <Link href="/privacy">обработку данных</Link>.</p>
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
              Как вас называть <span>обязательно</span>
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
                required
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
              />
            </div>
            {fieldErrors.name ? (
              <p className="formHint formHint--error" id="auth-name-error" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-password">
            Пароль
          </label>
          <div className="authInputWrap authInputWrap--password">
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
              className="authEye"
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

        {intent === "register" ? (
          <div className="authField">
            <span className="fieldLabel">Тип аккаунта</span>
            <div className="accountTypeToggleGrid roleToggleGrid" role="radiogroup" aria-label="Тип аккаунта">
              <button
                type="button"
                className={cn("accountTypeOption roleOption", accountType === "user" && "isActive")}
                onClick={() => setAccountType("user")}
                disabled={pending}
                role="radio"
                aria-checked={accountType === "user"}
              >
                <User size={16} />
                <div>
                  <strong>Участник / родитель</strong>
                  <small>Ищу кружки и секции для себя или ребёнка</small>
                </div>
              </button>
              <button
                type="button"
                className={cn("accountTypeOption roleOption", accountType === "service_owner" && "isActive")}
                onClick={() => setAccountType("service_owner")}
                disabled={pending}
                role="radio"
                aria-checked={accountType === "service_owner"}
              >
                <Store size={16} />
                <div>
                  <strong>Владелец услуги</strong>
                  <small>Предлагаю услуги и принимаю клиентов</small>
                </div>
              </button>
              <button
                type="button"
                className={cn("accountTypeOption roleOption", accountType === "section_owner" && "isActive")}
                onClick={() => setAccountType("section_owner")}
                disabled={pending}
                role="radio"
                aria-checked={accountType === "section_owner"}
              >
                <Building size={16} />
                <div>
                  <strong>Организация / педагог</strong>
                  <small>Публикую кружки и секции организации</small>
                </div>
              </button>
            </div>
          </div>
        ) : null}

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

        <div className="authSubmitActions">
          <button type="submit" className="btn btn--primary btn--lg" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
            {pending ? "Проверяем…" : intent === "register" ? "Создать аккаунт" : "Войти"}
          </button>
          <GoogleSignInButton options={googleOptions} pending={pending}
            onBegin={handleGoogleClick} onOpenFailure={googleOpenFailure}
            onUnavailable={() => setFormError("Вход через Google недоступен: не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID.")}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
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
            Google
          </GoogleSignInButton>
        </div>
      </form>



      <p className="formHint">
        Входя, вы принимаете <Link href="/terms">условия использования</Link> и{" "}
        <Link href="/privacy">обработку данных</Link>.
      </p>

      {formError ? (
        <p className="authError" role="alert">
          {formError}
        </p>
      ) : null}

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
