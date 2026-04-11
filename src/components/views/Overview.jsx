import { useGlobal } from '../../context/GlobalContext'
import { getRankedAssessments, calculateCurrentGrade } from '../../lib/utils.js'

export default function Overview() {
  const { activeCourses, setView } = useGlobal()

  if (activeCourses.length === 0) {
    return <p>No data — click ↻ sync</p>
  }

  const allAssessments = getRankedAssessments(activeCourses)
  const dueThisWeek = allAssessments.filter(a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7)

  return (
    <div>
      {/* ── Stats ── */}
      <section style={{ marginBottom: 12 }}>
        <strong>STATS</strong>
        <pre>
{`due this week : ${dueThisWeek.length}
active units  : ${activeCourses.length}
total assessed: ${allAssessments.length}`}
        </pre>
      </section>

      {/* ── Ranked assessments ── */}
      <section style={{ marginBottom: 12 }}>
        <strong>ALL ASSESSMENTS (ranked by urgency)</strong>
        <ol style={{ paddingLeft: 16, marginTop: 4 }}>
          {allAssessments.map(a => (
            <li key={a.id} style={{ marginBottom: 4 }}>
              <span>[{a.unitCode}] {a.name}</span>
              <pre style={{ marginLeft: 8 }}>
{`  urgencyScore : ${a.urgencyScore ?? '—'}
  daysUntilDue : ${a.daysUntilDue ?? '—'}
  points       : ${a.pointsPossible}
  status       : ${a.submission?.status ?? '—'}`}
              </pre>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Units ── */}
      <section>
        <strong>UNITS</strong>
        {activeCourses.map(course => {
          const grade = course.currentGrade ?? calculateCurrentGrade(course.assessments)
          return (
            <div key={course.id} style={{ border: '1px solid #ccc', padding: 6, marginTop: 6 }}>
              <pre>
{`id           : ${course.id}
code         : ${course.code}
name         : ${course.friendlyName}
currentGrade : ${grade ?? '—'}%
assessments  : ${course.assessments?.length ?? 0}
modules      : ${course.modules?.length ?? 0}
aiLinked     : ${course.relevantModulesLinked ?? false}`}
              </pre>
              <button onClick={() => setView({ page: 'unit', params: { unitId: course.id, unitCode: course.code, unit: course } })}>
                → open unit
              </button>
            </div>
          )
        })}
      </section>
    </div>
  )
}
