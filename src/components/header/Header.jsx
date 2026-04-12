import { useGlobal } from '../../context/GlobalContext'

export default function Header() {
  const { previousView, view, goBack } = useGlobal()
  const canGoBack = Boolean(previousView?.page && view.page !== 'overview')

  function handleSync() {
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  return (
    <header className="app-header">
      <strong className="app-logo">
        <span className="app-logo-dot" aria-hidden="true" />
        CanvAssist
      </strong>
      <div className="app-header-actions">
        {canGoBack && (
          <button type="button" className="back-btn" onClick={goBack}>
            Back
          </button>
        )}
        <button type="button" className="sync-btn sync-btn--inline" onClick={handleSync}>
          Sync
        </button>
      </div>
    </header>
  )
}
