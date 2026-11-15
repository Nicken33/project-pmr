/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Media } from './Media';
/**
 * Точка проведения (§7.11).
 */
export type Location = {
    id: number;
    name: string | null;
    city: string;
    district: string | null;
    address: string;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    contacts_verified_at: string | null;
    /**
     * Сколько групп этой карточки ведутся именно в этой точке.
     */
    groups_count: number;
    /**
     * Фото точки; часто пустой массив — точки в сиде фото не имеют.
     */
    photos: Array<Media>;
};

