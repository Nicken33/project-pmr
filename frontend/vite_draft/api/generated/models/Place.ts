/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Город или район (§7.2, §9.6).
 */
export type Place = {
    id: number;
    slug: string;
    name: string;
    /**
     * Город района. Ключа нет у городов (`omitempty` и null по смыслу).
     */
    city_id?: number | null;
};

