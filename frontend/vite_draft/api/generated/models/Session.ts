/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Ответ входа и `GET /api/auth/me` — один тип, чтобы поля не разъехались.
 * Пустые строки не показываются (`omitempty`), поэтому аноним получает
 * ровно `{"authenticated": false, "tester": false}`.
 *
 */
export type Session = {
    authenticated: boolean;
    tester: boolean;
    /**
     * `account_type` из `users` (§7.8) либо `tester` для входа проверкой.
     */
    role?: string;
    name?: string;
    email?: string;
    /**
     * Аватар из Google (`avatar_path` в базе).
     */
    picture?: string;
    /**
     * `local` — почта и пароль, `google` — токен сервиса, `token` — вход проверкой.
     */
    provider?: string;
};

