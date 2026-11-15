/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedMedia = {
    type: 'all-of',
    description: `Медиа кабинета: канонический \`Media\` плюс \`id\` строки. Без id кабинет не
    может удалить файл — \`DELETE …/media/{mediaID}\` требует именно его.
    Публичный контракт \`photos[]\`/\`videos[]\` этот тип не получает и не меняется.
    `,
    contains: [{
        type: 'Media',
    }, {
        properties: {
            id: {
                type: 'number',
                isRequired: true,
                format: 'int64',
            },
        },
    }],
} as const;
