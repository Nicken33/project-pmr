/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Жалоба на контент из второй очереди (§3.9.7, §8 табл. 12).
 * target_type + target_id — тот же приём, что у media: своей таблицы у
 * отзывов ещё нет, поэтому внешнего ключа здесь нет и быть не может, а
 * фрагмент записи хранится в самой жалобе.
 *
 */
export type ContentReport = {
    id: number;
    target_type: ContentReport.target_type;
    target_id: number;
    /**
     * Фрагмент того
     */
    target_excerpt: string | null;
    /**
     * Основание жалобы от её автора; VARCHAR(120).
     */
    reason: string;
    detail: string | null;
    status: ContentReport.status;
    /**
     * Основание скрытия (§12.15); обязателен при hidden (CHECK). Тексты авторов модератор не правит.
     */
    hide_reason: string | null;
    reporter_id: number | null;
    reporter_name: string | null;
    card_id: number | null;
    card_slug: string | null;
    card_title: string | null;
    decided_by: string | null;
    created_at: string;
    updated_at: string;
};
export namespace ContentReport {
    export enum target_type {
        REVIEW = 'review',
        COMMENT = 'comment',
        MEDIA = 'media',
        CARD = 'card',
    }
    export enum status {
        OPEN = 'open',
        HIDDEN = 'hidden',
        DISMISSED = 'dismissed',
    }
}

