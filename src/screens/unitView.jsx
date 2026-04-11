// screens/UnitView.jsx
import { useState, useEffect } from 'react'
import { getUnit, getCompletedModules, toggleModuleCompleted } from '../lib/storage.js'
import { calculateCurrentGrade, calculateRequiredScore, getUnitStatus, getStatusLabel } from '../lib/utils.js'

export default function UnitView({ unit: initialUnit, onBack, onSelectAssessment }) {
  const [unit, setUnit] = useState(initialUnit)
  const [activeTab, setActiveTab] = useState('assessments')
  const [completedModules, setCompletedModules] = useState({})

  useEffect(() => {
    loadData()

    // Reload when AI enrichment finishes
    const handleMessage = (msg) => {
      if (msg.type === 'AI_UNIT_COMPLETE' && msg.unitId === initialUnit.id) loadData()
      if (msg.type === 'AI_COMPLETE') loadData()
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [initialUnit.id])

  async function loadData() {
    const [freshUnit, completed] = await Promise.all([
      getUnit(initialUnit.id),
      getCompletedModules(),
    ])
    if (freshUnit) setUnit(freshUnit)
    setCompletedModules(completed)
  }

  async function handleToggleModule(moduleId) {
    const newState = await toggleModuleCompleted(moduleId)
    setCompletedModules(prev => ({ ...prev, [moduleId]: newState }))
  }

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const status = getUnitStatus(grade)
  const statusLabel = getStatusLabel(status)
  const neededToPass = calculateRequiredScore(unit.assessments, 50)

  return (
    <div className='screen'>
      <div className='app-header'>
        <button className='back-btn' onClick={onBack}>← Back</button>
        <span className='app-sync-label'>{unit.code}</span>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {unit.code}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {unit.friendlyName}
        </div>
      </div>

      <div className='grade-summary'>
        <div className='grade-summary-item'>
          <div className={`grade-summary-value grade-summary-value--${status}`}>
            {grade !== null ? `${grade}%` : '—'}
          </div>
          <div className='grade-summary-label'>Current grade</div>
        </div>
        <div className='grade-summary-item'>
          <div className={`grade-summary-value grade-summary-value--${status}`}>
            {statusLabel}
          </div>
          <div className='grade-summary-label'>Status</div>
        </div>
        <div className='grade-summary-item'>
          <div className='grade-summary-value'>
            {neededToPass !== null ? `${neededToPass}%` : '—'}
          </div>
          <div className='grade-summary-label'>Need to pass</div>
        </div>
      </div>

      <div className='sub-tabs'>
        <button
          className={`sub-tab ${activeTab === 'assessments' ? 'sub-tab--active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          Assessments
          <span className='sub-tab-count'>{unit.assessments.length}</span>
        </button>
        <button
          className={`sub-tab ${activeTab === 'materials' ? 'sub-tab--active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          Materials
          <span className='sub-tab-count'>{unit.modules.length}</span>
        </button>
      </div>

      {activeTab === 'assessments' && (
        <AssessmentsTab
          assessments={unit.assessments}
          onSelectAssessment={(a) => onSelectAssessment(a, unit)}
        />
      )}

      {activeTab === 'materials' && (
        <MaterialsTab
          modules={unit.modules}
          completedModules={completedModules}
          onToggle={handleToggleModule}
        />
      )}
    </div>
  )
}

// ─── ASSESSMENTS TAB ──────────────────────────────────────────────────────────

function AssessmentsTab({ assessments, onSelectAssessment }) {
  if (assessments.length === 0) {
    return <div className='tab-empty'>No assessments found.</div>
  }

  const sorted = [...assessments].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(assessment => (
        <AssessmentCard
          key={assessment.id}
          assessment={assessment}
          onClick={() => onSelectAssessment(assessment)}
        />
      ))}
    </div>
  )
}

function AssessmentCard({ assessment, onClick }) {
  const { submission, name, dueDateFormatted, daysUntilDue, pointsPossible } = assessment
  const isGraded = submission?.status === 'graded'
  const isSubmitted = submission?.status === 'submitted'
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isSubmitted && !isGraded

  function getUrgencyClass() {
    if (isGraded) return 'urgency--done'
    if (isOverdue) return 'urgency--overdue'
    if (daysUntilDue <= 2) return 'urgency--high'
    if (daysUntilDue <= 5) return 'urgency--medium'
    return 'urgency--low'
  }

  function getStatusText() {
    if (isGraded) return `${submission.score ?? '—'}/${pointsPossible} pts`
    if (isSubmitted) return 'Submitted'
    if (isOverdue) return 'Overdue'
    if (daysUntilDue === 0) return 'Due today'
    if (daysUntilDue === 1) return 'Due tomorrow'
    if (daysUntilDue !== null) return `${daysUntilDue} days left`
    return 'No due date'
  }

  return (
    <div className={`assessment-card ${getUrgencyClass()}`} onClick={onClick}>
      <div className='assessment-card-top'>
        <span className='assessment-card-name'>{name}</span>
        <span className='assessment-card-points'>{pointsPossible}pts</span>
      </div>
      <div className='assessment-card-bottom'>
        <span className='assessment-card-due'>{dueDateFormatted}</span>
        <span className={`assessment-card-status assessment-card-status--${
          isGraded ? 'green' : isOverdue ? 'red' : daysUntilDue <= 3 ? 'amber' : 'gray'
        }`}>
          {getStatusText()}
        </span>
      </div>
      <div className='urgency-track'>
        <div className={`urgency-fill ${getUrgencyClass()}`} />
      </div>
    </div>
  )
}

// ─── MATERIALS TAB ────────────────────────────────────────────────────────────

function MaterialsTab({ modules, completedModules, onToggle }) {
  if (modules.length === 0) {
    return <div className='tab-empty'>No weekly modules found.</div>
  }

  const completedCount = modules.filter(m => completedModules[m.id]).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className='materials-progress'>
        <span className='materials-progress-text'>
          {completedCount} of {modules.length} weeks covered
        </span>
        <div className='materials-progress-bar'>
          <div
            className='materials-progress-fill'
            style={{ width: `${Math.round((completedCount / modules.length) * 100)}%` }}
          />
        </div>
      </div>

      {modules.map(module => (
        <ModuleCard
          key={module.id}
          module={module}
          completed={completedModules[module.id] ?? false}
          onToggle={() => onToggle(module.id)}
        />
      ))}
    </div>
  )
}

function ModuleCard({ module, completed, onToggle }) {
  return (
    <div className={`module-card ${completed ? 'module-card--done' : ''}`}>
      <div className='module-card-top'>
        <div style={{ flex: 1 }}>
          <span className='module-week'>Week {module.weekNumber}</span>
          <span className='module-topic'>{module.topic}</span>

          {/* AI summary — shown once ai.js has enriched */}
          {module.aiSummary && (
            <p className='module-summary'>{module.aiSummary}</p>
          )}

          {/* Relevant assessments — shown once ai.js has enriched */}
          {module.relevantAssessments?.length > 0 && (
            <div className='module-relevant'>
              {module.relevantAssessments.map((a, i) => (
                <span key={i} className='module-relevant-tag'>{a}</span>
              ))}
            </div>
          )}

          {/* Fallback — show item titles before AI summary */}
          {!module.aiSummary && (
            <div className='module-items'>
              {module.items.map(item => (
                <span key={item.id} className={`module-item module-item--${item.itemType}`}>
                  {item.title}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          className={`module-tick ${completed ? 'module-tick--done' : ''}`}
          onClick={onToggle}
        >
          {completed ? '✓' : ''}
        </button>
      </div>
    </div>
  )
}