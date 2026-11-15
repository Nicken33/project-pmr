/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgeRange } from './AgeRange';
/**
 * Элемент каталога. Плоские `city`/`district`/`address`/`lat`/`lng` взяты из
 * подходящей точки, `age`/`price` — из подходящей группы (§7.10, §7.11);
 * группа и точка выбираются по `DISTINCT ON` и не обязаны совпадать между
 * собой на экране.
 *
 */
export type Card = {
    /**
     * Числовой id карточки в виде строки — историческое поведение.
     */
    id: string;
    slug: string;
    name: string;
    kind: Card.kind;
    org_id: number;
    /**
     * Название города подходящей точки.
     */
    city: string;
    age: AgeRange;
    /**
     * Сайт организации.
     */
    link: string | null;
    /**
     * Описание занятия.
     */
    description: string | null;
    /**
     * Район точки; у онлайн-занятий может быть null.
     */
    district: string | null;
    /**
     * Минимум из `price_from` по группам. `0` — бесплатно, `null` — не указана.
     */
    price: number | null;
    /**
     * Имя направления.
     */
    category: string | null;
    org_slug: string;
    org_name: string;
    /**
     * Тип организации по CHECK в схеме.
     */
    org_type: Card.org_type;
    /**
     * Телефон организации; пустая строка, если телефона нет (не null — исторический тип).
     */
    phone: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    location_id: number | null;
    location_name: string | null;
    group_id: number | null;
    group_name: string | null;
    /**
     * Верх диапазона; null = одноместный диапазон.
     */
    price_to: number | null;
    price_period: Card.price_period | null;
    /**
     * Места в подходящей группе.
     */
    seats: number | null;
    category_id: number | null;
    category_slug: string | null;
    /**
     * Родительское направление.
     */
    super_category: string | null;
    super_category_slug: string | null;
    format: Card.format;
    /**
     * Формат занятия; у услуг всегда null.
     */
    lesson_type: Card.lesson_type | null;
    /**
     * В публичной выдаче бывает только published.
     */
    status: Card.status;
    /**
     * Контакты карточки подтверждены менее 90 дней назад (§11.3). Считается по `contacts_verified_at` самой карточки, а не организации или точки.
     */
    verified: boolean;
    /**
     * Дата последней сверки контактов карточки (§11). Ключ присутствует
     * всегда: `null` — контактов не касались, строка `ГГГГ-ММ-ДД` — дату
     * сверяли в этот день. `verified:false` без даты не отличает
     * «сверяли давно» от «никогда», поэтому признак и дата едут раздельно.
     *
     */
    contacts_verified_at: string | null;
    /**
     * Первое фото карточки, путь относительно корня раздачи (/media/…).
     */
    photo: string | null;
    /**
     * Считается на лету (§7.13).
     */
    groups_count: number;
    /**
     * Считается на лету (§7.13).
     */
    locations_count: number;
    updated_at: string;
};
export namespace Card {
    export enum kind {
        ACTIVITY = 'activity',
        SERVICE = 'service',
    }
    /**
     * Тип организации по CHECK в схеме.
     */
    export enum org_type {
        _ = 'школа',
        _ = 'студия',
        _ = 'дом творчества',
        _ = 'спортшкола',
        _ = 'частный мастер',
    }
    export enum price_period {
        SESSION = 'session',
        MONTH = 'month',
        COURSE = 'course',
    }
    export enum format {
        ONLINE = 'online',
        OFFLINE = 'offline',
        BOTH = 'both',
    }
    /**
     * Формат занятия; у услуг всегда null.
     */
    export enum lesson_type {
        INDIVIDUAL = 'individual',
        GROUP = 'group',
        BOTH = 'both',
    }
    /**
     * В публичной выдаче бывает только published.
     */
    export enum status {
        DRAFT = 'draft',
        ON_MODERATION = 'on_moderation',
        REJECTED = 'rejected',
        PUBLISHED = 'published',
    }
}

