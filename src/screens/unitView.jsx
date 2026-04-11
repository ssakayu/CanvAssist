// screens/UnitView.jsx
// Second screen — shown when student taps a unit from Overview
// Two sub-tabs: Assessments and Materials
// Tapping an assessment navigates to AssessmentDetail

import { useState, useEffect } from 'react'
import { getCompletedModules, toggleModuleCompleted } from '../lib/storage.js'
import { calculateCurrentGrade, calculateRequiredScore, getUnitStatus, getStatusLabel } from '../lib/utils.js'

export default function UnitView({ unit, onBack, onSelectAssessment }) {
  const [activeTab, setActiveTab] = useState('assessments')
  const [completedModules, setCompletedModules] = useState({})

  useEffect(() => {
    loadCompletedModules()
  }, [])

  async function loadCompletedModules() {
    const completed = await getCompletedModules()
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
    <div className='unit-view'>

      {/* Header with back button */}
      <div className='unit-view-header'>
        <button className='back-btn' onClick={onBack}>← Back</button>
        <div className='unit-view-title'>
          <span className='unit-view-code'>{unit.code}</span>
          <span className='unit-view-name'>{unit.friendlyName}</span>
        </div>
      </div>

      {/* Grade summary */}
      <div className='grade-summary'>
        <div className='grade-summary-item'>
          <div className='grade-summary-value'>
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

      {/* Sub tabs */}
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

      {/* Tab content */}
      {activeTab === 'assessments' && (
        <AssessmentsTab
          assessments={unit.assessments}
          onSelectAssessment={onSelectAssessment}
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
    return (
      <div className='tab-empty'>
        <p>No assessments found for this unit.</p>
      </div>
    )
  }

  // Sort by due date — soonest first
  const sorted = [...assessments].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  return (
    <div className='assessments-tab'>
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

  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded'
  const isGraded = submission?.status === 'graded'
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isSubmitted

  function getUrgencyClass() {
    if (isGraded) return 'urgency--done'
    if (isOverdue) return 'urgency--overdue'
    if (daysUntilDue <= 2) return 'urgency--high'
    if (daysUntilDue <= 5) return 'urgency--medium'
    return 'urgency--low'
  }

  function getStatusText() {
    if (isGraded) return `Graded: ${submission.score ?? '—'}/${pointsPossible}`
    if (isSubmitted) return 'Submitted'
    if (isOverdue) return 'Overdue'
    if (daysUntilDue === 0) return 'Due today'
    if (daysUntilDue === 1) return 'Due tomorrow'
    if (daysUntilDue !== null) return `Due in ${daysUntilDue} days`
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
        <span className={`assessment-card-status ${getUrgencyClass()}`}>
          {getStatusText()}
        </span>
      </div>
      {/* Urgency bar */}
      <div className='urgency-track'>
        <div className={`urgency-fill ${getUrgencyClass()}`} />
      </div>
    </div>
  )
}

// ─── MATERIALS TAB ────────────────────────────────────────────────────────────

function MaterialsTab({ modules, completedModules, onToggle }) {
  if (modules.length === 0) {
    return (
      <div className='tab-empty'>
        <p>No weekly modules found for this unit.</p>
      </div>
    )
  }

  const completedCount = modules.filter(m => completedModules[m.id]).length

  return (
    <div className='materials-tab'>

      {/* Progress summary */}
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

      {/* Module list */}
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
  const { weekNumber, topic, items, aiSummary, relevantAssessments } = module

  return (
    <div className={`module-card ${completed ? 'module-card--done' : ''}`}>
      <div className='module-card-top'>
        <div className='module-card-left'>
          <span className='module-week'>Week {weekNumber}</span>
          <span className='module-topic'>{topic}</span>
        </div>

        {/* Tick checkbox */}
        <button
          className={`module-tick ${completed ? 'module-tick--done' : ''}`}
          onClick={onToggle}
          aria-label={completed ? 'Mark as not done' : 'Mark as done'}
        >
          {completed ? '✓' : ''}
        </button>
      </div>

      {/* AI summary if available, otherwise show item titles */}
      {aiSummary ? (
        <p className='module-summary'>{aiSummary}</p>
      ) : (
        <div className='module-items'>
          {items.map(item => (
            <span key={item.id} className={`module-item module-item--${item.itemType}`}>
              {item.title}
            </span>
          ))}
        </div>
      )}

      {/* Relevant assessments tags — filled by ai.js later */}
      {relevantAssessments.length > 0 && (
        <div className='module-relevant'>
          {relevantAssessments.map((a, i) => (
            <span key={i} className='module-relevant-tag'>{a}</span>
          ))}
        </div>
      )}
    </div>
  )
}