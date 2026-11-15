/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Media } from './Media';
/**
 * Медиа кабинета: канонический `Media` плюс `id` строки. Без id кабинет не
 * может удалить файл — `DELETE …/media/{mediaID}` требует именно его.
 * Публичный контракт `photos[]`/`videos[]` этот тип не получает и не меняется.
 *
 */
export type OwnedMedia = (Media & {
    id: number;
});

