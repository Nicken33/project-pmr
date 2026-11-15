/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Health = {
    properties: {
        status: {
            type: 'Enum',
            isRequired: true,
        },
        database: {
            type: 'Enum',
            isRequired: true,
        },
        version: {
            type: 'string',
            description: `Собирается \`-ldflags\`; на локальной сборке — \`unknown\`.`,
            isRequired: true,
        },
    },
} as const;
