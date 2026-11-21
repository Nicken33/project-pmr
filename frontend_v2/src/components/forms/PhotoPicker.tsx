import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { imageWidth, MIN_GOOD_WIDTH } from '../../lib/imageCheck'

const OK = ['image/jpeg', 'image/png', 'image/webp']
const MAX = 10 * 1024 * 1024

/** Выбор фото с превью (JPG/PNG/WebP, до 10 МБ — как требует бэк). Первое — обложка. */
export function PhotoPicker({ files, onChange, max = 10 }: { files: File[]; onChange: (f: File[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f))
    setUrls(u)
    return () => u.forEach(URL.revokeObjectURL)
  }, [files])

  const add = (list: FileList | null) => {
    if (!list) return
    const good: File[] = []
    for (const f of Array.from(list)) {
      if (!OK.includes(f.type)) {
        setErr('Подходят только JPG, PNG или WebP')
        continue
      }
      if (f.size > MAX) {
        setErr('Файл больше 10 МБ')
        continue
      }
      good.push(f)
    }
    if (good.length) setErr('')
    // одно фото (обложка): новое заменяет старое; из нескольких выбранных берём первое
    const next = max === 1 ? good.slice(0, 1) : [...files, ...good].slice(0, max)
    if (!good.length) return
    onChange(next)
    const added = max === 1 ? next : good
    Promise.all(added.map(imageWidth)).then((ws) => {
      const small = ws.filter((w) => w && w < MIN_GOOD_WIDTH).length
      const extra = max === 1 && list.length > 1 ? 'Обложка — одно фото, взято первое из выбранных. ' : ''
      if (small) setErr(`${extra}Фото меньше ${MIN_GOOD_WIDTH} px по ширине — на сайте может выглядеть нечётким.`)
      else if (extra) setErr(extra.trim())
    })
  }

  return (
    <div className="photopick">
      {files.length === 0 ? (
        <button type="button" className="photopick__drop" onClick={() => input.current?.click()}>
          <Camera size={44} strokeWidth={1.4} />
          <span>Загрузить фото обложки</span>
        </button>
      ) : (
        <div className="photopick__grid">
          {urls.map((u, i) => (
            <div key={u} className="photopick__item">
              <img src={u} alt="" />
              {i === 0 && <span className="photopick__cover">Обложка</span>}
              <button type="button" aria-label="Убрать фото" onClick={() => onChange(files.filter((_, k) => k !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {(files.length < max || max === 1) && files.length > 0 && (
        <button type="button" className="btn btn--soft btn--block photopick__more" onClick={() => input.current?.click()}>
          {max === 1 ? 'Заменить фото' : '+ Добавить ещё фото'}
        </button>
      )}
      {err && <span className="field-hint photopick__warn">{err}</span>}
      <input
        ref={input}
        type="file"
        accept={OK.join(',')}
        multiple={max > 1}
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
