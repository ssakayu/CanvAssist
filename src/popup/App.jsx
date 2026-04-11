import { useEffect, useMemo, useState } from 'react'
import './App.css'

const markerNotes = [
  'Working software matters more than docs - app must run cleanly for the demo.',
  'Explain design decisions - tutors want reasoning, not just what you built.',
  'Testing evidence is required for Distinction - unit tests or documented manual tests.',
  'Git history should show individual contributions - avoid giant bulk pushes.',
]

const MESSAGE_TYPES = {
  SCRAPE: 'STUDYLENS_SCRAPE',
}

const VIEWS = {
  OVERVIEW: 'overview',
  UNIT: 'unit',
  ASSESSMENT: 'assessment',
}

function statusTone(status = '') {
  const normalized = status.toLowerCase()
  if (normalized.includes('risk') || normalized.includes('overdue')) return 'danger'
  if (normalized.includes('due')) return 'warn'
  if (normalized.includes('upcoming')) return 'neutral'
  return 'ok'
}

function groupByUnit(snapshot) {
  if (!snapshot) return []
  const allAssessments = snapshot.assessments ?? []
  const resources = snapshot.resources ?? []
  const units = snapshot.units ?? []

  const map = new Map()
  for (const unit of units) {
    map.set(unit.code, {
      code: unit.code,
      name: unit.name,
      assessments: [],
      resources: [],
      currentGrade: unit.currentGrade,
      passMark: unit.passMark ?? 50,
    })
  }

  for (const item of allAssessments) {
    const code = item.unitCode || 'Unknown'
    const existing = map.get(code) ?? {
      code,
      name: item.unitName || code,
      assessments: [],
      resources: [],
      currentGrade: null,
      passMark: 50,
    }
    existing.assessments.push(item)
    map.set(code, existing)
  }

  for (const material of resources) {
    const code = material.unitCode || 'Unknown'
    const existing = map.get(code) ?? {
      code,
      name: code,
      assessments: [],
      resources: [],
      currentGrade: null,
      passMark: 50,
    }
    existing.resources.push(material)
    map.set(code, existing)
  }

  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function computeStats(units) {
  const allAssessments = units.flatMap((unit) => unit.assessments)
  const dueThisWeek = allAssessments.filter((item) => item.daysLeft != null && item.daysLeft <= 7 && item.daysLeft >= 0).length
  const urgent = allAssessments.filter((item) => item.daysLeft != null && item.daysLeft <= 3 && item.daysLeft >= 0).length
  return {
    dueThisWeek,
    urgent,
    activeUnits: units.length,
  }
}

function progressWidth(value, max = 100) {
  const clamped = Math.max(0, Math.min(value ?? 0, max))
  return `${clamped}%`
}

function isCanvasUrl(url = '') {
  try {
    const parsed = new URL(url)
    const isQutCanvas = parsed.hostname === 'canvas.qut.edu.au'
    const isAllowedPath = parsed.pathname === '/' || parsed.pathname.startsWith('/courses')
    return isQutCanvas && isAllowedPath
  } catch {
    return false
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function requestCanvasSnapshotFromPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const COURSE_CODE_REGEX = /\b[A-Z]{2,4}\d{2,4}\b/
      const clean = (value = '') => value.replace(/\s+/g, ' ').trim()

      const requestData = async (url) => {
        const res = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`)
        }
        return res.json()
      }

      const extractCode = (courseObj) => {
        // First try course_code field if it exists
        if (courseObj.course_code) {
          const match = courseObj.course_code.match(COURSE_CODE_REGEX)
          if (match) return match[0]
        }
        // Then try extracting from name
        const nameMatch = courseObj.name?.match(COURSE_CODE_REGEX)
        if (nameMatch) return nameMatch[0]
        // Fallback: use first part of name before dash or space
        const parts = clean(courseObj.name || '').split(/[\s\-–—]/)[0]
        return parts || 'Unnamed'
      }

      const toDaysLeft = (dueAt) => {
        if (!dueAt) return null
        return Math.ceil((new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      }
      const statusFor = (daysLeft) => {
        if (daysLeft == null) return 'Upcoming'
        if (daysLeft < 0) return 'Overdue'
        if (daysLeft <= 3) return 'Due soon'
        if (daysLeft <= 10) return 'Upcoming'
        return 'On track'
      }

      // Fetch active enrolled courses for this semester
      const coursesRaw = await requestData('/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=100')
      let preferredCourses = coursesRaw

      try {
        const favoriteCourses = await requestData('/api/v1/users/self/favorites/courses?per_page=100')
        const favoriteIds = new Set((favoriteCourses || []).map((course) => String(course.id)))
        if (favoriteIds.size) {
          const favoriteOnly = coursesRaw.filter((course) => favoriteIds.has(String(course.id)))
          if (favoriteOnly.length) preferredCourses = favoriteOnly
        }
      } catch {
        // Keep using active courses when favorites endpoint is unavailable.
      }
      
      const units = preferredCourses.map((course) => {
        const code = extractCode(course)
        const enrollment = course.enrollments?.[0]
        return {
          id: String(course.id),
          code,
          name: clean(course.name || course.course_code || code),
          currentGrade: enrollment?.computed_current_score != null ? Math.round(enrollment.computed_current_score) : null,
          passMark: 50,
          restrictQuantitativeData: course.restrict_quantitative_data || false,
          hideFinalGrades: course.hide_final_grades || false,
        }
      })

      const assessments = []
      const resources = []

      // For each course, fetch actual student submissions as assessments
      for (const unit of units) {
        try {
          const submissions = await requestData(
            `/api/v1/courses/${unit.id}/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`,
          )
          
          for (const submission of submissions) {
            if (!submission?.assignment?.name) continue
            
            const assignment = submission.assignment
            const dueAt = assignment?.due_at || null
            const daysLeft = toDaysLeft(dueAt)
            
            assessments.push({
              id: `a-${assignment.id}`,
              unitCode: unit.code,
              unitName: unit.name,
              title: clean(assignment.name),
              dueText: dueAt 
                ? new Date(dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                : 'No due date',
              dueAt,
              weight: typeof assignment.points_possible === 'number' ? Math.round(assignment.points_possible) : null,
              score: submission.score,
              possible: assignment?.points_possible,
              status: submission.workflow_state,
              graded: submission.score !== null,
              status_tone: statusFor(daysLeft),
              daysLeft,
            })
          }
        } catch (err) {
          // Keep going per course
        }
      }

      return {
        sourceUrl: location.href,
        syncedAt: new Date().toISOString(),
        units,
        assessments,
        resources,
      }
    },
  })

  return result
}

async function scrapeFromTab() {
  const tab = await getActiveTab()
  if (!tab?.id || !isCanvasUrl(tab.url)) {
    return { error: 'Open https://canvas.qut.edu.au/ or https://canvas.qut.edu.au/courses, then click Sync now.' }
  }

  try {
    const directSnapshot = await requestCanvasSnapshotFromPage(tab.id)
    if (directSnapshot?.units?.length || directSnapshot?.assessments?.length || directSnapshot?.resources?.length) {
      await chrome.storage.local.set({ studylensSnapshot: directSnapshot })
      return { snapshot: directSnapshot }
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.SCRAPE })
    if (response?.ok && response.snapshot) {
      await chrome.storage.local.set({ studylensSnapshot: response.snapshot })
      return { snapshot: response.snapshot }
    }
    return { error: response?.error || 'Canvas data fetch failed.' }
  } catch {
    return { error: 'Canvas script is not ready. Refresh Canvas and try again.' }
  }
}

async function readStoredSnapshot() {
  const payload = await chrome.storage.local.get('studylensSnapshot')
  return payload.studylensSnapshot ?? null
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [selectedUnitCode, setSelectedUnitCode] = useState('')
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [activeTab, setActiveTab] = useState('assessments')
  const [view, setView] = useState(VIEWS.OVERVIEW)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const units = useMemo(() => groupByUnit(snapshot), [snapshot])
  const stats = useMemo(() => computeStats(units), [units])

  const selectedUnit = units.find((unit) => unit.code === selectedUnitCode) ?? units[0] ?? null
  const selectedAssessment =
    selectedUnit?.assessments.find((assessment) => assessment.id === selectedAssessmentId) ??
    selectedUnit?.assessments[0] ??
    null

  useEffect(() => {
    async function loadCanvasData() {
      setIsLoading(true)
      setError('')
      
      const tab = await getActiveTab()
      if (!tab?.url || !isCanvasUrl(tab.url)) {
        setError('Open Canvas QUT to use this extension')
        setIsLoading(false)
        return
      }

      // Auto-fetch fresh data from Canvas
      const result = await scrapeFromTab()
      if (result.snapshot) {
        setSnapshot(result.snapshot)
          const allUnits = groupByUnit(result.snapshot)
          const firstUnit = allUnits?.[0]
          setSelectedUnitCode(firstUnit?.code || '')
          setSelectedAssessmentId(firstUnit?.assessments?.[0]?.id || '')
        setError('')
      } else {
        // Fallback: try loading from storage
        const stored = await readStoredSnapshot()
        if (stored) {
          setSnapshot(stored)
            const storedUnits = groupByUnit(stored)
            const storedFirstUnit = storedUnits?.[0]
            setSelectedUnitCode(storedFirstUnit?.code || '')
            setSelectedAssessmentId(storedFirstUnit?.assessments?.[0]?.id || '')
          setError('')
        } else {
          setError(result.error || 'Could not load Canvas data')
        }
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
            <h1>StudyLens</h1>
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
            <button
              type="button"
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
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
                    <strong>{assessment.weight ? `${assessment.weight}%` : '-'}</strong>
                  </div>
                  <p>
                    Due {assessment.dueText}
                    {assessment.daysLeft != null ? ` - ${assessment.daysLeft} days` : ''}
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

          {activeTab === 'overview' && (
            <article className="callout">
              <h5>What markers actually want</h5>
              <ul>
                {markerNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>
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
              <strong>{selectedAssessment.weight ? `${selectedAssessment.weight}%` : '-'}</strong>
              <span>Weight</span>
            </article>
            <article className="stat-card warn">
              <strong>{selectedAssessment.daysLeft ?? '-'}</strong>
              <span>Days remaining</span>
            </article>
            <article className="stat-card">
              <strong>{selectedUnit.currentGrade != null ? `${selectedUnit.currentGrade}%` : 'N/A'}</strong>
              <span>Current grade</span>
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
