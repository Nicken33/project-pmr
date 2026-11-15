/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModerationApplication } from './ModerationApplication';
import type { ModerationJournalEntry } from './ModerationJournalEntry';
/**
 * Состояние заявки после решения — та же форма, что у GET .../queue и
 * GET .../journal, чтобы кабинет не перерисовывал строку вслепую.
 *
 */
export type DecisionResult = {
    application: ModerationApplication;
    /**
     * Строка, добавленная этим решением. null только на повторе уже
     * принятого решения, когда заявка закрыта, а строки журнала у неё нет.
     *
     */
    journal_entry: ModerationJournalEntry | null;
    /**
     * true — повтор ровно того же решения, новая строка журнала не создана.
     */
    replayed: boolean;
};

