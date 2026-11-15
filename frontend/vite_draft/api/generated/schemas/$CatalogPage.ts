/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CatalogPage = {
    description: `Форма ответа каталога с пагинацией (§9.4).`,
    properties: {
        items: {
            type: 'array',
            contains: {
                type: 'Card',
            },
            isRequired: true,
        },
        total: {
            type: 'number',
            description: `Сколько карточек подходит под фильтр всего, а не на странице.`,
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
