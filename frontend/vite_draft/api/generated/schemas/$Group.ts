/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Group = {
    description: `Группа занятия (§7.10). \`seats\` на уровне группы и на строке расписания — разные значения; строка может быть null, если места считаны по группе.`,
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
        age_from: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            maximum: 120,
            minimum: 1,
        },
        age_to: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            maximum: 120,
            minimum: 1,
        },
        price_from: {
            type: 'number',
            description: `0 — бесплатно, null — не указана.`,
            isRequired: true,
            isNullable: true,
        },
        price_to: {
            type: 'number',
            isRequired: true,
            isNullable: true,
        },
        price_period: {
            type: 'Enum',
            isRequired: true,
            isNullable: true,
        },
        location_id: {
            type: 'number',
            description: `Точка, в которой ведётся группа.`,
            isRequired: true,
            format: 'int64',
        },
        seats: {
            type: 'number',
            isRequired: true,
            isNullable: true,
        },
        schedules: {
            type: 'array',
            contains: {
                type: 'Lesson',
            },
            isRequired: true,
        },
    },
} as const;
