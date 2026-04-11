// src/components/views/Unit.jsx
import { useState, useEffect } from "react"
import { useGlobal } from "../../context/GlobalContext"
import { getUnit, getCompletedModules, toggleModuleCompleted } from "../../lib/storage.js"
import { calculateCurrentGrade, calculateRequiredScore, getUnitStatus, getStatusLabel } from "../../lib/utils.js"

export default function Unit({ unitId, unitCode, unit: initialUnit }) {
  const { setView } = useGlobal()
  const [unit, setUnit] = useState(initialUnit ?? null)
  const [activeTab, setActiveTab] = useState('assessments')
  const [completedModules, setCompletedModules] = useState({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [fresh, completed] = await Promise.all([
        getUnit(unitId),
        getCompletedModules(),
      ])
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
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [unitId])

  async function handleToggle(moduleId) {
    const newState = await toggleModuleCompleted(moduleId)
    setCompletedModules(prev => ({ ...prev, [moduleId]: newState }))
  }

  if (!unit) return <div className='canvAssist-body'><p style={{ color: '#9ca3af', fontSize: 12 }}>Loading...</p></div>

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const status = getUnitStatus(grade)
  const statusLabel = getStatusLabel(status)
  const neededToPass = calculateRequiredScore(unit.assessments, 50)

  const gradeValueClass = `canvAssist-grade-value ${
    status === 'distinction' || status === 'on_track' ? 'canvAssist-grade-value--green'
    : status === 'borderline' ? 'canvAssist-grade-value--amber'
    : status === 'at_risk' ? 'canvAssist-grade-value--red'
    : ''
  }`

  const sortedAssessments = [...(unit.assessments ?? [])].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  const completedCount = unit.modules?.filter(m => completedModules[m.id]).length ?? 0
  const totalModules = unit.modules?.length ?? 0

  return (
    <div className='canvAssist-body'>

      {/* Unit header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>{unit.code}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{unit.friendlyName}</div>
      </div>

      {/* Grade summary */}
      <div className='canvAssist-grade-row'>
        <div className='canvAssist-grade-card'>
          <span className={gradeValueClass}>{grade !== null ? `${grade}%` : '—'}</span>
          <span className='canvAssist-grade-label'>Current</span>
        </div>
        <div className='canvAssist-grade-card'>
          <span className={gradeValueClass}>{statusLabel}</span>
          <span className='canvAssist-grade-label'>Status</span>
        </div>
        <div className='canvAssist-grade-card'>
          <span className='canvAssist-grade-value'>{neededToPass !== null ? `${neededToPass}%` : '—'}</span>
          <span className='canvAssist-grade-label'>Need to pass</span>
        </div>
      </div>

      {/* Sub tabs */}
      <div className='canvAssist-sub-tabs'>
        <button
          className={`canvAssist-sub-tab ${activeTab === 'assessments' ? 'canvAssist-sub-tab--active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          Assessments ({unit.assessments?.length ?? 0})
        </button>
        <button
          className={`canvAssist-sub-tab ${activeTab === 'materials' ? 'canvAssist-sub-tab--active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          Materials ({totalModules})
        </button>
      </div>

      {/* Assessments tab */}
      {activeTab === 'assessments' && (
        <div className='canvAssist-assess-list'>
          {sortedAssessments.length === 0 && (
            <div className='canvAssist-empty'>No assessments found</div>
          )}
          {sortedAssessments.map(assessment => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              onClick={() => setView({ page: 'assessment', params: { assessment, unit } })}
            />
          ))}
        </div>
      )}

      {/* Materials tab */}
      {activeTab === 'materials' && (
        <div className='canvAssist-mod-list'>
          {totalModules > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className='canvAssist-prog-bar'>
                <div className='canvAssist-prog-fill' style={{ width: `${Math.round((completedCount / totalModules) * 100)}%` }} />
              </div>
              <div className='canvAssist-prog-label'>{completedCount} of {totalModules} weeks covered</div>
            </div>
          )}
          {unit.modules?.map(module => (
            <ModuleCard
              key={module.id}
              module={module}
              completed={completedModules[module.id] ?? false}
              onToggle={() => handleToggle(module.id)}
            />
          ))}
        </div>
      )}

    </div>
  )
}

function AssessmentCard({ assessment, onClick }) {
  const isGraded = assessment.submission?.status === 'graded'
  const isSubmitted = assessment.submission?.status === 'submitted'
  const isOverdue = assessment.daysUntilDue !== null && assessment.daysUntilDue < 0 && !isSubmitted && !isGraded

  function getUrgencyClass() {
    if (isGraded || isSubmitted) return 'canvAssist-urgency--done'
    if (isOverdue) return 'canvAssist-urgency--high'
    if (assessment.daysUntilDue <= 3) return 'canvAssist-urgency--high'
    if (assessment.daysUntilDue <= 7) return 'canvAssist-urgency--medium'
    return 'canvAssist-urgency--low'
  }

  function getStatusText() {
    if (isGraded) return `${assessment.submission.score ?? '—'}/${assessment.pointsPossible}pts`
    if (isSubmitted) return 'Submitted'
    if (isOverdue) return 'Overdue'
    if (assessment.daysUntilDue === 0) return 'Due today'
    if (assessment.daysUntilDue === 1) return 'Due tomorrow'
    if (assessment.daysUntilDue !== null) return `${assessment.daysUntilDue}d left`
    return 'No due date'
  }

  function getStatusColor() {
    if (isGraded) return 'canvAssist-assess-status--green'
    if (isOverdue || assessment.daysUntilDue <= 2) return 'canvAssist-assess-status--red'
    if (assessment.daysUntilDue <= 7) return 'canvAssist-assess-status--amber'
    return 'canvAssist-assess-status--gray'
  }

  return (
    <div className={`canvAssist-assess-card ${getUrgencyClass()}`} onClick={onClick}>
      <div className='canvAssist-assess-top'>
        <span className='canvAssist-assess-name'>{assessment.name}</span>
        <span className='canvAssist-assess-pts'>{assessment.pointsPossible}pts</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className='canvAssist-assess-meta'>{assessment.dueDateFormatted}</span>
        <span className={`canvAssist-assess-status ${getStatusColor()}`}>{getStatusText()}</span>
      </div>
      <div className='canvAssist-urgency-track'>
        <div className='canvAssist-urgency-fill' />
      </div>
      {assessment.aiRubricSummary && (
        <div style={{ marginTop: 5 }}>
          <span className='canvAssist-ai-badge'>AI decoded</span>
        </div>
      )}
    </div>
  )
}

function ModuleCard({ module, completed, onToggle }) {
  return (
    <div className={`canvAssist-mod-card ${completed ? 'canvAssist-mod-card--done' : ''}`}>
      <div className='canvAssist-mod-top'>
        <div style={{ flex: 1 }}>
          <span className='canvAssist-mod-week'>Week {module.weekNumber}</span>
          <span className='canvAssist-mod-topic'>{module.topic}</span>
          {module.aiSummary && (
            <p className='canvAssist-mod-summary'>{module.aiSummary}</p>
          )}
          {module.relevantAssessments?.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {module.relevantAssessments.map((a, i) => (
                <span key={i} className='canvAssist-mat-tag'>{a}</span>
              ))}
            </div>
          )}
        </div>
        <button
          className={`canvAssist-tick ${completed ? 'canvAssist-tick--done' : ''}`}
          onClick={e => { e.stopPropagation(); onToggle() }}
        >
          {completed ? '✓' : ''}
        </button>
      </div>
    </div>
  )
}