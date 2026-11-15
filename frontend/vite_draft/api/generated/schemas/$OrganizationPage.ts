/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganizationPage = {
    properties: {
        organization: {
            type: 'all-of',
            contains: [{
                type: 'Organization',
            }],
            isRequired: true,
            isNullable: true,
        },
        activities: {
            type: 'array',
            contains: {
                type: 'Card',
            },
            isRequired: true,
        },
        total: {
            type: 'number',
            description: `Сколько карточек у организации всего; может превышать длину списка.`,
            isRequired: true,
        },
    },
} as const;
