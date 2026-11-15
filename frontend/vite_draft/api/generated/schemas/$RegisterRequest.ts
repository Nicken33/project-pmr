/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RegisterRequest = {
    description: `\`name\` необязателен — тогда в базе остаётся пустое имя, а фронтовое
    представление строит его из почты. Пароль считается по символам, а не по
    байтам: русский из восьми букв — восемь рун, хотя в UTF-8 он длиннее.
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
        name: {
            type: 'string',
            maxLength: 120,
        },
    },
} as const;
