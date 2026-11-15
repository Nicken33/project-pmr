/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Ответ на удаление (200). Строки в базе больше нет, файл снят с диска.
 * `deleted: true` отличает успех от 404, а `id`/`card_id` дают клиенту понять,
 * какую карточку перечитать.
 *
 */
export type MediaDeleted = {
    deleted: boolean;
    id: number;
    card_id: number;
};

