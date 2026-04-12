import { useState, useEffect } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { getLastSync } from '../../lib/storage.js'
import { getRankedAssessments, calculateCurrentGrade, getUnitStatus, getStatusLabel, formatLastSync } from '../../lib/utils.js'
import './overview.css'

export default function Overview() {
  const { activeCourses, setView } = useGlobal()
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    getLastSync().then(setLastSync)

    const handleMessage = (msg) => {
      if (msg.type === 'SYNC_COMPLETE') getLastSync().then(setLastSync)
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  function handleSync() {
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  if (activeCourses.length === 0) {
    return (
      <div className='studylens-card'>
        <div className='topbar'>
          <div className='brand'><h1>CanvAssist</h1></div>
          <button className='sync-btn' onClick={handleSync}>Sync Canvas data</button>
        </div>
        <p style={{ color: '#f6efe4', fontSize: 14 }}>No data yet — sync Canvas to get started.</p>
      </div>
    )
  }

  const allAssessments = getRankedAssessments(activeCourses)
  const dueThisWeek = allAssessments.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7
  )
  const mostUrgent = allAssessments[0] ?? null

  return (
    <div className='studylens-card'>

      {/* ── Topbar ── */}
      <div className='topbar'>
        <div className='brand'><h1>CanvAssist</h1></div>
        <div className='sync-pill'>
          <span className='dot green' />
          <span>{formatLastSync(lastSync)}</span>
          <button className='sync-btn' onClick={handleSync}>Sync</button>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className='stats-grid'>
        <div className='stat-box'>
          <div className={`stat-number ${dueThisWeek.length > 0 ? 'red' : 'white'}`}>
            {dueThisWeek.length}
          </div>
          <div className='stat-label'>Due this week</div>
        </div>
        <div className='stat-box'>
          <div className={`stat-number ${mostUrgent?.daysUntilDue <= 3 ? 'amber' : 'white'}`}>
            {mostUrgent?.daysUntilDue != null ? `${mostUrgent.daysUntilDue}d` : '—'}
          </div>
          <div className='stat-label'>Days to urgent</div>
        </div>
        <div className='stat-box'>
          <div className='stat-number white'>{activeCourses.length}</div>
          <div className='stat-label'>Active units</div>
        </div>
      </div>

      {/* ── Most urgent callout ── */}
      {mostUrgent && (
        <div className='unit-card-urgent'>
          <span className='urgent-label'>Most urgent</span>
          <span className='urgent-name'>{mostUrgent.name}</span>
          <span className='urgent-meta'>
            {mostUrgent.unitCode} · Due {mostUrgent.dueDateFormatted} · {mostUrgent.pointsPossible}pts
          </span>
        </div>
      )}

      {/* ── Unit list ── */}
      <div className='section-title'>YOUR UNITS</div>
      <div className='unit-list'>
        {activeCourses.map(unit => (
          <UnitCard
            key={unit.id}
            unit={unit}
            onClick={() => setView({ page: 'unit', params: { unitId: unit.id, unitCode: unit.code, unit } })}
          />
        ))}
      </div>

      {/* ── Debug: ranked assessments ── */}
      <details className='debug-section'>
        <summary>debug — all assessments ranked by urgency ({allAssessments.length})</summary>
        <ol style={{ paddingLeft: 16, marginTop: 6 }}>
          {allAssessments.map(a => (
            <li key={a.id}>
              <pre>{`[${a.unitCode}] ${a.name}
  urgency: ${a.urgencyScore ?? '—'}  days: ${a.daysUntilDue ?? '—'}  pts: ${a.pointsPossible}  status: ${a.submission?.status ?? '—'}`}</pre>
            </li>
          ))}
        </ol>
      </details>

    </div>
  )
}

function UnitCard({ unit, onClick }) {
  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const status = getUnitStatus(grade)
  const statusLabel = getStatusLabel(status)

  const upcomingCount = unit.assessments?.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 14
  ).length ?? 0

  const statusClass =
    status === 'distinction' || status === 'on_track' ? 'unit-status--success'
    : status === 'borderline' ? 'unit-status--warning'
    : status === 'at_risk' ? 'unit-status--danger'
    : 'unit-status--unknown'

  const fillClass = status === 'at_risk' || status === 'borderline' ? 'red' : 'green'

  return (
    <div className='unit-card' onClick={onClick}>
      <div className='unit-card-top'>
        <div className='unit-card-left'>
          <span className='unit-code'>{unit.code}</span>
          <span className='unit-name'>{unit.friendlyName}</span>
        </div>
        <span className={`unit-status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className='progress-track'>
        <div
          className={`progress-fill ${fillClass}`}
          style={{ width: `${Math.min(100, Math.max(0, grade ?? 0))}%` }}
        />
      </div>

      <div className='unit-card-bottom'>
        <span>Current grade: {grade !== null ? `${grade}%` : 'No grades yet'}</span>
        {upcomingCount > 0 && (
          <span className='unit-upcoming'>{upcomingCount} due soon</span>
        )}
      </div>
    </div>
  )
}
