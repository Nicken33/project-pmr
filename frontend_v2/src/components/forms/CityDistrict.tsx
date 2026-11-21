import { useEffect, useState } from 'react'
import { Api } from '../../api/endpoints'
import type { District } from '../../api/types'
import { useRefs } from '../../state/refs'
import { SelectField } from './Fields'

/** Пара «Город → Район» со справочниками из API. */
export function CityDistrict({
  city,
  district,
  onChange,
  required,
  errors,
}: {
  city: string
  district: string
  onChange: (city: string, district: string) => void
  required?: boolean
  errors?: { city?: string; district?: string }
}) {
  const { cities } = useRefs()
  const [list, setList] = useState<District[]>([])
  // «Другой район» = район не указан (в API уходит null); помним выбор, чтобы он оставался в списке
  const [other, setOther] = useState(false)
  useEffect(() => {
    if (!city) return setList([])
    Api.districts(city).then(setList, () => setList([]))
  }, [city])

  return (
    <>
      <SelectField
        label="Город"
        required={required}
        value={city}
        onChange={(e) => {
          setOther(false)
          onChange(e.target.value, '')
        }}
        error={errors?.city}
      >
        <option value="">Выберите город</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Район"
        value={other && !district ? '__other' : district}
        disabled={!city || !list.length}
        onChange={(e) => {
          const v = e.target.value
          setOther(v === '__other')
          onChange(city, v === '__other' ? '' : v)
        }}
        error={errors?.district}
      >
        <option value="">{city && !list.length ? 'Районов нет' : 'Выберите район'}</option>
        {list.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
        {list.length > 0 && <option value="__other">Другой (нет в списке)</option>}
      </SelectField>
    </>
  )
}
