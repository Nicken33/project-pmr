/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Media = {
    description: `Фото или видео (§7.14, §14 — про источник и правообладателя).`,
    properties: {
        path: {
            type: 'string',
            description: `Путь относительно корня раздачи; раздает Caddy \`handle_path /media/*\` из /srv/media.`,
            isRequired: true,
        },
        caption: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        source_url: {
            type: 'string',
            description: `Откуда взято (§14).`,
            isRequired: true,
            isNullable: true,
        },
        author: {
            type: 'string',
            description: `Правообладатель (§14).`,
            isRequired: true,
            isNullable: true,
        },
        order_num: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
