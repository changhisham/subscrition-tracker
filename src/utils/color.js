const palette = [
  { bg: '#eff8ff', fg: '#175cd3' },
  { bg: '#fdf2fa', fg: '#c11574' },
  { bg: '#f0f9ff', fg: '#026aa2' },
  { bg: '#fff6ed', fg: '#c4320a' },
  { bg: '#f4f3ff', fg: '#5925dc' },
  { bg: '#ecfdf3', fg: '#027a48' },
  { bg: '#fef3f2', fg: '#b42318' },
  { bg: '#eefaf6', fg: '#0e9384' },
]

export function colorFor(seed) {
  const str = String(seed || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}
