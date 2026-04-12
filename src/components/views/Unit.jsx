import { useState, useEffect } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { getUnit, getCompletedModules, toggleModuleCompleted } from '../../lib/storage.js'
import { calculateCurrentGrade, calculateRequiredScore, getUrgencyLabel } from '../../lib/utils.js'

export default function Unit({ unitId, unit: initialUnit }) {
  const { setView } = useGlobal()
  const [unit, setUnit] = useState(initialUnit ?? null)
  const [completedModules, setCompletedModules] = useState({})
  const [activeTab, setActiveTab] = useState('assessments')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [fresh, completed] = await Promise.all([getUnit(unitId), getCompletedModules()])
      if (!cancelled) {
        if (fresh) setUnit(fresh)
        setCompletedModules(completed)
      }
    }
    load()
    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) load()
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => { cancelled = true; chrome.runtime.onMessage.removeListener(handleMessage) }
  }, [unitId])

  if (!unit) return <p>Loading...</p>

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const neededToPass = calculateRequiredScore(unit.assessments, 50)
  const sortedAssessments = [...(unit.assessments ?? [])].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  function getUrgencyTone(assessment) {
    if (assessment.submission?.status === 'graded' || assessment.submission?.status === 'submitted') return 'done'
    if (assessment.daysUntilDue == null) return 'low'
    if (assessment.daysUntilDue < 0) return 'overdue'
    if (assessment.daysUntilDue <= 2) return 'high'
    if (assessment.daysUntilDue <= 7) return 'medium'
    return 'low'
  }

  function getUrgencyWidth(assessment) {
    if (assessment.submission?.status === 'graded' || assessment.submission?.status === 'submitted') return 100
    if (assessment.daysUntilDue == null) return 30
    if (assessment.daysUntilDue < 0) return 95
    if (assessment.daysUntilDue <= 2) return 85
    if (assessment.daysUntilDue <= 7) return 55
    return 30
  }

  return (
    <section>
      <h3 className="section-heading">
        {unit.code} - {unit.friendlyName}
      </h3>
      <p className="assessment-card-due">
        Current grade: {grade ?? 'N/A'}% - Need {neededToPass ?? 0}% on remaining work to pass
      </p>

      <div className="sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeTab === 'assessments' ? 'sub-tab--active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          Assessments
          <span className="sub-tab-count">{sortedAssessments.length}</span>
        </button>
        <button
          type="button"
          className={`sub-tab ${activeTab === 'modules' ? 'sub-tab--active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          Modules
          <span className="sub-tab-count">{unit.modules?.length ?? 0}</span>
        </button>
      </div>

      {activeTab === 'assessments' && (
        <div className="unit-list" style={{ marginTop: 10 }}>
          {sortedAssessments.length === 0 && <p className="tab-empty">No assessments found.</p>}
          {sortedAssessments.map((assessment) => (
            <article
              key={assessment.id}
              className="assessment-card"
              onClick={() => setView({ page: 'assessment', params: { assessment, unit } })}
            >
              <div className="assessment-card-top">
                <span className="assessment-card-name">{assessment.name}</span>
                <span className="assessment-card-points">{assessment.pointsPossible ?? '-'} pts</span>
              </div>
              <div className="assessment-card-bottom">
                <span className="assessment-card-due">{getUrgencyLabel(assessment.daysUntilDue)}</span>
                <span className={`assessment-card-status assessment-card-status--${assessment.submission?.status === 'graded' ? 'green' : assessment.daysUntilDue != null && assessment.daysUntilDue <= 5 ? 'amber' : 'gray'}`}>
                  {assessment.submission?.status ?? 'unsubmitted'}
                </span>
              </div>
              <div className="urgency-track">
                <span
                  className={`urgency-fill urgency--${getUrgencyTone(assessment)}`}
                  style={{ width: `${getUrgencyWidth(assessment)}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="unit-list" style={{ marginTop: 10 }}>
          {(unit.modules?.length ?? 0) === 0 && <p className="tab-empty">No modules found.</p>}
          {(unit.modules ?? []).map((module) => {
            const isDone = Boolean(completedModules[module.id])
            return (
              <article key={module.id} className={`module-card ${isDone ? 'module-card--done' : ''}`}>
                <div className="module-card-top">
                  <button
                    type="button"
                    className={`module-tick ${isDone ? 'module-tick--done' : ''}`}
                    onClick={async () => {
                      const newState = await toggleModuleCompleted(module.id)
                      setCompletedModules((prev) => ({ ...prev, [module.id]: newState }))
                    }}
                    title={isDone ? 'Mark not completed' : 'Mark completed'}
                  >
                    {isDone ? '✓' : ''}
                  </button>

                  <div>
                    <span className="module-week">Week {module.weekNumber}</span>
                    <span className="module-topic">{module.topic}</span>
                    <p className="module-summary">{module.aiSummary || 'No AI summary available.'}</p>
                  </div>
                </div>

                {module.relevantAssessments?.length > 0 && (
                  <div className="module-relevant">
                    {module.relevantAssessments.map((name) => (
                      <span key={name} className="module-relevant-tag">{name}</span>
                    ))}
                  </div>
                )}

                {module.items?.length > 0 && (
                  <div className="module-items">
                    {module.items.slice(0, 6).map((item) => (
                      <span key={item.id} className="module-item">{item.title}</span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
