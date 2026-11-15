/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Тело решения по жалобе (§3.9.7).
 */
export type ReportDecisionRequest = {
    /**
     * hide — скрыть с основанием, dismiss — оставить.
     */
    action: ReportDecisionRequest.action;
    /**
     * Основание из перечня §12.15. Обязательно при hide, снимается при dismiss. До 120 символов.
     */
    reason?: string;
};
export namespace ReportDecisionRequest {
    /**
     * hide — скрыть с основанием, dismiss — оставить.
     */
    export enum action {
        HIDE = 'hide',
        DISMISS = 'dismiss',
    }
}

