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
    onChange([...files, ...good].slice(0, max))
    Promise.all(good.map(imageWidth)).then((ws) => {
      const bad = good.filter((_, i) => ws[i] && ws[i] < MIN_GOOD_WIDTH)
      if (bad.length) setErr(`Фото меньше ${MIN_GOOD_WIDTH} px по ширине будут нечёткими: ${bad.map((b) => b.name).join(', ')}`)
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
      {files.length < max && (
        <button type="button" className="btn btn--soft btn--block photopick__more" onClick={() => input.current?.click()}>
          + Добавить {files.length ? 'ещё ' : ''}фото
        </button>
      )}
      {err && <span className="field-error">{err}</span>}
      <input
        ref={input}
        type="file"
        accept={OK.join(',')}
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
