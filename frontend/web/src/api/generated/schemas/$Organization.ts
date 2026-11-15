/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Organization = {
    properties: {
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        slug: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        type: {
            type: 'Enum',
            isRequired: true,
        },
        description: {
            type: 'string',
            isNullable: true,
        },
        phone: {
            type: 'string',
            description: `Пустая строка, если телефона нет.`,
            isRequired: true,
        },
        email: {
            type: 'string',
            isNullable: true,
        },
        site: {
            type: 'string',
            isNullable: true,
        },
        address: {
            type: 'string',
            isNullable: true,
        },
        city: {
            type: 'string',
            description: `Название города организации — не путать с городом точки проведения.`,
            isNullable: true,
        },
        contacts_verified_at: {
            type: 'string',
            description: `Дата подтверждения контактов, ГГГГ-ММ-ДД.`,
            isNullable: true,
            format: 'date',
        },
    },
} as const;
