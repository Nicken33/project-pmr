/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Age = {
    type: 'number',
    description: `Возраст ребёнка. Группа без границы считается подходящей; услуги фильтр не
    затрагивает вовсе (§5.2). Вне 1–120 — \`400\`.
    `,
    maximum: 120,
    minimum: 1,
} as const;
