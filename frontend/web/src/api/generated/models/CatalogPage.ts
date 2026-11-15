/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Card } from './Card';
/**
 * Форма ответа каталога с пагинацией (§9.4).
 */
export type CatalogPage = {
    items: Array<Card>;
    /**
     * Сколько карточек подходит под фильтр всего, а не на странице.
     */
    total: number;
    page: number;
    limit: number;
};

