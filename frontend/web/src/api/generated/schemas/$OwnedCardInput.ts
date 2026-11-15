/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedCardInput = {
    description: `Редактируемые поля карточки (§8, табл. 1). Полей \`owner_id\`, \`status\`,
    \`is_active\`, \`slug\` и \`reject_reason\` здесь нет намеренно: лишние ключи
    тела разбор игнорирует, поэтому подделать владельца или сразу
    опубликоваться нельзя. \`kind\` разрешён только равным роли, \`org_id\` —
    только своей организации. Длины совпадают с VARCHAR в \`database/init.sql\`
    и считаются в символах, а не в байтах.
    `,
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 200,
        },
        kind: {
            type: 'Enum',
        },
        org_id: {
            type: 'number',
            description: `Своя организация. Не задана — берётся организация владельца; её отсутствие даёт 404.`,
            isNullable: true,
            format: 'int64',
        },
        category_id: {
            type: 'number',
            description: `Направление из справочника; должно подходить виду карточки`,
            isRequired: true,
            format: 'int64',
        },
        description: {
            type: 'string',
            description: `TEXT без ограничения длины; пустая строка → null (§7.4).`,
            isNullable: true,
        },
        format: {
            type: 'Enum',
        },
        lesson_type: {
            type: 'Enum',
            isNullable: true,
        },
        phone: {
            type: 'string',
            isNullable: true,
            maxLength: 32,
        },
    },
} as const;
