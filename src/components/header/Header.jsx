import { useGlobal } from '../../context/GlobalContext'

export default function Header() {
  const { previousView, view, setView } = useGlobal()

  const canGoBack = Boolean(previousView?.page && view.page !== 'overview')

  function handleBack() {
    if (previousView?.page) {
      setView(previousView)
    }
  }

  function handleSync() {
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  return (
    <header className="canvAssist-header">

      {canGoBack ? (
        <button
          type="button"
          className="canvAssist-back"
          onClick={handleBack}
          aria-label="Back to previous view"
        >
          ←
        </button>
      ) : (
        <div style={{ width: '28px', height: '28px', opacity: 0 }} />
      )}

      <div className="canvAssist-headerBrandRow">
        <div className="canvAssist-brand">
          <span className="canvAssist-dot" aria-hidden />
          <span className="canvAssist-title">CanvAssist</span>
        </div>
      </div>

      <button
        type="button"
        className="canvAssist-sync"
        onClick={handleSync}
        aria-label="Sync Canvas data"
        title="Sync Canvas data"
      >
        ↻
      </button>

    </header>
  )
}