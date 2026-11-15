/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Lesson } from './Lesson';
/**
 * Группа занятия (§7.10). `seats` на уровне группы и на строке расписания — разные значения; строка может быть null, если места считаны по группе.
 */
export type Group = {
    id: number;
    name: string | null;
    age_from: number | null;
    age_to: number | null;
    /**
     * 0 — бесплатно, null — не указана.
     */
    price_from: number | null;
    price_to: number | null;
    price_period: Group.price_period | null;
    /**
     * Точка, в которой ведётся группа.
     */
    location_id: number;
    seats: number | null;
    /**
     * По строке на день (§8, таблица 6); у группы без расписания — [].
     */
    schedules: Array<Lesson>;
};
export namespace Group {
    export enum price_period {
        SESSION = 'session',
        MONTH = 'month',
        COURSE = 'course',
    }
}

