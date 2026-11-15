/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Error = {
    description: `Единый конверт ошибок (§9.3). \`code\` совпадает с HTTP-статусом.`,
    properties: {
        error: {
            properties: {
                code: {
                    type: 'number',
                    isRequired: true,
                },
                message: {
                    type: 'string',
                    isRequired: true,
                },
                fields: {
                    type: 'dictionary',
                    contains: {
                        type: 'string',
                    },
                },
            },
            isRequired: true,
        },
    },
} as const;
