/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Group } from './Group';
import type { Location } from './Location';
/**
 * Заявка в очереди модератора (§3.9.1, §8 табл. 11) — строка
 * `moderation_applications` вместе с карточкой, организацией и направлением,
 * чтобы превью «как её увидят, со всеми точками и всеми группами» собиралось
 * одним ответом. `status` — статус заявки, `card_status` — статус карточки
 * (§8 табл. 1): словари разные, «одобрено» и «опубликовано» — не одно и то
 * же (§7.18).
 *
 */
export type ModerationApplication = {
    id: number;
    card_id: number;
    slug: string;
    title: string;
    kind: ModerationApplication.kind;
    status: ModerationApplication.status;
    card_status: ModerationApplication.card_status;
    description: string | null;
    format: string;
    lesson_type: string | null;
    phone: string | null;
    /**
     * Направление карточки; null
     */
    category: string | null;
    category_slug: string | null;
    /**
     * Родительская ветка направления (§9.5).
     */
    super_category: string | null;
    super_category_slug: string | null;
    organization_id: number;
    organization_slug: string;
    organization_name: string;
    organization_type: string;
    organization_city: string | null;
    /**
     * Все группы анкеты (§3.9.1); пустой список — это [].
     */
    groups: Array<Group>;
    /**
     * Все точки анкеты; пустой список — это [].
     */
    locations: Array<Location>;
    /**
     * Пути фото из media (entity = card, kind = photo) в порядке order_num.
     */
    photos: Array<string>;
    /**
     * Число групп анкеты — нужно строке очереди без раскрытия списков.
     */
    groups_count: number;
    /**
     * Число различных точек у групп анкеты.
     */
    locations_count: number;
    submitted_at: string | null;
    /**
     * Причина отказа для владельца (§3.9.3); null у pending и у approve.
     */
    reject_reason: string | null;
    decided_at: string | null;
    /**
     * Имя модератора из users; null
     */
    decided_by: string | null;
    decided_by_id: number | null;
    created_at: string;
    updated_at: string;
};
export namespace ModerationApplication {
    export enum kind {
        ACTIVITY = 'activity',
        SERVICE = 'service',
        BOTH = 'both',
    }
    export enum status {
        PENDING = 'pending',
        APPROVED = 'approved',
        REJECTED = 'rejected',
    }
    export enum card_status {
        DRAFT = 'draft',
        ON_MODERATION = 'on_moderation',
        PUBLISHED = 'published',
        REJECTED = 'rejected',
    }
}

