import './AppWrapper.css'
import { useState, useEffect } from 'react'
import { useGlobal } from '../context/GlobalContext'
import Overview from './views/Overview'
import Chat from './views/Chat'
import Unit from './views/Unit'
import AssessmentDetail from './views/assessmentDetail.jsx'
import Header from './header/Header'
import { useCanvasData } from '../lib/useCanvasData'

export default function AppWrapper() {
  useCanvasData()

  const { view, setView } = useGlobal()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    setView({ page: 'overview', params: {} })
  }, [])

  const isMainPage = view.page === 'overview'

  return (
    <div>
      <Header />

      {/* Tabs — only shown on the main overview page */}
      {isMainPage && (
        <div className="sub-tabs app-main-tabs">
          <button
            type="button"
            className={`sub-tab ${tab === 'overview' ? 'sub-tab--active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`sub-tab ${tab === 'chat' ? 'sub-tab--active' : ''}`}
            onClick={() => setTab('chat')}
          >
            Chat
          </button>
        </div>
      )}

      {isMainPage && tab === 'overview' && <Overview />}
      {isMainPage && tab === 'chat' && <Chat />}
      {view.page === 'unit' && <Unit {...view.params} />}
      {view.page === 'assessment' && <AssessmentDetail {...view.params} />}
    </div>
  )
}
