import { useGlobal } from "../../context/GlobalContext"
import { calculateCurrentGrade } from "../../lib/utils.js"

export default function Overview() {
  const { activeCourses, setView } = useGlobal()

  if (activeCourses.length === 0) return <p>No data — click ↻ to sync</p>

  return (
    <div style={{ padding: 16 }}>
      <p><strong>Units</strong></p>
      {activeCourses.map(unit => {
        const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
        return (
          <div
            key={unit.id}
            onClick={() => setView({ page: 'unit', params: { unitId: unit.id, unitCode: unit.code, unit } })}
            style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
          >
            <p style={{ margin: 0 }}><strong>{unit.code}</strong> — {unit.friendlyName}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              Grade: {grade !== null ? `${grade}%` : 'hidden'} · {unit.assessments?.length} assessments · {unit.modules?.length} modules
            </p>
          </div>
        )
      })}
    </div>
  )
}