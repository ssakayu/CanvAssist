import { useEffect, useState } from "react"
import { useGlobal } from "../../context/GlobalContext"
import { getUnit } from "../../lib/storage.js"

export default function AssessmentDetail({ assessment: initialAssessment, unit: initialUnit }) {
  const [assessment, setAssessment] = useState(initialAssessment)
  const [unit, setUnit] = useState(initialUnit)

  useEffect(() => {
    async function loadFresh() {
      const fresh = await getUnit(initialUnit.id)
      if (!fresh) return
      const freshAssessment = fresh.assessments.find(a => a.id === initialAssessment.id)
      if (freshAssessment) setAssessment(freshAssessment)
      setUnit(fresh)
    }

    loadFresh()

    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) loadFresh()
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [initialAssessment.id])

  return (
    <div style={{ padding: 16 }}>
      <p><strong>{assessment.name}</strong></p>
      <p style={{ fontSize: 12, color: '#666' }}>
        Due: {assessment.dueDateFormatted} · {assessment.pointsPossible}pts · {assessment.submission?.status}
      </p>

      <p><strong>What markers want</strong></p>
      {assessment.aiRubricSummary ? (
        <ul>
          {assessment.aiRubricSummary.map((bullet, i) => (
            <li key={i} style={{ fontSize: 13, marginBottom: 6 }}>{bullet}</li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, color: '#666' }}>
          {assessment.hasRubric ? 'Rubric available but not decoded yet' : assessment.description || 'No rubric available'}
        </p>
      )}

      <p><strong>Relevant materials</strong></p>
      {unit.modules?.filter(m => m.relevantAssessments?.includes(assessment.name)).map(module => (
        <div key={module.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <p style={{ margin: 0 }}>Week {module.weekNumber} — {module.topic}</p>
          {module.aiSummary && <p style={{ margin: 0, fontSize: 11, color: '#666' }}>{module.aiSummary}</p>}
        </div>
      ))}

      <p><strong>Grade calculator</strong></p>
      <p style={{ fontSize: 12, color: '#666' }}>
        Current score: {assessment.submission?.score ?? 'not graded'} / {assessment.pointsPossible}
      </p>
    </div>
  )
}