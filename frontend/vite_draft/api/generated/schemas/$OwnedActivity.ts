/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedActivity = {
    type: 'all-of',
    description: `Деталь кабинета в форме §9.3: те же organization, locations, groups,
    photos, videos, что у публичной карточки. Отличие принципиальное —
    публичный \`GET /api/v1/activities/{slug}\` отдаёт только \`published\`, а
    владелец обязан видеть и черновик, и отказ, и анкету на проверке.
    `,
    contains: [{
        type: 'OwnedCard',
    }, {
        properties: {
            organization: {
                type: 'all-of',
                contains: [{
                    type: 'Organization',
                }],
                isRequired: true,
                isNullable: true,
            },
            locations: {
                type: 'array',
                contains: {
                    type: 'Location',
                },
                isRequired: true,
            },
            groups: {
                type: 'array',
                contains: {
                    type: 'Group',
                },
                isRequired: true,
            },
            photos: {
                type: 'array',
                contains: {
                    type: 'OwnedMedia',
                },
                isRequired: true,
            },
            videos: {
                type: 'array',
                contains: {
                    type: 'OwnedMedia',
                },
                isRequired: true,
            },
        },
    }],
} as const;
