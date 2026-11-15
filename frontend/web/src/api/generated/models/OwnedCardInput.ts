/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Редактируемые поля карточки (§8, табл. 1). Полей `owner_id`, `status`,
 * `is_active`, `slug` и `reject_reason` здесь нет намеренно: лишние ключи
 * тела разбор игнорирует, поэтому подделать владельца или сразу
 * опубликоваться нельзя. `kind` разрешён только равным роли, `org_id` —
 * только своей организации. Длины совпадают с VARCHAR в `database/init.sql`
 * и считаются в символах, а не в байтах.
 *
 */
export type OwnedCardInput = {
    name: string;
    /**
     * Пустое значение означает «вид от роли»; непустое обязано совпадать с ней, иначе 403.
     */
    kind?: OwnedCardInput.kind;
    /**
     * Своя организация. Не задана — берётся организация владельца; её отсутствие даёт 404.
     */
    org_id?: number | null;
    /**
     * Направление из справочника; должно подходить виду карточки
     */
    category_id: number;
    /**
     * TEXT без ограничения длины; пустая строка → null (§7.4).
     */
    description?: string | null;
    format?: OwnedCardInput.format;
    /**
     * Только у занятия: CHECK `cards_service_has_no_lesson_type` не пускает его в услугу (400).
     */
    lesson_type?: OwnedCardInput.lesson_type | null;
    phone?: string | null;
};
export namespace OwnedCardInput {
    /**
     * Пустое значение означает «вид от роли»; непустое обязано совпадать с ней, иначе 403.
     */
    export enum kind {
        ACTIVITY = 'activity',
        SERVICE = 'service',
    }
    export enum format {
        ONLINE = 'online',
        OFFLINE = 'offline',
        BOTH = 'both',
    }
    /**
     * Только у занятия: CHECK `cards_service_has_no_lesson_type` не пускает его в услугу (400).
     */
    export enum lesson_type {
        INDIVIDUAL = 'individual',
        GROUP = 'group',
        BOTH = 'both',
    }
}

