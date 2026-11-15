/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OwnedCard } from './OwnedCard';
/**
 * Ответ на подачу анкеты. `application_id` и `submitted_at` — строка
 * `moderation_applications`, которую модератор увидит в
 * `/api/v1/moderation/queue`; отдельной очереди у владельца нет.
 *
 */
export type OwnedSubmitResult = {
    card: OwnedCard;
    application_id: number;
    submitted_at: string;
};

