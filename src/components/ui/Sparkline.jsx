export default function Sparkline({ data, color = '#3B1C64', width = 64, height = 26 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 0)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const y = v => height - 3 - ((v - min) / range) * (height - 6)
  const points = data.map((v, i) => `${i * stepX},${y(v)}`).join(' ')
  const lastX = (data.length - 1) * stepX
  const lastY = y(data[data.length - 1])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#d0d5dd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}
