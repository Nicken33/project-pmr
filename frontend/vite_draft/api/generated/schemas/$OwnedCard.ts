/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedCard = {
    type: 'all-of',
    description: `Карточка глазами её владельца: тот же \`Card\`, что в каталоге (имена полей
    не меняются, витрина и кабинет читают их одним парсером), плюс то, что
    каталог не показывает — владелец, активность, причина отказа и дата
    создания. В списке видны все статусы, включая \`draft\` и \`rejected\`.
    `,
    contains: [{
        type: 'Card',
    }, {
        properties: {
            owner_id: {
                type: 'number',
                description: `\`cards.owner_id\` NULL-able: карточка без владельца не принадлежит никому.`,
                isRequired: true,
                isNullable: true,
                format: 'int64',
            },
            is_active: {
                type: 'boolean',
                isRequired: true,
            },
            reject_reason: {
                type: 'string',
                description: `Основание отказа модератора; показывается владельцу как есть.`,
                isRequired: true,
                isNullable: true,
            },
            created_at: {
                type: 'string',
                isRequired: true,
                format: 'date-time',
            },
        },
    }],
} as const;
