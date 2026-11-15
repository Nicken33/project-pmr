/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Card } from './Card';
import type { Organization } from './Organization';
export type OrganizationPage = {
    organization: Organization | null;
    /**
     * Опубликованные занятия организации, по названию, не больше 100.
     */
    activities: Array<Card>;
    /**
     * Сколько карточек у организации всего; может превышать длину списка.
     */
    total: number;
};

