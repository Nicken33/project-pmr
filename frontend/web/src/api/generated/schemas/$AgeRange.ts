/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AgeRange = {
    description: `Возрастные границы группы; обе могут быть не заданы.`,
    properties: {
        min: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            maximum: 120,
            minimum: 1,
        },
        max: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            maximum: 120,
            minimum: 1,
        },
    },
} as const;
