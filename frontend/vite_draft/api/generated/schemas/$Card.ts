/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Card = {
    description: `Элемент каталога. Плоские \`city\`/\`district\`/\`address\`/\`lat\`/\`lng\` взяты из
    подходящей точки, \`age\`/\`price\` — из подходящей группы (§7.10, §7.11);
    группа и точка выбираются по \`DISTINCT ON\` и не обязаны совпадать между
    собой на экране.
    `,
    properties: {
        id: {
            type: 'string',
            description: `Числовой id карточки в виде строки — историческое поведение.`,
            isRequired: true,
        },
        slug: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        kind: {
            type: 'Enum',
            isRequired: true,
        },
        org_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        city: {
            type: 'string',
            description: `Название города подходящей точки.`,
            isRequired: true,
        },
        age: {
            type: 'AgeRange',
            isRequired: true,
        },
        link: {
            type: 'string',
            description: `Сайт организации.`,
            isRequired: true,
            isNullable: true,
        },
        description: {
            type: 'string',
            description: `Описание занятия.`,
            isRequired: true,
            isNullable: true,
        },
        district: {
            type: 'string',
            description: `Район точки; у онлайн-занятий может быть null.`,
            isRequired: true,
            isNullable: true,
        },
        price: {
            type: 'number',
            description: `Минимум из \`price_from\` по группам. \`0\` — бесплатно, \`null\` — не указана.`,
            isRequired: true,
            isNullable: true,
        },
        category: {
            type: 'string',
            description: `Имя направления.`,
            isRequired: true,
            isNullable: true,
        },
        org_slug: {
            type: 'string',
            isRequired: true,
        },
        org_name: {
            type: 'string',
            isRequired: true,
        },
        org_type: {
            type: 'Enum',
            isRequired: true,
        },
        phone: {
            type: 'string',
            description: `Телефон организации; пустая строка, если телефона нет (не null — исторический тип).`,
            isRequired: true,
        },
        address: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        lat: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'double',
        },
        lng: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'double',
        },
        location_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        location_name: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        group_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        group_name: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        price_to: {
            type: 'number',
            description: `Верх диапазона; null = одноместный диапазон.`,
            isRequired: true,
            isNullable: true,
        },
        price_period: {
            type: 'Enum',
            isRequired: true,
            isNullable: true,
        },
        seats: {
            type: 'number',
            description: `Места в подходящей группе.`,
            isRequired: true,
            isNullable: true,
        },
        category_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        category_slug: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        super_category: {
            type: 'string',
            description: `Родительское направление.`,
            isRequired: true,
            isNullable: true,
        },
        super_category_slug: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        format: {
            type: 'Enum',
            isRequired: true,
        },
        lesson_type: {
            type: 'Enum',
            isRequired: true,
            isNullable: true,
        },
        status: {
            type: 'Enum',
            isRequired: true,
        },
        verified: {
            type: 'boolean',
            description: `Контакты карточки подтверждены менее 90 дней назад (§11.3). Считается по \`contacts_verified_at\` самой карточки, а не организации или точки.`,
            isRequired: true,
        },
        contacts_verified_at: {
            type: 'string',
            description: `Дата последней сверки контактов карточки (§11). Ключ присутствует
            всегда: \`null\` — контактов не касались, строка \`ГГГГ-ММ-ДД\` — дату
            сверяли в этот день. \`verified:false\` без даты не отличает
            «сверяли давно» от «никогда», поэтому признак и дата едут раздельно.
            `,
            isRequired: true,
            isNullable: true,
            format: 'date',
        },
        photo: {
            type: 'string',
            description: `Первое фото карточки, путь относительно корня раздачи (/media/…).`,
            isRequired: true,
            isNullable: true,
        },
        groups_count: {
            type: 'number',
            description: `Считается на лету (§7.13).`,
            isRequired: true,
        },
        locations_count: {
            type: 'number',
            description: `Считается на лету (§7.13).`,
            isRequired: true,
        },
        updated_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
