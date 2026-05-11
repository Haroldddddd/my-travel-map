import { useState } from 'react'
import { setupAndInit } from '../../services/github.js'
import { getCities } from '../../services/storage.js'

export default function GithubSetupModal({ onComplete }) {
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!token.trim()) { setError('请填写 Personal Access Token'); return }
    if (!repo.trim()) { setError('请填写仓库地址'); return }
    setError('')
    setLoading(true)
    try {
      const existingCities = getCities()
      const cities = await setupAndInit(token.trim(), repo.trim(), existingCities)
      onComplete(cities)
    } catch (e) {
      setError(e.message || '连接失败，请检查 Token 和仓库地址')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-overlay">
      <div className="setup-modal">
        <div className="setup-header">
          <div className="setup-title">连接 GitHub 存储</div>
          <div className="setup-sub">照片和足迹数据将保存到你的 GitHub 仓库，长期可用</div>
        </div>

        <div className="setup-body">
          <div className="form-section">
            <label className="form-label">
              Personal Access Token
              <a
                className="setup-link"
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noreferrer"
              >
                前往创建
              </a>
            </label>
            <input
              className="form-input"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={e => setToken(e.target.value)}
              autoComplete="off"
            />
            <div className="setup-hint">勾选 repo 权限即可</div>
          </div>

          <div className="form-section">
            <label className="form-label">仓库地址</label>
            <input
              className="form-input"
              type="text"
              placeholder="your-username/travel-map"
              value={repo}
              onChange={e => setRepo(e.target.value)}
            />
            <div className="setup-hint">格式为 owner/repo，仓库需已存在</div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="setup-footer">
          <button
            className="record-btn primary"
            onClick={handleConnect}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? '连接中…' : '连接并同步数据'}
          </button>
        </div>
      </div>
    </div>
  )
}
