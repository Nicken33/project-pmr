/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Group } from './Group';
import type { Location } from './Location';
import type { Organization } from './Organization';
import type { OwnedCard } from './OwnedCard';
import type { OwnedMedia } from './OwnedMedia';
/**
 * Деталь кабинета в форме §9.3: те же organization, locations, groups,
 * photos, videos, что у публичной карточки. Отличие принципиальное —
 * публичный `GET /api/v1/activities/{slug}` отдаёт только `published`, а
 * владелец обязан видеть и черновик, и отказ, и анкету на проверке.
 *
 */
export type OwnedActivity = (OwnedCard & {
    organization: Organization | null;
    locations: Array<Location>;
    groups: Array<Group>;
    photos: Array<OwnedMedia>;
    videos: Array<OwnedMedia>;
});

