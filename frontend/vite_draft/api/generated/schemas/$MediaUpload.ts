/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MediaUpload = {
    type: 'all-of',
    description: `Ответ на успешную загрузку (201). Поля \`Media\` выходят ровно теми же
    именами, что в публичном \`photos[]\`/\`videos[]\`, поэтому клиент кладёт ответ
    в галерею без перевода; сверху добавлены \`id\` (им удаляют), \`card_id\` и
    \`kind\`. \`kind\` выбирает маршрут, а не форма — иначе фото можно было бы
    выдать за видео. \`path\` всегда начинается с \`/media/\`, как у засеянных
    строк: без префикса браузер отрендерил бы его как \`/cards/…\` и картинка
    молча стала бы 404.
    `,
    contains: [{
        type: 'Media',
    }, {
        properties: {
            id: {
                type: 'number',
                isRequired: true,
                format: 'int64',
            },
            card_id: {
                type: 'number',
                isRequired: true,
                format: 'int64',
            },
            kind: {
                type: 'Enum',
                isRequired: true,
            },
        },
    }],
} as const;
