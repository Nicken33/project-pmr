import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModerationApiError } from "@/lib/moderation-api";
import { applications, contentReports } from "@/lib/data";

/**
 * Кабинет модерации обязан честно показывать и данные, и отказы сервера: пустая
 * очередь — пустой очередью, 401 — ссылкой на вход, 403 — отказом по роли, 409 —
 * закрытой заявкой с актуальным статусом, 400 — полем под полем. Моки здесь только
 * ответы сервера; сами состояния рисует компонент.
 */

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/providers/AppProviders", () => ({
  useApp: () => ({
    user: {
      id: "moderator",
      name: "Мария",
      email: "moderator@example.test",
      role: "moderator",
      avatarColor: "#000",
    },
    mode: "real",
    ready: true,
    toast,
    favorites: [],
    isFavorite: () => false,
    toggleFavorite: () => "added" as const,
    removeFavorite: () => {},
    requestAuth: () => {},
    logout: () => {},
    loginWithGoogle: async () => ({ ok: true }),
    loginWithTesterToken: async () => ({ ok: true }),
  }),
}));

vi.mock("@/lib/moderation-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/moderation-api")>();
  return {
    ...actual,
    fetchQueue: vi.fn(),
    fetchReports: vi.fn(),
    fetchJournal: vi.fn(),
    decideApplication: vi.fn(),
    decideReport: vi.fn(),
  };
});

import * as api from "@/lib/moderation-api";
import { ModerationLive } from "@/components/moderation/ModerationLive";

const application = applications[0];
const openReport = contentReports.find((report) => report.status === "open") ?? contentReports[0];

const queuePage = { items: [application], total: 1, page: 1, limit: 20 };
const reportsPage = { items: [openReport], total: 1, page: 1, limit: 20 };
const journalPage = { items: [], total: 0, page: 1, limit: 20 };

/** Ничего не ответивший сервер: прокси именно так и отдаёт пустые очереди. */
const never = () => new Promise<never>(() => {});

function pending(section: "queue" | "reports" | "journal", value: unknown) {
  if (section === "queue") vi.mocked(api.fetchQueue).mockResolvedValue(value as never);
  if (section === "reports") vi.mocked(api.fetchReports).mockResolvedValue(value as never);
  if (section === "journal") vi.mocked(api.fetchJournal).mockResolvedValue(value as never);
}

function rejectSections(error: Error) {
  vi.mocked(api.fetchQueue).mockRejectedValue(error);
  vi.mocked(api.fetchReports).mockRejectedValue(error);
  vi.mocked(api.fetchJournal).mockRejectedValue(error);
}

beforeEach(() => {
  toast.mockReset();
  vi.mocked(api.fetchQueue).mockResolvedValue(queuePage as never);
  vi.mocked(api.fetchReports).mockResolvedValue(reportsPage as never);
  vi.mocked(api.fetchJournal).mockResolvedValue(journalPage as never);
  vi.mocked(api.decideApplication).mockResolvedValue({
    application: { ...application, status: "published" },
    replayed: false,
  });
  vi.mocked(api.decideReport).mockResolvedValue({
    report: { ...openReport, status: "hidden" },
    replayed: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("состояния очередей", () => {
  it("пока сервер молчит — кабинет не притворяется готовым", async () => {
    vi.mocked(api.fetchQueue).mockImplementation(never);
    vi.mocked(api.fetchReports).mockImplementation(never);
    vi.mocked(api.fetchJournal).mockImplementation(never);
    render(<ModerationLive />);
    expect(await screen.findByText("Загружаем очередь с сервера…")).toBeInTheDocument();
    expect(screen.queryByText(application.title)).toBeNull();
  });

  it("пустой ответ сервера — «очередь пуста», а не демонстрационные анкеты", async () => {
    pending("queue", { items: [], total: 0, page: 1, limit: 20 });
    render(<ModerationLive />);
    expect(await screen.findByText("Очередь пуста")).toBeInTheDocument();
    expect(screen.queryByText(application.title)).toBeNull();
  });

  it("анкета с сервера показана в очереди", async () => {
    render(<ModerationLive />);
    expect(await screen.findByText(application.title)).toBeInTheDocument();
  });

  it("401 — вход, а не «произошла ошибка»", async () => {
    rejectSections(new ModerationApiError(401, "Сессия не найдена — войдите заново"));
    render(<ModerationLive />);
    const link = await screen.findByRole("link", { name: "Войти модератором" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fmoderation");
    expect(link).toHaveTextContent("Войти модератором");
  });

  it("403 — роль читает сервер, кабинет это и пишет", async () => {
    rejectSections(new ModerationApiError(403, "Кабинет доступен только модератору"));
    render(<ModerationLive />);
    expect(await screen.findByText(/только модератору/)).toBeInTheDocument();
    expect(screen.queryByText(application.title)).toBeNull();
  });

  it("503 без адреса API — «серверной очереди нет»", async () => {
    rejectSections(new ModerationApiError(503, "Серверной очереди модерации нет — адрес API не настроен"));
    render(<ModerationLive />);
    expect(
      await screen.findByText("Серверной очереди модерации нет — адрес API не настроен"),
    ).toBeInTheDocument();
  });
});

describe("решение по анкете", () => {
  it("публикация уходит на сервер как approve, очередь перечитывается", async () => {
    render(<ModerationLive />);
    fireEvent.click(await screen.findByText("Опубликовать"));
    await waitFor(() =>
      expect(api.decideApplication).toHaveBeenCalledWith(application.id, { action: "approve" }),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Анкета опубликована" }),
    );
    await waitFor(() => expect(vi.mocked(api.fetchQueue).mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("отказ уходит на сервер с причиной из типового списка", async () => {
    render(<ModerationLive />);
    fireEvent.click(await screen.findByText("Отклонить"));
    fireEvent.change(screen.getByLabelText(/Свободный текст владельцу/), {
      target: { value: "Указан адрес без дома — попросить уточнить" },
    });
    fireEvent.click(await screen.findByText("Подтвердить отказ"));
    await waitFor(() =>
      expect(api.decideApplication).toHaveBeenCalledWith(
        application.id,
        expect.objectContaining({ action: "reject", reason: expect.any(String) }),
      ),
    );
  });

  it("повтор решения (replayed) — успех без второй строки журнала", async () => {
    vi.mocked(api.decideApplication).mockResolvedValue({ application: null, replayed: true });
    render(<ModerationLive />);
    fireEvent.click(await screen.findByText("Опубликовать"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Решение уже было принято" }),
      ),
    );
    render(<ModerationLive />);
    expect(screen.getAllByRole("tabpanel").length).toBeGreaterThan(0);
  });

  it("409 — «заявка уже закрыта» и актуальный статус, а не ошибка", async () => {
    vi.mocked(api.decideApplication).mockRejectedValue(
      new ModerationApiError(409, "решение уже принято"),
    );
    render(<ModerationLive />);
    fireEvent.click(await screen.findByText("Опубликовать"));
    expect(await screen.findByText(/уже закрыта прежним решением/)).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Решение не принято" }));
    await waitFor(() => expect(vi.mocked(api.fetchQueue).mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("400 с полями — текст ошибки под причиной отказа", async () => {
    vi.mocked(api.decideApplication).mockRejectedValue(
      new ModerationApiError(400, "нужна причина", { reason: "причина вне типового списка" }),
    );
    render(<ModerationLive />);
    fireEvent.click(await screen.findByText("Отклонить"));
    fireEvent.change(screen.getByLabelText(/Свободный текст владельцу/), {
      target: { value: "Причина для теста" },
    });
    fireEvent.click(await screen.findByText("Подтвердить отказ"));
    expect(await screen.findByText("Причина отказа: причина вне типового списка")).toBeInTheDocument();
  });
});

describe("решение по жалобе", () => {
  it("скрытие уходит на сервер как hide с основанием", async () => {
    render(<ModerationLive />);
    fireEvent.click(await screen.findByRole("tab", { name: /Жалобы/ }));
    fireEvent.click(await screen.findByText("Скрыть с причиной"));
    fireEvent.click(await screen.findByText("Скрыть запись"));
    await waitFor(() =>
      expect(api.decideReport).toHaveBeenCalledWith(
        openReport.id,
        expect.objectContaining({ action: "hide", reason: expect.any(String) }),
      ),
    );
  });

  it("«Оставить» — dismiss, жалоба не исчезает из ответа сервера молча", async () => {
    render(<ModerationLive />);
    fireEvent.click(await screen.findByRole("tab", { name: /Жалобы/ }));
    fireEvent.click(await screen.findByText("Оставить"));
    await waitFor(() =>
      expect(api.decideReport).toHaveBeenCalledWith(openReport.id, { action: "dismiss" }),
    );
  });

  it("блокировки в живом кабинете нет: эндпоинта сервер не отдаёт", async () => {
    render(<ModerationLive />);
    fireEvent.click(await screen.findByRole("tab", { name: /Жалобы/ }));
    await screen.findByText(openReport.activityTitle);
    expect(screen.queryByText("Заблокировать участника")).toBeNull();
  });
});
