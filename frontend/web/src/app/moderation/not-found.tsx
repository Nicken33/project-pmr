import { TesterOnlyPanel } from "@/components/layout/StatePanel";

/* Бэкенда модерации нет: аноним получает 404, а не кабинет из мок-очередей (§6). */
export default function ModerationNotFound() {
  return (
    <div className="statePage container">
      <TesterOnlyPanel />
    </div>
  );
}
