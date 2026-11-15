/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $LoginRequest = {
    description: `Пара почта/пароль. Лишние поля тело не расширяет: \`account_type\` и
    \`tester\` из запроса не читаются, роль берётся из строки \`users\`.
    `,
    properties: {
        email: {
            type: 'string',
            isRequired: true,
            format: 'email',
        },
        password: {
            type: 'string',
            isRequired: true,
            minLength: 8,
        },
    },
} as const;
