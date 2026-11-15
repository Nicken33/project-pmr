/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OwnedCard } from './OwnedCard';
/**
 * Форма ответа кабинета с пагинацией (§9.4). `items` пустой массив, а не null.
 */
export type OwnedCardPage = {
    items: Array<OwnedCard>;
    /**
     * Сколько карточек владельца подходит под фильтр всего
     */
    total: number;
    page: number;
    limit: number;
};

