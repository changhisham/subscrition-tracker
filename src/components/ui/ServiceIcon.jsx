import { CreditCard } from 'lucide-react'
import { logoFor } from '../../utils/logos'
import { colorFor } from '../../utils/color'

export default function ServiceIcon({ name, provider, size = 34, iconSize = 18, className = '' }) {
  const logo = logoFor(name, provider)
  const style = { width: size, height: size }

  if (logo) {
    return (
      <div className={`service-icon service-icon-logo ${className}`} style={style}>
        <img src={logo} alt="" width={iconSize} height={iconSize} />
      </div>
    )
  }

  const tint = colorFor(name)
  return (
    <div className={`service-icon ${className}`} style={{ ...style, background: tint.bg, color: tint.fg }}>
      <CreditCard size={iconSize} />
    </div>
  )
}
