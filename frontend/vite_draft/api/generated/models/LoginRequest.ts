/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Пара почта/пароль. Лишние поля тело не расширяет: `account_type` и
 * `tester` из запроса не читаются, роль берётся из строки `users`.
 *
 */
export type LoginRequest = {
    email: string;
    password: string;
};

