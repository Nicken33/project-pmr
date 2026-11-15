/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Category } from '../models/Category';
import type { Place } from '../models/Place';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DictionariesService {
    /**
     * Дерево направлений (§9.5)
     * Два уровня: корни с `children` и листовые направления без этого ключа
     * (§7.12 — справочник не бывает пустым). Порядок — `order_num`, затем `id`.
     * Ссылку на направление фильтр `category` принимает по `id`, `slug` или
     * имени; родитель тянет все дочерние направления (§5.5).
     *
     * @returns Category корни направлений
     * @throws ApiError
     */
    public static listCategories(): CancelablePromise<Array<Category>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/categories',
            errors: {
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
    /**
     * Города (§9.6)
     * Справочник по `order_num`, затем имени. Ключ `city_id` у городов отсутствует.
     * @returns Place массив городов
     * @throws ApiError
     */
    public static listCities(): CancelablePromise<Array<Place>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/cities',
            errors: {
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
    /**
     * Районы одного города (§9.6)
     * Город обязателен: одноимённый район встречается в нескольких городах, и
     * угадывать сервер не вправе (§5.4). Без `city` — `400` с полем `city`.
     *
     * @returns Place массив районов города
     * @throws ApiError
     */
    public static listDistricts({
        city,
    }: {
        /**
         * Город — `id`, `slug` или имя. Без него справочник районов не отдаётся.
         */
        city: string,
    }): CancelablePromise<Array<Place>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/districts',
            query: {
                'city': city,
            },
            errors: {
                400: `Значение параметра не прошло проверку (§5). \`fields\` — имя параметра →
                подсказка на русском; подсказку можно показать пользователю как есть.
                `,
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
    /**
     * @deprecated
     * LEGACY: тот же справочник, что /api/v1/categories
     * @returns Category корни направлений
     * @throws ApiError
     */
    public static listCategoriesLegacy(): CancelablePromise<Array<Category>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/categories',
            errors: {
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
    /**
     * @deprecated
     * LEGACY: тот же справочник, что /api/v1/cities
     * @returns Place массив городов
     * @throws ApiError
     */
    public static listCitiesLegacy(): CancelablePromise<Array<Place>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/cities',
            errors: {
                500: `Внутренняя ошибка. Текст ошибки базы наружу не уходит — он может содержать
                имена таблиц и фрагменты запроса; в лог сервера он обязан попасть (§6.7).
                `,
            },
        });
    }
}
