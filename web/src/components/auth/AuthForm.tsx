"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { safeInternalPath } from "@/lib/navigation";
import { GoogleLogin } from "@react-oauth/google";

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

  /* `next` приходит из адресной строки, поэтому проверяется здесь, а не только на
     странице: этот компонент вызывает навигацию, и новый вызов не должен
     полагаться на добросовестность того, кто передал проп. */
  const target = safeInternalPath(next);

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
      setFieldErrors(result.fieldErrors ?? {});
      // 429 без срока читался бы как «неверная почта или пароль», хотя дело не в
      // пароле: §12.2 блокирует перебор на минуту, и сервер сам говорит, сколько
      // осталось ждать.
      setFormError(
        result.retryAfterSeconds
          ? `Слишком много попыток входа подряд. Следующая — через ${result.retryAfterSeconds} с.`
          : (result.error ?? "Сервер не принял почту и пароль."),
      );
      return;
    }
    router.push(next);
  };

  const submitTester = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    if (token.trim().length === 0) {
      setFormError("Введите токен тестировщика — его выдаёт координатор проверки.");
      return;
    }
    setPendingTester(true);
    const result = await loginWithTesterToken(token.trim());
    setPendingTester(false);
    if (!result.ok) {
      setFormError(result.error ?? "Сервер не принял токен.");
      return;
    }
    router.push(target);
  };

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
                placeholder="имя видно в кабинетах и отзывах"
                autoComplete="name"
              />
            </div>
            <p className="formHint">
              Без имени подписью будет почта — придумывать имя за вас сервер не будет.
            </p>
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
              placeholder="минимум 8 символов"
              autoComplete={intent === "register" ? "new-password" : "current-password"}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
            />
            <button
              type="button"
              className="authEye"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="formHint formHint--error" id="auth-password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Проверяем…" : intent === "register" ? "Создать аккаунт" : "Войти"}
        </button>
      </form>

      <p className="authOr">или через Google</p>

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
              router.push(target);
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
        <Link href={intent === "login" ? "/register" : "/login"} className="linkButton">
          {intent === "login" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
        </Link>
        <Link href="/" className="authBack">
          <ArrowLeft size={14} /> Вернуться в каталог
        </Link>
      </div>
    </div>
  );
}
