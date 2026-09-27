export function getStored(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ?? fallback
  } catch {
    return fallback
  }
}

export function setStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}
