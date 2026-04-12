import { useState, useEffect } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { getUnit, getCompletedModules, toggleModuleCompleted } from '../../lib/storage.js'
import { calculateCurrentGrade, calculateRequiredScore } from '../../lib/utils.js'
import './Unit.css'

export default function Unit({ unitId, unit: initialUnit }) {
  const { setView } = useGlobal()
  const [unit, setUnit] = useState(initialUnit ?? null)
  const [completedModules, setCompletedModules] = useState({})
  const [showModulesPage, setShowModulesPage] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [fresh, completed] = await Promise.all([
        getUnit(unitId),
        getCompletedModules()
      ])

      if (!cancelled) {
        if (fresh) setUnit(fresh)
        setCompletedModules(completed ?? {})
      }
    }

    load()

    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) load()
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [unitId])

  if (!unit) return <p className="unitview-loading">Loading...</p>

  const modules = unit?.modules ?? []
  const assessments = unit?.assessments ?? []

  const grade = unit.currentGrade ?? calculateCurrentGrade(assessments)
  const neededToPass = calculateRequiredScore(assessments, 50)

  const sortedAssessments = [...assessments].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  if (showModulesPage) {
    return (
      <div className="unitview-page">
        <div className="unitview-shell">
          <div className="unitview-topbar">
            <button
              className="unitview-back-link"
              onClick={() => setShowModulesPage(false)}
            >
              ‹ Back
            </button>
            <span className="unitview-sync-pill">Materials</span>
          </div>

          <section className="unitview-hero unitview-hero--compact">
            <h1 className="unitview-title">
              {unit.code} — {unit.friendlyName}
            </h1>
            <p className="unitview-subtitle">
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </p>
          </section>

          <section className="unitview-module-list">
            {modules.length > 0 ? (
              modules.map(m => (
                <article key={m.id} className="unitview-module-card">
                  <div className="unitview-module-card-top">
                    <div>
                      <h3 className="unitview-module-title">
                        {m.fullName || m.topic}
                      </h3>
                      <p className="unitview-module-meta">
                        {m.itemCount ?? 0} items · Completed: {String(completedModules[m.id] ?? false)}
                      </p>
                    </div>

                    <span className="unitview-module-badge">
                      Week {m.weekNumber}
                    </span>
                  </div>

                  <pre className="unitview-module-debug">
{`id                  : ${m.id}
weekNumber          : ${m.weekNumber}
topic               : ${m.topic}
fullName            : ${m.fullName}
itemCount           : ${m.itemCount}
completed           : ${completedModules[m.id] ?? false}
aiSummary           : ${m.aiSummary ?? '—'}
relevantAssessments : ${m.relevantAssessments?.length ? m.relevantAssessments.join(', ') : 'none'}`}
                  </pre>

                  <details className="unitview-module-items">
                    <summary>items ({m.items?.length ?? 0})</summary>

                    <div className="unitview-module-items-list">
                      {(m.items ?? []).map(i => (
                        <div key={i.id} className="unitview-module-item">
                          <span className="unitview-module-item-type">
                            {i.itemType}
                          </span>
                          <span className="unitview-module-item-title">
                            {i.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>

                  <div className="unitview-module-actions">
                    <button
                      className="unitview-secondary-btn"
                      onClick={async () => {
                        const newState = await toggleModuleCompleted(m.id)
                        setCompletedModules(prev => ({
                          ...prev,
                          [m.id]: newState
                        }))
                      }}
                    >
                      {completedModules[m.id] ? 'Mark incomplete' : 'Mark complete'}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="unitview-empty-text">No modules found</p>
            )}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="unitview-page">
      <div className="unitview-shell">
        <div className="unitview-topbar">
          {/* <button
            className="unitview-back-link"
            onClick={() => window.history.back()}
          >
            ‹ All units
          </button> */}
          {/* <span className="unitview-sync-pill">Synced just now</span> */}
        </div>

        <section className="unitview-hero">
          <h1 className="unitview-title">
            {unit.code} — {unit.friendlyName}
          </h1>
          <p className="unitview-subtitle">
            Current grade: {grade ?? '—'}% · Need {neededToPass ?? '—'}%+ to pass
          </p>
        </section>

        <section className="unitview-tabs">
          <button className="unitview-tab-btn unitview-tab-btn--active">
            Assessments
          </button>
          <button
            className="unitview-tab-btn"
            onClick={() => setShowModulesPage(true)}
          >
            Materials
          </button>
        </section>

        <section className="unitview-assessment-list">
          {sortedAssessments.length > 0 ? (
            sortedAssessments.map(a => {
              const progressWidth =
                a.urgencyScore != null
                  ? `${Math.max(10, Math.min(100, a.urgencyScore * 10))}%`
                  : '35%'

              return (
                <article key={a.id} className="unitview-assessment-card">
                  <div className="unitview-assessment-card-top">
                    <div className="unitview-assessment-content">
                      <h3 className="unitview-assessment-title">{a.name}</h3>

                      <p className="unitview-assessment-meta">
                        Due {a.dueAt ? new Date(a.dueAt).toDateString() : '—'} · {a.daysUntilDue ?? '—'} days
                      </p>

                      <pre className="unitview-assessment-debug">
{`id           : ${a.id}
name         : ${a.name}
dueAt        : ${a.dueAt ?? '—'}
daysUntilDue : ${a.daysUntilDue ?? '—'}
points       : ${a.pointsPossible}
urgencyScore : ${a.urgencyScore ?? '—'}
gradingType  : ${a.gradingType}
hasRubric    : ${a.hasRubric}
aiRubric     : ${a.aiRubricSummary ? `yes (${a.aiRubricSummary.length} bullets)` : 'no'}
relModules   : ${a.relevantModules?.length ? a.relevantModules.map(m => `W${m.weekNumber}`).join(', ') : 'none'}
sub.status   : ${a.submission?.status ?? '—'}
sub.score    : ${a.submission?.score ?? '—'}
sub.late     : ${a.submission?.late ?? false}
sub.missing  : ${a.submission?.missing ?? false}
sub.attempt  : ${a.submission?.attempt ?? '—'}
description  : ${a.description ? a.description.slice(0, 120) + (a.description.length > 120 ? '…' : '') : '—'}`}
                      </pre>
                    </div>

                    <div className="unitview-assessment-points">
                      {a.pointsPossible ?? '—'}%
                    </div>
                  </div>

                  <div className="unitview-progress-track">
                    <div
                      className="unitview-progress-fill"
                      style={{ width: progressWidth }}
                    />
                  </div>

                  <div className="unitview-assessment-actions">
                    <button
                      className="unitview-ghost-btn"
                      onClick={() =>
                        setView({ page: 'assessment', params: { assessment: a, unit } })
                      }
                    >
                      Open detail
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="unitview-empty-text">No assessments found</p>
          )}
        </section>
      </div>
    </div>
  )
}