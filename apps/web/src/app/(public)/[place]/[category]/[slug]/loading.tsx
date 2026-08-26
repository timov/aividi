export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="skeleton skeleton-line" style={{ width: '26%', height: 12 }} />
      <div className="skeleton" style={{ width: '48%', height: 42, marginBottom: 22 }} />
      <div className="profile-grid">
        <div>
          <div className="skeleton" style={{ aspectRatio: '16 / 9', marginBottom: 18 }} />
          <div className="skeleton skeleton-line" style={{ width: '92%' }} />
          <div className="skeleton skeleton-line" style={{ width: '80%' }} />
        </div>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    </div>
  )
}
