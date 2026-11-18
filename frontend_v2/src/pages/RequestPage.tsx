import { NotFoundRequest } from '../components/catalog/NotFoundHelp'
import { hasFeature } from '../features'
import { CONTACT_EMAIL } from '../config'

/** «Не нашли занятие?» из подвала (ТЗ §3.12). */
export default function RequestPage() {
  return (
    <div className="narrow panel prose">
      <h1>Не нашли занятие?</h1>
      {hasFeature('not_found_requests') ? (
        <NotFoundRequest query="" city="" />
      ) : (
        <p>
          Напишите нам, что ищете и в каком городе: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Мы учтём это, когда будем пополнять каталог.
        </p>
      )}
    </div>
  )
}
