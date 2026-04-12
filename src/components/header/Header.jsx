import { useGlobal } from '../../context/GlobalContext'

export default function Header() {
  const { previousView, view, setView } = useGlobal()
  const canGoBack = Boolean(previousView?.page && view.page !== 'overview')

  function handleSync() {
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  return (
    <div style={{ borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
      <strong>CanvAssist [DEBUG]</strong>
      {canGoBack && (
        <button onClick={() => setView(previousView)}>← back</button>
      )}
      <button onClick={handleSync}>↻ sync</button>
      <span style={{ color: '#666' }}>page: {view.page}</span>
    </div>
  )
}
