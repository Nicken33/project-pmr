/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Card } from './Card';
/**
 * Карточка глазами её владельца: тот же `Card`, что в каталоге (имена полей
 * не меняются, витрина и кабинет читают их одним парсером), плюс то, что
 * каталог не показывает — владелец, активность, причина отказа и дата
 * создания. В списке видны все статусы, включая `draft` и `rejected`.
 *
 */
export type OwnedCard = (Card & {
    /**
     * `cards.owner_id` NULL-able: карточка без владельца не принадлежит никому.
     */
    owner_id: number | null;
    is_active: boolean;
    /**
     * Основание отказа модератора; показывается владельцу как есть.
     */
    reject_reason: string | null;
    created_at: string;
});

