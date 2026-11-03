"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck, User } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

type Role = "user" | "owner";

const takenEmails = ["taken@example.com", "moder@example.com"];

export function AuthForm({ mode, next = "/" }: { mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const { login, register, user } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [recovery, setRecovery] = useState<"idle" | "loading" | "sent">("idle");

  if (user && mode === "login") {
    return (
      <div className="authCard surface">
        <span className="authDoneIcon">
          <ShieldCheck size={26} />
        </span>
        <h2>Вы уже вошли</h2>
        <p className="muted">
          Аккаунт {user.email}. Можно вернуться к каталогу или открыть кабинет.
        </p>
        <div className="authActions">
          <Link className="btn btn--primary btn--lg btn--block" href={next}>
            Вернуться в каталог
          </Link>
          <Link className="btn btn--soft btn--block" href="/account">
            Мой кабинет
          </Link>
        </div>
      </div>
    );
  }

  const validate = () => {
    const found: Record<string, string> = {};
    if (mode === "register" && name.trim().length < 2) found.name = "Укажите имя — как вас подписывать в отзывах.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      found.email = "Почта должна быть в формате name@example.com.";
    }
    if (password.length < 6) found.password = "Пароль не короче 6 символов.";
    if (mode === "register" && !consent) {
      found.consent = "Нужно согласие, чтобы продолжить.";
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;
    setPending(true);
    if (mode === "login") {
      const result = await login({ email: email.trim(), password });
      setPending(false);
      if (!result.ok) {
        setFormError(result.error ?? "Не удалось войти. Проверьте почту и пароль.");
        return;
      }
      router.push(next);
      return;
    }
    if (takenEmails.includes(email.trim().toLowerCase())) {
      setPending(false);
      setErrors({ email: "Такая почта уже зарегистрирована. Войдите или восстановите пароль." });
      return;
    }
    const result = await register({ name, email: email.trim(), password, role });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error ?? "Не удалось создать аккаунт.");
      return;
    }
    router.push(next);
  };

  const askRecovery = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors({ email: "Укажите почту аккаунта — на неё отправим инструкцию." });
      return;
    }
    setRecovery("loading");
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRecovery("sent");
  };

  return (
    <div className="authCard surface">
      <h2>{mode === "login" ? "Вход в Talentro" : "Новый аккаунт"}</h2>
      <p className="authLead">
        {mode === "login"
          ? "Избранное, голоса и отзывы — под одним аккаунтом. Каталог доступен и без входа."
          : "Регистрируйтесь, чтобы сохранять занятия, голосовать и писать отзывы."}
      </p>

      <form className="authForm" onSubmit={onSubmit} noValidate>
        {mode === "register" ? (
          <div className="authField">
            <label className="fieldLabel" htmlFor="auth-name">
              Имя <span>обязательно</span>
            </label>
            <div className="authInputWrap">
              <User size={17} />
              <input
                id="auth-name"
                className={cn("fieldInput", errors.name && "fieldInput--error")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Как вас зовут"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
              />
            </div>
            {errors.name ? <p className="formHint formHint--error">{errors.name}</p> : null}
          </div>
        ) : null}

        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-email">
            Почта <span>обязательно</span>
          </label>
          <div className="authInputWrap">
            <Mail size={17} />
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              className={cn("fieldInput", errors.email && "fieldInput--error")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: "" }));
                if (recovery !== "idle") setRecovery("idle");
              }}
              placeholder="name@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
            />
          </div>
          {errors.email ? <p className="formHint formHint--error">{errors.email}</p> : null}
        </div>

        <div className="authField">
          <label className="fieldLabel" htmlFor="auth-password">
            Пароль <span>минимум 6 символов</span>
          </label>
          <div className="authInputWrap">
            <Lock size={17} />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className={cn("fieldInput", errors.password && "fieldInput--error")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              className="authEye"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password ? <p className="formHint formHint--error">{errors.password}</p> : null}
        </div>

        {mode === "register" ? (
          <fieldset className="authRoles">
            <legend className="fieldLabel">
              Тип аккаунта <span>потом меняет модератор</span>
            </legend>
            <div className="authRoleList" role="radiogroup" aria-label="Тип аккаунта">
              {(
                [
                  { value: "user", title: "Участник", note: "Родитель или подросток: избранное, голоса и отзывы." },
                  { value: "owner", title: "Владелец секции или услуги", note: "Организация или мастер: свои анкеты и профиль." },
                ] as const
              ).map((option) => (
                <label key={option.value} className={cn("authRole", role === option.value && "isActive")}>
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.note}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {mode === "register" ? (
          <label className={cn("authConsent", errors.consent && "authConsent--error")}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              Согласен с <Link href="/terms">условиями пользования</Link> и{" "}
              <Link href="/privacy">обработкой данных</Link>.
            </span>
          </label>
        ) : null}

        {formError ? (
          <p className="authError" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Проверяем…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>

      {mode === "login" ? (
        <div className="authRecovery">
          {recovery === "sent" ? (
            <p className="authSent" role="status">
              Инструкция ушла на {email.trim()}. Почтовая отправка настраивается, поэтому если письмо
              не придёт за день — пароль восстановит модератор вручную: это описано в{" "}
              <Link href="/rules">«Правилах публикации»</Link>.
            </p>
          ) : (
            <>
              <button type="button" className="linkButton" onClick={askRecovery} disabled={recovery === "loading"}>
                {recovery === "loading" ? "Отправляем…" : "Забыли пароль?"}
              </button>
              <span className="muted">Письмом на почту аккаунта.</span>
            </>
          )}
        </div>
      ) : null}

      <div className="authSocial">
        <span className="authDivider">или</span>
        <button
          type="button"
          className="btn btn--outline btn--block"
          onClick={() =>
            setFormError("Вход через Google появится, когда будет настроена почта команды. Пока — почта и пароль.")
          }
        >
          <LogIn size={17} /> Войти через Google
        </button>
        <p className="authNote">
          Аккаунт «только через сервис» не заводим: почта и пароль остаются основным входом.
        </p>
      </div>

      <div className="authSwitch">
        <Link href={mode === "login" ? "/register" : "/login"} className="linkButton">
          {mode === "login" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
        </Link>
        <Link href="/" className="authBack">
          <ArrowLeft size={14} /> Вернуться в каталог
        </Link>
      </div>
    </div>
  );
}
