/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MediaDeleted = {
    description: `Ответ на удаление (200). Строки в базе больше нет, файл снят с диска.
    \`deleted: true\` отличает успех от 404, а \`id\`/\`card_id\` дают клиенту понять,
    какую карточку перечитать.
    `,
    properties: {
        deleted: {
            type: 'boolean',
            isRequired: true,
        },
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        card_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
    },
} as const;
