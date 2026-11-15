/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Organization = {
    id: number;
    slug: string;
    name: string;
    type: Organization.type;
    description?: string | null;
    /**
     * Пустая строка, если телефона нет.
     */
    phone: string;
    email?: string | null;
    site?: string | null;
    address?: string | null;
    /**
     * Название города организации — не путать с городом точки проведения.
     */
    city?: string | null;
    /**
     * Дата подтверждения контактов, ГГГГ-ММ-ДД.
     */
    contacts_verified_at?: string | null;
};
export namespace Organization {
    export enum type {
        _ = 'школа',
        _ = 'студия',
        _ = 'дом творчества',
        _ = 'спортшкола',
        _ = 'частный мастер',
    }
}

