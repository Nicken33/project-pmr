/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $DecisionResult = {
    description: `Состояние заявки после решения — та же форма, что у GET .../queue и
    GET .../journal, чтобы кабинет не перерисовывал строку вслепую.
    `,
    properties: {
        application: {
            type: 'ModerationApplication',
            isRequired: true,
        },
        journal_entry: {
            type: 'all-of',
            description: `Строка, добавленная этим решением. null только на повторе уже
            принятого решения, когда заявка закрыта, а строки журнала у неё нет.
            `,
            contains: [{
                type: 'ModerationJournalEntry',
            }],
            isRequired: true,
            isNullable: true,
        },
        replayed: {
            type: 'boolean',
            description: `true — повтор ровно того же решения, новая строка журнала не создана.`,
            isRequired: true,
        },
    },
} as const;
