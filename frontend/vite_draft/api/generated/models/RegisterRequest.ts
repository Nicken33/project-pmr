/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * `name` необязателен — тогда в базе остаётся пустое имя, а фронтовое
 * представление строит его из почты. Пароль считается по символам, а не по
 * байтам: русский из восьми букв — восемь рун, хотя в UTF-8 он длиннее.
 *
 */
export type RegisterRequest = {
    email: string;
    password: string;
    name?: string;
};

