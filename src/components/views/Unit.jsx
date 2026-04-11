import { useEffect, useState } from "react"
import { useGlobal } from "../../context/GlobalContext"
import { getUnit } from "../../lib/storage.js"

export default function Unit({ unitId, unitCode, unit: initialUnit }) {
  const { setView } = useGlobal()
  const [unit, setUnit] = useState(initialUnit ?? null)

  useEffect(() => {
    if (!unit) getUnit(unitId).then(u => { if (u) setUnit(u) })

    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) {
        getUnit(unitId).then(u => { if (u) setUnit(u) })
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [unitId])

  if (!unit) return <p>Loading...</p>

  return (
    <div style={{ padding: 16 }}>
      <p><strong>{unit.code}</strong> — {unit.friendlyName}</p>

      <p><strong>Assessments</strong></p>
      {unit.assessments?.map(assessment => (
        <div
          key={assessment.id}
          onClick={() => setView({ page: 'assessment', params: { assessment, unit } })}
          style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
        >
          <p style={{ margin: 0 }}><strong>{assessment.name}</strong></p>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            Due: {assessment.dueDateFormatted} · {assessment.pointsPossible}pts · {assessment.submission?.status}
          </p>
          {assessment.aiRubricSummary && (
            <p style={{ margin: 0, fontSize: 11, color: '#1a7f5a' }}>✓ AI decoded</p>
          )}
        </div>
      ))}

      <p style={{ marginTop: 16 }}><strong>Materials</strong></p>
      {unit.modules?.map(module => (
        <div key={module.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <p style={{ margin: 0 }}>Week {module.weekNumber} — {module.topic}</p>
          {module.aiSummary && (
            <p style={{ margin: 0, fontSize: 11, color: '#666' }}>{module.aiSummary}</p>
          )}
        </div>
      ))}
    </div>
  )
}