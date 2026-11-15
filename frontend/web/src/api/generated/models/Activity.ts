/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Card } from './Card';
import type { Group } from './Group';
import type { Location } from './Location';
import type { Media } from './Media';
import type { Organization } from './Organization';
/**
 * Карточка целиком (§9.3) — плоские поля плюс раскрытые списки.
 */
export type Activity = (Card & {
    organization: Organization | null;
    /**
     * Все активные точки карточки, по id (§7.11).
     */
    locations: Array<Location>;
    /**
     * Все группы карточки, по id (§7.10).
     */
    groups: Array<Group>;
    /**
     * Фото карточки по `order_num`.
     */
    photos: Array<Media>;
    /**
     * Видео карточки по `order_num`.
     */
    videos: Array<Media>;
});

