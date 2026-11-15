/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ContentReport = {
    description: `Жалоба на контент из второй очереди (§3.9.7, §8 табл. 12).
    target_type + target_id — тот же приём, что у media: своей таблицы у
    отзывов ещё нет, поэтому внешнего ключа здесь нет и быть не может, а
    фрагмент записи хранится в самой жалобе.
    `,
    properties: {
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        target_type: {
            type: 'Enum',
            isRequired: true,
        },
        target_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        target_excerpt: {
            type: 'string',
            description: `Фрагмент того`,
            isRequired: true,
            isNullable: true,
        },
        reason: {
            type: 'string',
            description: `Основание жалобы от её автора; VARCHAR(120).`,
            isRequired: true,
        },
        detail: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        status: {
            type: 'Enum',
            isRequired: true,
        },
        hide_reason: {
            type: 'string',
            description: `Основание скрытия (§12.15); обязателен при hidden (CHECK). Тексты авторов модератор не правит.`,
            isRequired: true,
            isNullable: true,
        },
        reporter_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        reporter_name: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        card_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        card_slug: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        card_title: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        decided_by: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        created_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updated_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
