// Иконки верхних направлений. Направления приходят из API, иконку подбираем по названию.
import all from '../assets/cat/all.svg'
import art from '../assets/cat/art.svg'
import sport from '../assets/cat/sport.svg'
import tech from '../assets/cat/tech.svg'
import edu from '../assets/cat/edu.svg'
import services from '../assets/cat/services.svg'
import skills from '../assets/cat/skills.svg'
import social from '../assets/cat/social.svg'
import travel from '../assets/cat/travel.svg'
import animals from '../assets/cat/animals.svg'
import other from '../assets/cat/other.svg'
import map from '../assets/cat/map.svg'

export const ICON_ALL = all
export const ICON_MAP = map

const rules: [RegExp, string][] = [
  [/творч|искусств|рисов|музык/i, art],
  [/спорт|физич|фитнес/i, sport],
  [/технол|програм|игр|it/i, tech],
  [/обуч|школ|язык|дет/i, edu],
  [/услуг|красот|груминг|массаж/i, services],
  [/практич|навык|ремесл|мастер/i, skills],
  [/социал|волонт|общ/i, social],
  [/путеш|отдых|туризм|актив/i, travel],
  [/живот|природ|питом/i, animals],
]

export function categoryIcon(name: string) {
  for (const [re, icon] of rules) if (re.test(name)) return icon
  return other
}

/** Пояснение для подсказки над категорией: первые подкатегории через запятую. */
export function categoryHint(children?: { name: string }[]) {
  return (children ?? [])
    .slice(0, 6)
    .map((c) => c.name.toLowerCase())
    .join(', ')
    .replace(/^./, (s) => s.toUpperCase())
}
