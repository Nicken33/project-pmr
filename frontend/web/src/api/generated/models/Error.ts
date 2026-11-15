/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Единый конверт ошибок (§9.3). `code` совпадает с HTTP-статусом.
 */
export type Error = {
    error: {
        code: number;
        message: string;
        /**
         * Заполняется только на 400 (и в будущем на 409): имя поля → подсказка.
         */
        fields?: Record<string, string>;
    };
};

