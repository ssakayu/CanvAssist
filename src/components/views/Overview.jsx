// src/components/views/Overview.jsx
import { useGlobal } from "../../context/GlobalContext"
import { getRankedAssessments, calculateCurrentGrade, getUnitStatus, getStatusLabel } from "../../lib/utils.js"

export default function Overview() {
  const { activeCourses, setView } = useGlobal()

  const allAssessments = getRankedAssessments(activeCourses)
  const dueThisWeek = allAssessments.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7
  )
  const mostUrgent = allAssessments[0] ?? null

  if (activeCourses.length === 0) {
    return (
      <div className='canvAssist-body'>
        <div className='canvAssist-empty'>
          No data yet — click ↻ to sync Canvas
        </div>
      </div>
    )
  }

  return (
    <div className='canvAssist-body'>
      <div className='canvAssist-stats'>
        <div className='canvAssist-stat'>
          <span className={`canvAssist-stat-value ${dueThisWeek.length > 0 ? 'canvAssist-stat-value--red' : ''}`}>
            {dueThisWeek.length}
          </span>
          <span className='canvAssist-stat-label'>Due this week</span>
        </div>
        <div className='canvAssist-stat'>
          <span className={`canvAssist-stat-value ${mostUrgent?.daysUntilDue <= 3 ? 'canvAssist-stat-value--amber' : ''}`}>
            {mostUrgent?.daysUntilDue !== null && mostUrgent?.daysUntilDue !== undefined ? `${mostUrgent.daysUntilDue}d` : '—'}
          </span>
          <span className='canvAssist-stat-label'>Most urgent</span>
        </div>
        <div className='canvAssist-stat'>
          <span className='canvAssist-stat-value canvAssist-stat-value--white'>
            {activeCourses.length}
          </span>
          <span className='canvAssist-stat-label'>Active units</span>
        </div>
      </div>

      <p className='canvAssist-section-label'>Your units</p>

      <ul className='canvAssist-units'>
        {activeCourses.map(course => (
          <UnitCard
            key={course.id}
            course={course}
            onSelect={() => setView({ page: 'unit', params: { unitId: course.id, unitCode: course.code, unit: course } })}
          />
        ))}
      </ul>
    </div>
  )
}

function UnitCard({ course, onSelect }) {
  const grade = course.currentGrade ?? calculateCurrentGrade(course.assessments)
  const status = getUnitStatus(grade)
  const statusLabel = getStatusLabel(status)

  const upcomingCount = course.assessments?.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 14
  ).length ?? 0

  const badgeClass =
    status === 'at_risk' ? 'canvAssist-badge canvAssist-badge--risk'
    : status === 'borderline' ? 'canvAssist-badge canvAssist-badge--soon'
    : 'canvAssist-badge canvAssist-badge--ok'

  const barClass =
    status === 'at_risk' ? 'canvAssist-bar-fill canvAssist-bar-fill--red'
    : status === 'borderline' ? 'canvAssist-bar-fill canvAssist-bar-fill--amber'
    : 'canvAssist-bar-fill canvAssist-bar-fill--green'

  const footerRight =
    status === 'distinction' ? 'Distinction range'
    : status === 'on_track' ? 'On track'
    : status === 'borderline' ? 'Watch this'
    : status === 'at_risk' ? 'Need 50%+ to pass'
    : 'No grades yet'

  return (
    <li className='canvAssist-unit' onClick={onSelect}>
      <div className='canvAssist-unit-top'>
        <span className='canvAssist-unit-code'>{course.code}</span>
        <span className={badgeClass}>
          {upcomingCount > 0 ? `${upcomingCount} due soon` : statusLabel}
        </span>
      </div>
      <p className='canvAssist-unit-name'>{course.friendlyName}</p>
      <div className='canvAssist-bar'>
        <div className={barClass} style={{ width: `${Math.min(100, Math.max(0, grade ?? 0))}%` }} />
      </div>
      <div className='canvAssist-unit-footer'>
        <span>Current grade: <strong>{grade !== null ? `${grade}%` : '—'}</strong></span>
        <span>{footerRight}</span>
      </div>
    </li>
  )
}