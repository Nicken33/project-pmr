/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $DecisionRequest = {
    description: `Тело решения по заявке (§3.9.3). Неизвестные поля отклоняются, а не
    игнорируются: опечатка в имени поля иначе означала бы «решение
    отправилось не тем».
    `,
    properties: {
        action: {
            type: 'Enum',
            isRequired: true,
        },
        reason: {
            type: 'string',
            description: `Пункт типового списка причин (§3.9.3). Обязателен при reject, при approve не сохраняется. До 120 символов.`,
        },
        comment: {
            type: 'string',
            description: `Свободный текст владельцу. При approve не сохраняется. До 1000 символов.`,
        },
    },
} as const;
