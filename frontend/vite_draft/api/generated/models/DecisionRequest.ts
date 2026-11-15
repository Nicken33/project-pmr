/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Тело решения по заявке (§3.9.3). Неизвестные поля отклоняются, а не
 * игнорируются: опечатка в имени поля иначе означала бы «решение
 * отправилось не тем».
 *
 */
export type DecisionRequest = {
    action: DecisionRequest.action;
    /**
     * Пункт типового списка причин (§3.9.3). Обязателен при reject, при approve не сохраняется. До 120 символов.
     */
    reason?: string;
    /**
     * Свободный текст владельцу. При approve не сохраняется. До 1000 символов.
     */
    comment?: string;
};
export namespace DecisionRequest {
    export enum action {
        APPROVE = 'approve',
        REJECT = 'reject',
    }
}

