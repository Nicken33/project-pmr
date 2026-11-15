/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Time = {
    type: 'string',
    description: `Занятие идёт в этот момент (внутри \`time_from…time_to\`), §5.6. Ровно
    \`ЧЧ:ММ\` из пяти символов: \`9:00\` даст \`400\`, \`09:00\` — нет.
    `,
    pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
} as const;
