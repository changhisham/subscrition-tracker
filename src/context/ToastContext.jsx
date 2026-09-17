import { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
let idCounter = 0

const icons = { success: CheckCircle2, error: AlertCircle, info: Info }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((message, type) => {
    const id = ++idCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const toast = {
    success: message => push(message, 'success'),
    error: message => push(message, 'error'),
    info: message => push(message, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => {
          const Icon = icons[t.type] || Info
          return (
            <div className={`toast toast-${t.type}`} key={t.id} role="status">
              <Icon size={16} />
              <span>{t.message}</span>
              <button className="toast-close" onClick={() => remove(t.id)} aria-label="Dismiss"><X size={13} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
