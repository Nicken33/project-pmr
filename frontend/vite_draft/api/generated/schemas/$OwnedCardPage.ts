/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedCardPage = {
    description: `Форма ответа кабинета с пагинацией (§9.4). \`items\` пустой массив, а не null.`,
    properties: {
        items: {
            type: 'array',
            contains: {
                type: 'OwnedCard',
            },
            isRequired: true,
        },
        total: {
            type: 'number',
            description: `Сколько карточек владельца подходит под фильтр всего`,
            isRequired: true,
        },
        page: {
            type: 'number',
            isRequired: true,
        },
        limit: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
