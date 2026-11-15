/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Location = {
    description: `Точка проведения (§7.11).`,
    properties: {
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        name: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        city: {
            type: 'string',
            isRequired: true,
        },
        district: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        address: {
            type: 'string',
            isRequired: true,
        },
        lat: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'double',
        },
        lng: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'double',
        },
        phone: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        contacts_verified_at: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date',
        },
        groups_count: {
            type: 'number',
            description: `Сколько групп этой карточки ведутся именно в этой точке.`,
            isRequired: true,
        },
        photos: {
            type: 'array',
            contains: {
                type: 'Media',
            },
            isRequired: true,
        },
    },
} as const;
