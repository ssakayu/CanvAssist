import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { SnapshotModel } from './models/SnapshotModel'
import { CanvasPopupService } from './services/CanvasPopupService'

const VIEWS = {
  OVERVIEW: 'overview',
  UNIT: 'unit',
  ASSESSMENT: 'assessment',
}

const canvasPopupService = new CanvasPopupService(chrome)

function statusTone(status = '') {
  const normalized = status.toLowerCase()
  if (normalized.includes('risk') || normalized.includes('overdue')) return 'danger'
  if (normalized.includes('due')) return 'warn'
  if (normalized.includes('upcoming')) return 'neutral'
  return 'ok'
}

function progressWidth(value, max = 100) {
  const clamped = Math.max(0, Math.min(value ?? 0, max))
  return `${clamped}%`
}


export default function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [selectedUnitCode, setSelectedUnitCode] = useState('')
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [activeTab, setActiveTab] = useState('assessments')
  const [view, setView] = useState(VIEWS.OVERVIEW)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const units = useMemo(() => SnapshotModel.groupByUnit(snapshot), [snapshot])
  const stats = useMemo(() => SnapshotModel.computeStats(units), [units])

  const selectedUnit = units.find((unit) => unit.code === selectedUnitCode) ?? units[0] ?? null
  const selectedAssessment =
    selectedUnit?.assessments.find((assessment) => assessment.id === selectedAssessmentId) ??
    selectedUnit?.assessments[0] ??
    null

  useEffect(() => {
    async function loadCanvasData() {
      setIsLoading(true)
      setError('')
      const result = await canvasPopupService.loadCanvasData()
      if (result.snapshot) {
        setSnapshot(result.snapshot)
        const initialSelection = SnapshotModel.getInitialSelection(result.snapshot)
        setSelectedUnitCode(initialSelection.selectedUnitCode)
        setSelectedAssessmentId(initialSelection.selectedAssessmentId)
        setError('')
      } else {
        setError(result.error || 'Could not load Canvas data')
      }

      setIsLoading(false)
    }

    loadCanvasData()
  }, [])

  return (
    <main className="studylens-shell">
      <header className="sl-header">
        {view === VIEWS.OVERVIEW && (
          <div className="sl-title-row">
            <span className="dot" aria-hidden="true" />
            <h1>CanvAssist</h1>
          </div>
        )}
        {view !== VIEWS.OVERVIEW && (
          <button
            className="back-chip"
            type="button"
            onClick={() => {
              if (view === VIEWS.ASSESSMENT) {
                setView(VIEWS.UNIT)
                return
              }
              setView(VIEWS.OVERVIEW)
            }}
          >
            Back
          </button>
        )}
      </header>

      {isLoading && (
        <p className="section-label" style={{ textAlign: 'center', padding: '20px' }}>
          Loading your courses...
        </p>
      )}

      {error && !isLoading && (
        <p className="section-label" style={{ color: '#f2aaa7', textAlign: 'center', padding: '10px' }}>
          {error}
        </p>
      )}

      {!isLoading && snapshot && view === VIEWS.OVERVIEW && (
        <>
          <section className="sl-stats">
            <article className="stat-card danger">
              <strong>{stats.dueThisWeek}</strong>
              <span>Due this week</span>
            </article>
            <article className="stat-card warn">
              <strong>{stats.urgent}</strong>
              <span>Days to urgent</span>
            </article>
            <article className="stat-card">
              <strong>{stats.activeUnits}</strong>
              <span>Active units</span>
            </article>
          </section>

          <p className="section-label">Your Units</p>
          <section className="units-list">
            {units.length === 0 && <p className="empty">No courses found for this semester.</p>}
            {units.map((unit) => {
              const next = unit.assessments[0]
              const ratio = unit.currentGrade != null ? progressWidth(unit.currentGrade) : '35%'
              return (
                <button
                  key={unit.code}
                  type="button"
                  className={`unit-card ${selectedUnit?.code === unit.code ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedUnitCode(unit.code)
                    setSelectedAssessmentId(unit.assessments?.[0]?.id || '')
                    setView(VIEWS.UNIT)
                  }}
                >
                  <div className="unit-header">
                    <div>
                      <h2>{unit.code}</h2>
                      <p>{unit.name}</p>
                    </div>
                    {next && <span className={`pill ${statusTone(next.status)}`}>{next.status}</span>}
                  </div>
                  <div className="progress-track">
                    <span style={{ width: ratio }} />
                  </div>
                  <div className="unit-footer">
                    <span>Current grade: {unit.currentGrade != null ? `${unit.currentGrade}%` : 'N/A'}</span>
                    <span>Need {unit.passMark ?? 50}%+ to pass</span>
                  </div>
                </button>
              )
            })}
          </section>
        </>
      )}

      {view === VIEWS.UNIT && selectedUnit && (
        <section className="detail-panel">
          <h3>
            {selectedUnit.code} - {selectedUnit.name}
          </h3>
          <p>
            Current grade: {selectedUnit.currentGrade ?? 'N/A'}% - Need {selectedUnit.passMark ?? 50}%+ to pass
          </p>

          <div className="segmented">
            <button
              type="button"
              className={activeTab === 'assessments' ? 'active' : ''}
              onClick={() => setActiveTab('assessments')}
            >
              Assessments
            </button>
            <button
              type="button"
              className={activeTab === 'materials' ? 'active' : ''}
              onClick={() => setActiveTab('materials')}
            >
              Materials
            </button>
          </div>

          {activeTab === 'assessments' && (
            <div className="stack">
              {selectedUnit.assessments.length === 0 && <p className="empty">No assessments detected yet.</p>}
              {selectedUnit.assessments.map((assessment) => (
                <button
                  key={assessment.id}
                  type="button"
                  className="content-card card-button"
                  onClick={() => {
                    setSelectedAssessmentId(assessment.id)
                    setView(VIEWS.ASSESSMENT)
                  }}
                >
                  <div className="row between">
                    <h4>{assessment.title}</h4>
                    <strong>{assessment.overallWeight != null ? `${assessment.overallWeight}%` : '-'}</strong>
                  </div>
                  <p>
                    Due {assessment.dueText}
                    {assessment.daysLeft != null ? ` - ${assessment.daysLeft} days` : ''}
                  </p>
                  <p>
                    {assessment.score != null && assessment.possible != null
                      ? `Marks ${assessment.score}/${assessment.possible}`
                      : 'Marks N/A'}
                    {' | '}
                    {assessment.overallWeight != null
                      ? `Overall ${assessment.overallWeight}%`
                      : assessment.weight != null
                        ? `Worth ${assessment.weight} pts`
                        : 'Worth N/A'}
                  </p>
                  <div className="progress-track">
                    <span
                      className={statusTone(assessment.status)}
                      style={{ width: progressWidth(assessment.daysLeft != null ? 100 - assessment.daysLeft * 4 : 20) }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="stack">
              {selectedUnit.resources.length === 0 && <p className="empty">No materials detected yet.</p>}
              {selectedUnit.resources.map((item) => (
                <article key={item.id} className="content-card resource">
                  <div className="row">
                    <span className="week">{item.week}</span>
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.description}</p>
                      <span className={`pill ${item.covered ? 'ok' : 'warn'}`}>
                        {item.covered ? 'Covered' : 'Not covered yet'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

        </section>
      )}

      {view === VIEWS.ASSESSMENT && selectedUnit && selectedAssessment && (
        <section className="detail-panel">
          <p className="section-label">{selectedUnit.code} Assessment</p>
          <h3>{selectedAssessment.title}</h3>
          <p>
            Due {selectedAssessment.dueText}
            {selectedAssessment.daysLeft != null ? ` - ${selectedAssessment.daysLeft} days` : ''}
          </p>

          <section className="sl-stats">
            <article className="stat-card">
              <strong>{selectedAssessment.overallWeight != null ? `${selectedAssessment.overallWeight}%` : '-'}</strong>
              <span>Overall weight</span>
            </article>
            <article className="stat-card warn">
              <strong>
                {selectedAssessment.score != null && selectedAssessment.possible != null
                  ? `${selectedAssessment.score}/${selectedAssessment.possible}`
                  : 'N/A'}
              </strong>
              <span>Marks</span>
            </article>
            <article className="stat-card">
              <strong>{selectedAssessment.daysLeft ?? '-'}</strong>
              <span>Days remaining</span>
            </article>
          </section>

          <article className="callout">
            <h5>Relevant materials</h5>
            <ul>
              {(selectedUnit.resources.length ? selectedUnit.resources : [{ id: 'none', title: 'No materials linked yet.' }]).map((r) => (
                <li key={r.id}>{r.title}</li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  )
}
