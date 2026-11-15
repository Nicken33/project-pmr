/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Строка расписания. Время локальное, без даты и таймзоны.
 */
export type Lesson = {
    /**
     * 1 — понедельник … 7 — воскресенье.
     */
    weekday: number;
    time_from: string;
    time_to: string;
    note: string | null;
    seats: number | null;
};

