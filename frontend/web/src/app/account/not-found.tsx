import { TesterOnlyPanel } from "@/components/layout/StatePanel";

/* Не заглушка с моками, а настоящий 404: у анонима в ответе нет ни одной анкеты,
   и поиск по кабинету не индексируется (§6). */
export default function AccountNotFound() {
  return (
    <div className="statePage container">
      <TesterOnlyPanel />
    </div>
  );
}
