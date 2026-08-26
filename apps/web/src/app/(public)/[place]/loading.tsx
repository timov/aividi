export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="skeleton" style={{ width: '46%', height: 46, marginBottom: 16 }} />
      <div className="skeleton skeleton-line" style={{ width: '30%', marginBottom: 30 }} />
      <div className="cards">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton" style={{ height: 230 }} />
        ))}
      </div>
    </div>
  )
}
