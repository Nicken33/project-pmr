/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Organization } from './Organization';
/**
 * Организация владельца целиком. `slug`, `owner_id`, `publish_basis`,
 * `contacts_verified_at` и `is_active` здесь читаются, но не пишутся:
 * публичный адрес и основание публикации — не самообслуживание (§11.8).
 *
 */
export type OwnedOrganization = (Organization & {
    city_id: number | null;
    lat: number | null;
    lng: number | null;
    owner_id: number | null;
    /**
     * Основание публикации (§11.8). Меняет модератор, не владелец.
     */
    publish_basis: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
});

