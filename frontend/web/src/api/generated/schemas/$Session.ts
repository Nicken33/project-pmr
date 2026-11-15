/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Session = {
    description: `Ответ входа и \`GET /api/auth/me\` — один тип, чтобы поля не разъехались.
    Пустые строки не показываются (\`omitempty\`), поэтому аноним получает
    ровно \`{"authenticated": false, "tester": false}\`.
    `,
    properties: {
        authenticated: {
            type: 'boolean',
            isRequired: true,
        },
        tester: {
            type: 'boolean',
            isRequired: true,
        },
        role: {
            type: 'string',
            description: `\`account_type\` из \`users\` (§7.8) либо \`tester\` для входа проверкой.`,
        },
        name: {
            type: 'string',
        },
        email: {
            type: 'string',
        },
        picture: {
            type: 'string',
            description: `Аватар из Google (\`avatar_path\` в базе).`,
        },
        provider: {
            type: 'string',
            description: `\`local\` — почта и пароль, \`google\` — токен сервиса, \`token\` — вход проверкой.`,
        },
    },
} as const;
