/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Редактируемые поля организации (§8, табл. 2). Телефон обязателен: карточка
 * без телефона не проходит проверку (§7.8). Тип — только из закрытого
 * CHECK-списка. Координаты заполняются только вместе и только в рамке
 * Приднестровья. Slug и поля идентичности сюда не попадают вовсе.
 *
 */
export type OwnedOrganizationInput = {
    name: string;
    type: OwnedOrganizationInput.type;
    description?: string | null;
    phone: string;
    email?: string | null;
    /**
     * Адрес со схемой `http://` или `https://` и непустым хостом.
     */
    site?: string | null;
    address?: string | null;
    city_id?: number | null;
    lat?: number | null;
    lng?: number | null;
};
export namespace OwnedOrganizationInput {
    export enum type {
        _ = 'школа',
        _ = 'студия',
        _ = 'дом творчества',
        _ = 'спортшкола',
        _ = 'частный мастер',
    }
}

