/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationPage } from '../models/OrganizationPage';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizationsService {
    /**
     * Организация и её опубликованные занятия
     * Отдельного фильтра «по организации» в каталоге нет (§5), поэтому список
     * собирается здесь. `activities[]` отсортированы по названию и ограничены
     * 100 карточками; `total` — сколько карточок у организации всего, их может
     * быть больше, чем в списке. Неактивная или несуществующая организация —
     * `404`. Принимает и slug, и числовое id.
     *
     * @returns OrganizationPage страница организации
     * @throws ApiError
     */
    public static getOrganization({
        slug,
    }: {
        /**
         * Slug или числовое id. Пустой — `404`, байты вне UTF-8 — `400` с полем `slug`.
         */
        slug: string,
    }): CancelablePromise<OrganizationPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations/{slug}',
            path: {
                'slug': slug,
            },
            errors: {
                400: `Параметр пути содержит байты вне UTF-8 — поле называется так же, как параметр в вызванном пути (\`slug\` или \`id\`).`,
                404: `Организация не найдена или снята с публикации.`,
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
    /**
     * @deprecated
     * LEGACY: тот же ответ, что /api/v1/organizations/{slug}
     * @returns OrganizationPage страница организации
     * @throws ApiError
     */
    public static getOrganizationLegacy({
        slug,
    }: {
        /**
         * Slug или числовое id. Пустой — `404`, байты вне UTF-8 — `400` с полем `slug`.
         */
        slug: string,
    }): CancelablePromise<OrganizationPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizations/{slug}',
            path: {
                'slug': slug,
            },
            errors: {
                400: `Параметр пути содержит байты вне UTF-8 — поле называется так же, как параметр в вызванном пути (\`slug\` или \`id\`).`,
                404: `Организация не найдена или снята с публикации.`,
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
}
