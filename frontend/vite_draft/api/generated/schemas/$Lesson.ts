/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Lesson = {
    description: `Строка расписания. Время локальное, без даты и таймзоны.`,
    properties: {
        weekday: {
            type: 'number',
            description: `1 — понедельник … 7 — воскресенье.`,
            isRequired: true,
            maximum: 7,
            minimum: 1,
        },
        time_from: {
            type: 'string',
            isRequired: true,
            pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        time_to: {
            type: 'string',
            isRequired: true,
            pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        note: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        seats: {
            type: 'number',
            isRequired: true,
            isNullable: true,
        },
    },
} as const;
