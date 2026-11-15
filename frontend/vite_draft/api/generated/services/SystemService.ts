/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Health } from '../models/Health';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SystemService {
    /**
     * Живость процесса и соединения с базой (§9.1)
     * База — отдельным признаком: процесс может отвечать, но без БД каталог всё
     * равно пустой, и стенд должен видеть это сам. Версия собирается
     * `-ldflags "-X …handlers.Version=…"`; на локальной сборке там `unknown`.
     * Через Caddy этот путь не проброшен — проверять прямым запросом к api.
     *
     * @returns Health сервер и база живы
     * @throws ApiError
     */
    public static health(): CancelablePromise<Health> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
            errors: {
                503: `сервер отвечает, база недоступна`,
            },
        });
    }
}
