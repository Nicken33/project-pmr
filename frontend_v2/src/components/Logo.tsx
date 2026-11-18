import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'

export function Logo({ height = 52 }: { height?: number }) {
  return (
    <Link to="/" className="logo" aria-label="Talentro — на главную">
      <img src={logo} alt="talentro" height={height} style={{ height, width: 'auto' }} />
    </Link>
  )
}
