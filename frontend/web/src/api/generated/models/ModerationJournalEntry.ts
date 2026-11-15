/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Строка журнала решений (§3.9.4, §8 табл. 11). Только чтение: ни один
 * обработчик UPDATE по журналу не делает, «переоткрыть» анкету — это новая
 * заявка и новая строка журнала.
 *
 */
export type ModerationJournalEntry = {
    id: number;
    application_id: number;
    card_id: number;
    card_slug: string;
    card_title: string;
    organization_slug: string;
    actor_id: number;
    /**
     * Имя модератора из users.name; колонка NOT NULL, поэтому пустая строка
     * означает «имя не заполнено», а не «имя пропало из ответа».
     *
     */
    actor_name: string;
    action: ModerationJournalEntry.action;
    /**
     * Пункт типового списка причин (§3.9.3)
     */
    reason: string | null;
    /**
     * Свободный текст владельцу
     */
    comment: string | null;
    created_at: string;
};
export namespace ModerationJournalEntry {
    export enum action {
        APPROVE = 'approve',
        REJECT = 'reject',
    }
}

