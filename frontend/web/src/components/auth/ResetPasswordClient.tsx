"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="authCard surface" style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "16px", color: "var(--danger, #e53935)" }}>
          <AlertCircle size={40} style={{ margin: "0 auto" }} />
        </div>
        <h2 style={{ textAlign: "center" }}>Недействительная ссылка</h2>
        <p className="authLead" style={{ textAlign: "center" }}>
          Ссылка на сброс пароля не содержит токена или была повреждена. Запросите восстановление повторно.
        </p>
        <div style={{ marginTop: "20px" }}>
          <Link href="/login" className="btn btn--primary btn--lg btn--block" style={{ textAlign: "center" }}>
            Вернуться ко входу
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="authCard surface" style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "16px", color: "var(--success, #2e7d32)" }}>
          <CheckCircle2 size={40} style={{ margin: "0 auto" }} />
        </div>
        <h2 style={{ textAlign: "center" }}>Пароль успешно изменён!</h2>
        <p className="authLead" style={{ textAlign: "center" }}>
          Ваш новый пароль сохранён. Теперь вы можете войти в аккаунт с новым паролем.
        </p>
        <div style={{ marginTop: "24px" }}>
          <Link href="/login" className="btn btn--primary btn--lg btn--block" style={{ textAlign: "center" }}>
            Войти в аккаунт
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      setPending(false);

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data?.error?.message || data?.message || "Не удалось сменить пароль. Ссылка могла устареть.");
      }
    } catch {
      setPending(false);
      setError("Ошибка соединения с сервером");
    }
  };

  return (
    <div className="authCard surface" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <h2>Новый пароль</h2>
      <p className="authLead">Придумайте новый надёжный пароль длиной не менее 8 символов.</p>

      {error ? (
        <div className="formHint formHint--error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      ) : null}

      <form className="authForm" onSubmit={handleSubmit} noValidate>
        <div className="authField">
          <label className="fieldLabel" htmlFor="new-password">
            Новый пароль
          </label>
          <div className="authInputWrap">
            <Lock size={17} />
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              className="fieldInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="не короче 8 символов"
              autoComplete="new-password"
              required
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
        </div>

        <div className="authField">
          <label className="fieldLabel" htmlFor="confirm-password">
            Повторите пароль
          </label>
          <div className="authInputWrap">
            <Lock size={17} />
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              className="fieldInput"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="повторите новый пароль"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить новый пароль"}
        </button>
      </form>
    </div>
  );
}
