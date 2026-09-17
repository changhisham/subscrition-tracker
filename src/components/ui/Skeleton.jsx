export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function SkeletonRow({ withAvatar = true }) {
  return (
    <div className="payment-row">
      {withAvatar && <Skeleton className="skeleton-avatar" />}
      <div className="row-main">
        <Skeleton className="skeleton-line" style={{ width: '55%' }} />
        <Skeleton className="skeleton-line" style={{ width: '35%', marginTop: 7 }} />
      </div>
      <Skeleton className="skeleton-line" style={{ width: 54, height: 12 }} />
    </div>
  )
}

export function SkeletonList({ rows = 4, withAvatar = true }) {
  return (
    <div className="payment-list">
      {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} withAvatar={withAvatar} />)}
    </div>
  )
}
