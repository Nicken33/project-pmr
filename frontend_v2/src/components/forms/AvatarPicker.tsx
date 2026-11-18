import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { hasFeature, type Feature } from '../../features'

/**
 * Круглый выбор аватара/логотипа (макет «Анкета пользователя», «Анкета организации»).
 * Загрузка на сервер — заготовка: работает, когда включён флаг (avatar / org_logo).
 * Без флага круг показан неактивным с подсказкой.
 */
export function AvatarPicker({ file, onChange, feature, caption }: { file: File | null; onChange: (f: File | null) => void; feature: Feature; caption: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const on = hasFeature(feature)

  useEffect(() => {
    if (!file) return setUrl(null)
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  return (
    <div className={`avatar-pick ${on ? '' : 'is-off'}`}>
      <button type="button" className="avatar-pick__circle" disabled={!on} onClick={() => input.current?.click()} aria-label={caption}>
        {url ? <img src={url} alt="" /> : <Camera size={40} strokeWidth={1.4} />}
      </button>
      {url && (
        <button type="button" className="avatar-pick__rm" onClick={() => onChange(null)} aria-label="Убрать">
          <X size={12} />
        </button>
      )}
      <span className="avatar-pick__caption">{on ? caption : 'Можно будет добавить позже'}</span>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          if (f && f.size <= 10 * 1024 * 1024) onChange(f)
        }}
      />
    </div>
  )
}
