/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ReportDecisionRequest = {
    description: `Тело решения по жалобе (§3.9.7).`,
    properties: {
        action: {
            type: 'Enum',
            isRequired: true,
        },
        reason: {
            type: 'string',
            description: `Основание из перечня §12.15. Обязательно при hide, снимается при dismiss. До 120 символов.`,
        },
    },
} as const;
