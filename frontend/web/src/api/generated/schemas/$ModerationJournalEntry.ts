/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModerationJournalEntry = {
    description: `Строка журнала решений (§3.9.4, §8 табл. 11). Только чтение: ни один
    обработчик UPDATE по журналу не делает, «переоткрыть» анкету — это новая
    заявка и новая строка журнала.
    `,
    properties: {
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        application_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        card_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        card_slug: {
            type: 'string',
            isRequired: true,
        },
        card_title: {
            type: 'string',
            isRequired: true,
        },
        organization_slug: {
            type: 'string',
            isRequired: true,
        },
        actor_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        actor_name: {
            type: 'string',
            description: `Имя модератора из users.name; колонка NOT NULL, поэтому пустая строка
            означает «имя не заполнено», а не «имя пропало из ответа».
            `,
            isRequired: true,
        },
        action: {
            type: 'Enum',
            isRequired: true,
        },
        reason: {
            type: 'string',
            description: `Пункт типового списка причин (§3.9.3)`,
            isRequired: true,
            isNullable: true,
        },
        comment: {
            type: 'string',
            description: `Свободный текст владельцу`,
            isRequired: true,
            isNullable: true,
        },
        created_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
