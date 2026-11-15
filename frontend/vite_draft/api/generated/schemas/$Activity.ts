/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Activity = {
    type: 'all-of',
    description: `Карточка целиком (§9.3) — плоские поля плюс раскрытые списки.`,
    contains: [{
        type: 'Card',
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
                    type: 'Media',
                },
                isRequired: true,
            },
            videos: {
                type: 'array',
                contains: {
                    type: 'Media',
                },
                isRequired: true,
            },
        },
    }],
} as const;
