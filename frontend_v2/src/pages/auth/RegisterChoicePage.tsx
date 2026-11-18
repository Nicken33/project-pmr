import { Link } from 'react-router-dom'

export default function RegisterChoicePage() {
  return (
    <div className="auth">
      <div className="auth__card auth__card--choice panel">
        <h1>Регистрация</h1>
        <p className="auth__note">Для регистрации в качестве пользователя заполните форму</p>
        <Link to="/register/user" className="btn btn--solid btn--block">
          Регистрация пользователя
        </Link>
        <span className="auth__or">или</span>
        <p className="auth__note">Для регистрации в качестве организации заполните форму</p>
        <Link to="/register/org" className="btn btn--outline btn--block">
          Регистрация организации
        </Link>
        <p className="auth__alt">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  )
}
