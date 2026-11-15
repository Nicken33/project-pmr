/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Media } from './Media';
/**
 * Ответ на успешную загрузку (201). Поля `Media` выходят ровно теми же
 * именами, что в публичном `photos[]`/`videos[]`, поэтому клиент кладёт ответ
 * в галерею без перевода; сверху добавлены `id` (им удаляют), `card_id` и
 * `kind`. `kind` выбирает маршрут, а не форма — иначе фото можно было бы
 * выдать за видео. `path` всегда начинается с `/media/`, как у засеянных
 * строк: без префикса браузер отрендерил бы его как `/cards/…` и картинка
 * молча стала бы 404.
 *
 */
export type MediaUpload = (Media & {
    id: number;
    card_id: number;
    kind: MediaUpload.kind;
});
export namespace MediaUpload {
    export enum kind {
        PHOTO = 'photo',
        VIDEO = 'video',
    }
}

