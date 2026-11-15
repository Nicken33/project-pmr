/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedSubmitResult = {
    description: `Ответ на подачу анкеты. \`application_id\` и \`submitted_at\` — строка
    \`moderation_applications\`, которую модератор увидит в
    \`/api/v1/moderation/queue\`; отдельной очереди у владельца нет.
    `,
    properties: {
        card: {
            type: 'OwnedCard',
            isRequired: true,
        },
        application_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        submitted_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
