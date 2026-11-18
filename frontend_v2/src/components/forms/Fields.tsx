import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode
  icon?: ReactNode
  error?: string
  hint?: string
  required?: boolean
}

export function TextField({ label, icon, error, hint, required, className, ...rest }: InputProps) {
  const id = useId()
  return (
    <div className={`field ${className ?? ''}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="req"> *</span>}
        </label>
      )}
      <div className={icon ? 'input-icon' : undefined}>
        {icon}
        <input id={id} className="input" aria-invalid={!!error} required={required} {...rest} />
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function PasswordField({ label, icon, error, hint, required, className, ...rest }: InputProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div className={`field ${className ?? ''}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="req"> *</span>}
        </label>
      )}
      <div className="input-icon">
        {icon}
        <input id={id} className="input" type={show ? 'text' : 'password'} aria-invalid={!!error} required={required} {...rest} style={{ paddingRight: 40 }} />
        <button type="button" className="eye" aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow((v) => !v)}>
          {show ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function SelectField({
  label,
  error,
  required,
  children,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; error?: string; required?: boolean }) {
  const id = useId()
  return (
    <div className={`field ${className ?? ''}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="req"> *</span>}
        </label>
      )}
      <select id={id} className="input select" aria-invalid={!!error} required={required} {...rest}>
        {children}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
