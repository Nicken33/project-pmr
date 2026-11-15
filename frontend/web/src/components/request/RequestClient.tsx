"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Inbox, Mail, MapPin, Search } from "lucide-react";
import type { City } from "@/lib/types";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

interface SentRequest {
  query: string;
  citySlug: string;
  email: string;
  createdAt: string;
}

const STORAGE_KEY = "talentro:requests";
const GUEST_LIMIT = 1;
const USER_LIMIT = 5;

function readStored(): SentRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SentRequest[]) : [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter((item) => new Date(item.createdAt).getTime() > dayAgo);
  } catch {
    return [];
  }
}

export function RequestForm({ cities }: { cities: City[] }) {
  const { user, toast } = useApp();
  const [query, setQuery] = useState("");
  const [citySlug, setCitySlug] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<SentRequest | null>(null);
  const [saved, setSaved] = useState(true);

  const limit = user ? USER_LIMIT : GUEST_LIMIT;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 5) {
      setError("Опишите одним-двумя словами, что ищете — минимум 5 знаков.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Проверьте формат почты: нужен адрес вида name@example.com.");
      return;
    }
    const stored = readStored();
    if (stored.length >= limit) {
      setError(
        user
          ? `На этом устройстве уже ${stored.length} заявок — локальный счётчик дальше не пускает.`
          : "Заявка уже сохранена в этом браузере. Сервера приёма нет, поэтому на другом устройстве счётчик не действует.",
      );
      return;
    }
    const record: SentRequest = {
      query: value,
      citySlug,
      email: email.trim(),
      createdAt: new Date().toISOString(),
    };
    let savedLocally = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...stored, record]));
    } catch {
      // Приватный режим: сохранять некуда, и об этом говорим прямо.
      savedLocally = false;
    }
    setSent(record);
    setSaved(savedLocally);
    setError("");
    setQuery("");
    setEmail("");
    toast({
      title: savedLocally ? "Заявка сохранена на этом устройстве" : "Сохранить не удалось",
      description: savedLocally
        ? "Отправки на сервер пока нет — текст ждёт в этом браузере."
        : "Браузер запретил сохранение, поэтому текст заявки не остался. Скопируйте его.",
      tone: savedLocally ? "success" : "danger",
    });
  };

  if (sent) {
    return (
      <div className="requestDone">
        <span className="requestDoneIcon">
          <CheckCircle2 size={26} />
        </span>
        <h2>{saved ? "Заявка сохранена на этом устройстве" : "Текст заявки не сохранился"}</h2>
        <p>
          Ищем «{sent.query}»{sent.citySlug ? ` в городе ${cities.find((city) => city.slug === sent.citySlug)?.title}` : ""}.
          {saved
            ? " Отправлять её некуда: сервер приёма заявок не подключён, поэтому запись осталась в этом браузере и модератор её не видит."
            : " Браузер запретил сохранение, поэтому текст не дошёл даже до этого устройства — скопируйте его, если напишете позже."}
          {sent.email ? ` Почту ${sent.email} держим при себе: наружу она не уходит.` : ""}
        </p>
        <div className="requestDoneActions">
          <button type="button" className="btn btn--soft" onClick={() => setSent(null)}>
            Отправить ещё одну
          </button>
          <Link href="/" className="btn btn--ghost">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="requestForm" onSubmit={submit} noValidate>
      <div className="requestRow">
        <label className="fieldLabel" htmlFor="request-query">
          Что ищете <span className="fieldRequired">обязательно</span>
        </label>
        <div className="requestInputWrap">
          <Search size={17} />
          <input
            id="request-query"
            className={cn("fieldInput", error && !query.trim() && "fieldInput--error")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError("");
            }}
            placeholder="Например: скалолазание для подростков"
            maxLength={80}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="requestRow">
        <label className="fieldLabel" htmlFor="request-city">
          Город <span className="fieldOptional">необязательно</span>
        </label>
        <div className="requestInputWrap">
          <MapPin size={17} />
          <select
            id="request-city"
            className="fieldInput"
            value={citySlug}
            onChange={(event) => setCitySlug(event.target.value)}
          >
            <option value="">Уточним при разборе</option>
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="requestRow">
        <label className="fieldLabel" htmlFor="request-email">
          Почта для ответа <span className="fieldOptional">необязательно</span>
        </label>
        <div className="requestInputWrap">
          <Mail size={17} />
          <input
            id="request-email"
            className="fieldInput"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <p className="requestHint">
          Адрес никуда не уходит: заявка остаётся в этом браузере. Телефон, домашний адрес и имена
          детей в текст не вписывайте.
        </p>
      </div>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="requestFoot">
        <span className="requestLimit">
          Локальный счётчик этого браузера: {limit - readStored().length} из {limit} заявок ещё
          можно сохранить
        </span>
        <button type="submit" className="btn btn--primary btn--lg">
          <Inbox size={17} /> Сохранить заявку
        </button>
      </div>
    </form>
  );
}
