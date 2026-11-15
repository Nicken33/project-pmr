/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Фото или видео (§7.14, §14 — про источник и правообладателя).
 */
export type Media = {
    /**
     * Путь относительно корня раздачи; раздает Caddy `handle_path /media*` из /srv/media.
     */
    path: string;
    caption: string | null;
    /**
     * Откуда взято (§14).
     */
    source_url: string | null;
    /**
     * Правообладатель (§14).
     */
    author: string | null;
    order_num: number;
};

