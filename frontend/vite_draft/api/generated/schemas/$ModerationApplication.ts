/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModerationApplication = {
    description: `Заявка в очереди модератора (§3.9.1, §8 табл. 11) — строка
    \`moderation_applications\` вместе с карточкой, организацией и направлением,
    чтобы превью «как её увидят, со всеми точками и всеми группами» собиралось
    одним ответом. \`status\` — статус заявки, \`card_status\` — статус карточки
    (§8 табл. 1): словари разные, «одобрено» и «опубликовано» — не одно и то
    же (§7.18).
    `,
    properties: {
        id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        card_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        slug: {
            type: 'string',
            isRequired: true,
        },
        title: {
            type: 'string',
            isRequired: true,
        },
        kind: {
            type: 'Enum',
            isRequired: true,
        },
        status: {
            type: 'Enum',
            isRequired: true,
        },
        card_status: {
            type: 'Enum',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        format: {
            type: 'string',
            isRequired: true,
        },
        lesson_type: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        phone: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        category: {
            type: 'string',
            description: `Направление карточки; null`,
            isRequired: true,
            isNullable: true,
        },
        category_slug: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        super_category: {
            type: 'string',
            description: `Родительская ветка направления (§9.5).`,
            isRequired: true,
            isNullable: true,
        },
        super_category_slug: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        organization_id: {
            type: 'number',
            isRequired: true,
            format: 'int64',
        },
        organization_slug: {
            type: 'string',
            isRequired: true,
        },
        organization_name: {
            type: 'string',
            isRequired: true,
        },
        organization_type: {
            type: 'string',
            isRequired: true,
        },
        organization_city: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        groups: {
            type: 'array',
            contains: {
                type: 'Group',
            },
            isRequired: true,
        },
        locations: {
            type: 'array',
            contains: {
                type: 'Location',
            },
            isRequired: true,
        },
        photos: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        groups_count: {
            type: 'number',
            description: `Число групп анкеты — нужно строке очереди без раскрытия списков.`,
            isRequired: true,
        },
        locations_count: {
            type: 'number',
            description: `Число различных точек у групп анкеты.`,
            isRequired: true,
        },
        submitted_at: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        reject_reason: {
            type: 'string',
            description: `Причина отказа для владельца (§3.9.3); null у pending и у approve.`,
            isRequired: true,
            isNullable: true,
        },
        decided_at: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        decided_by: {
            type: 'string',
            description: `Имя модератора из users; null`,
            isRequired: true,
            isNullable: true,
        },
        decided_by_id: {
            type: 'number',
            isRequired: true,
            isNullable: true,
            format: 'int64',
        },
        created_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updated_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
