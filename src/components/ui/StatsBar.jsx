export default function StatsBar({ unitCount, unitLabel, cityCount, onListClick, onUploadClick }) {
  return (
    <div className="stats-bar">
      <span className="stats-text">
        <span className="stats-count">{unitCount}</span> {unitLabel}
        {' · '}
        <span className="stats-count">{cityCount}</span> 个城市
      </span>
      <div className="stats-divider" />
      <button className="stats-btn" onClick={onListClick}>列表视图</button>
      <button className="stats-btn primary" onClick={onUploadClick}>+ 上传照片</button>
    </div>
  )
}
