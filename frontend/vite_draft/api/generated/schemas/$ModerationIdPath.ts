/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModerationIdPath = {
    type: 'number',
    description: `Числовой \`id\` заявки или жалобы. Пустой — \`404\`, нечисловой или \`0\` и
    ниже — \`400\` с полем \`id\`: битый путь это ошибка клиента, а не
    отсутствующая запись.
    `,
    minimum: 1,
} as const;
