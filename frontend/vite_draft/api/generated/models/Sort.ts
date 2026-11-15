/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * По умолчанию — новые сверху. `rating` вернёт `400`, пока таблицы голосов
 * нет (§8, таблица 10) — иначе сортировка значила бы «по свежести».
 *
 */
export enum Sort {
    UPDATED = 'updated',
    PRICE = 'price',
    NAME = 'name',
    VERIFIED = 'verified',
}
