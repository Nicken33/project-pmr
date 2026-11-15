/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Place = {
    description: `Город или район (§7.2, §9.6).`,
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
        city_id: {
            type: 'number',
            description: `Город района. Ключа нет у городов (\`omitempty\` и null по смыслу).`,
            isNullable: true,
            format: 'int64',
        },
    },
} as const;
