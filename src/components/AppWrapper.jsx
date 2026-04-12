import './AppWrapper.css'
import { useState, useEffect } from 'react'
import { useGlobal } from '../context/GlobalContext'
import Overview from './views/Overview'
import Chat from './views/Chat'
import Unit from './views/Unit'
import AssessmentDetail from './views/assessmentDetail.jsx'
import Header from './header/Header'
import { useCanvasData } from '../lib/useCanvasData'

function LoadingScreen({ syncPhase, aiProgress }) {
  const isAI = syncPhase === 'ai'
  const isDone = syncPhase === 'done'

  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <span className={`app-logo-dot ${!isDone ? 'loading-dot-pulse' : ''}`} />
        CanvAssist
      </div>

      {isDone ? (
        <div className="loading-done-icon">✓</div>
      ) : (
        <div className="loading-spinner" />
      )}

      <p className="loading-label">
        {isDone && 'Ready!'}
        {!isDone && !isAI && 'Fetching your Canvas data…'}
        {!isDone && isAI && 'AI is analysing your units…'}
      </p>

      {isAI && aiProgress.total > 0 && (
        <>
          <div className="loading-progress-bar">
            <div
              className="loading-progress-fill"
              style={{ width: `${(aiProgress.completed / aiProgress.total) * 100}%` }}
            />
          </div>
          <p className="loading-progress-text">
            {aiProgress.completed} of {aiProgress.total} units complete
          </p>
        </>
      )}
    </div>
  )
}

export default function AppWrapper() {
  useCanvasData()

  const { view, setView, syncPhase, aiProgress } = useGlobal()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    setView({ page: 'overview', params: {} })
  }, [])

  const isLoading = syncPhase === 'canvas' || syncPhase === 'ai' || syncPhase === 'done'
  const isMainPage = view.page === 'overview'

  if (isLoading) {
    return (
      <div className="app-shell--sidepanel">
        <LoadingScreen syncPhase={syncPhase} aiProgress={aiProgress} />
      </div>
    )
  }

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
