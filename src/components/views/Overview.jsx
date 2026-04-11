import { useGlobal } from "../../context/GlobalContext";
import UnitCard from "../overview/UnitCard";
import { getRankedAssessments, calculateCurrentGrade } from "../../lib/utils.js";

export default function Overview() {
  const { activeCourses } = useGlobal()
  // No useEffect needed — useCanvasData in AppWrapper handles loading

  // Calculate real stats from actual data
  const allAssessments = getRankedAssessments(activeCourses)
  const dueThisWeek = allAssessments.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7
  )
  const mostUrgent = allAssessments[0] ?? null

  return (
    <>
      <div className="canvAssist-stats">
        <div className="canvAssist-stat">
          <span className="canvAssist-stat-value canvAssist-stat-value--red">
            {dueThisWeek.length}
          </span>
          <span className="canvAssist-stat-label">Due this week</span>
        </div>
        <div className="canvAssist-stat">
          <span className="canvAssist-stat-value canvAssist-stat-value--amber">
            {mostUrgent?.daysUntilDue ?? '—'}
          </span>
          <span className="canvAssist-stat-label">Days to urgent</span>
        </div>
        <div className="canvAssist-stat">
          <span className="canvAssist-stat-value canvAssist-stat-value--white">
            {activeCourses.length}
          </span>
          <span className="canvAssist-stat-label">Active units</span>
        </div>
      </div>

      <p className="canvAssist-section-label">YOUR UNITS</p>
      <ul className="canvAssist-units">
        {activeCourses.length === 0 ? (
          <li style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 12 }}>
            No units found — click sync to load your Canvas data.
          </li>
        ) : (
          activeCourses.map((course) => (
            <UnitCard
              key={course.id}
              code={course.code}
              friendlyName={course.friendlyName}
              unitId={course.id}
              unit={course}
              grade={course.currentGrade ?? calculateCurrentGrade(course.assessments)}
            />
          ))
        )}
      </ul>
    </>
  )
}