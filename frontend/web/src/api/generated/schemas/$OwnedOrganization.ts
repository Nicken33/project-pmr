/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedOrganization = {
    type: 'all-of',
    description: `Организация владельца целиком. \`slug\`, \`owner_id\`, \`publish_basis\`,
    \`contacts_verified_at\` и \`is_active\` здесь читаются, но не пишутся:
    публичный адрес и основание публикации — не самообслуживание (§11.8).
    `,
    contains: [{
        type: 'Organization',
    }, {
        properties: {
            city_id: {
                type: 'number',
                isRequired: true,
                isNullable: true,
                format: 'int64',
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
            owner_id: {
                type: 'number',
                isRequired: true,
                isNullable: true,
                format: 'int64',
            },
            publish_basis: {
                type: 'string',
                description: `Основание публикации (§11.8). Меняет модератор, не владелец.`,
                isRequired: true,
            },
            is_active: {
                type: 'boolean',
                isRequired: true,
            },
            created_at: {
                type: 'string',
                isRequired: true,
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                isRequired: true,
                format: 'date-time',
            },
        },
    }],
} as const;
