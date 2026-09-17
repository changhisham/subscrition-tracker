import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, subtitle, onClose, children, width = 480 }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
