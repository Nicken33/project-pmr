/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OwnedOrganizationInput = {
    description: `Редактируемые поля организации (§8, табл. 2). Телефон обязателен: карточка
    без телефона не проходит проверку (§7.8). Тип — только из закрытого
    CHECK-списка. Координаты заполняются только вместе и только в рамке
    Приднестровья. Slug и поля идентичности сюда не попадают вовсе.
    `,
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 200,
        },
        type: {
            type: 'Enum',
            isRequired: true,
        },
        description: {
            type: 'string',
            isNullable: true,
        },
        phone: {
            type: 'string',
            isRequired: true,
            maxLength: 32,
            minLength: 1,
        },
        email: {
            type: 'string',
            isNullable: true,
            format: 'email',
            maxLength: 254,
        },
        site: {
            type: 'string',
            description: `Адрес со схемой \`http://\` или \`https://\` и непустым хостом.`,
            isNullable: true,
            maxLength: 500,
        },
        address: {
            type: 'string',
            isNullable: true,
            maxLength: 300,
        },
        city_id: {
            type: 'number',
            isNullable: true,
            format: 'int64',
        },
        lat: {
            type: 'number',
            isNullable: true,
            format: 'double',
            maximum: 48.9,
            minimum: 45.9,
        },
        lng: {
            type: 'number',
            isNullable: true,
            format: 'double',
            maximum: 30.6,
            minimum: 27.4,
        },
    },
} as const;
