import { useState, useEffect } from 'react'
import { getUnit } from '../../lib/storage.js'
import { projectGrade, calculateCurrentGrade, getUrgencyLabel } from '../../lib/utils.js'

export default function AssessmentDetail({ assessment: initialAssessment, unit: initialUnit }) {
  const [assessment, setAssessment] = useState(initialAssessment)
  const [unit, setUnit] = useState(initialUnit)
  const [whatIfScore, setWhatIfScore] = useState(70)

  useEffect(() => {
    let cancelled = false
    async function loadFresh() {
      const fresh = await getUnit(initialUnit.id)
      if (!fresh || cancelled) return
      const freshAssessment = fresh.assessments.find(a => a.id === initialAssessment.id)
      if (freshAssessment) setAssessment(freshAssessment)
      setUnit(fresh)
    }
    loadFresh()
    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) loadFresh()
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => { cancelled = true; chrome.runtime.onMessage.removeListener(handleMessage) }
  }, [initialAssessment.id])

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const projected = projectGrade(unit.assessments, assessment.id, whatIfScore)
  const status = assessment.submission?.status ?? 'unsubmitted'

  return (
    <section className="assessment-panel">
      <h3 className="section-heading">{assessment.name}</h3>
      <div className="assessment-card-bottom">
        <span className="assessment-card-due">{getUrgencyLabel(assessment.daysUntilDue)}</span>
        <span className="assessment-card-points">{assessment.pointsPossible ?? '-'} pts</span>
      </div>

      <div className="info-grid">
        <article className="info-card">
          <div className="info-value">{grade ?? 'N/A'}%</div>
          <div className="info-label">Current unit grade</div>
        </article>
        <article className="info-card">
          <div className="info-value">{assessment.submission?.score ?? 'N/A'}</div>
          <div className="info-label">Submitted mark</div>
        </article>
      </div>

      <article className="callout" style={{ padding: 12 }}>
        <h4 className="section-heading" style={{ marginBottom: 6 }}>Submission</h4>
        <div className="assessment-card-bottom">
          <span className="assessment-card-status">Status: {status}</span>
          <span className="assessment-card-status">Attempt: {assessment.submission?.attempt ?? '-'}</span>
        </div>
        <div className="assessment-card-bottom" style={{ marginTop: 8 }}>
          {assessment.submission?.late && <span className="meta-tag meta-tag--late">Late</span>}
          {assessment.submission?.missing && <span className="meta-tag meta-tag--missing">Missing</span>}
          {assessment.htmlUrl && (
            <a className="link-button" href={assessment.htmlUrl} target="_blank" rel="noreferrer">
              Open on Canvas
            </a>
          )}
        </div>
      </article>

      {assessment.aiDescriptionSummary && (
        <article className="callout" style={{ padding: 12 }}>
          <h4 className="section-heading" style={{ marginBottom: 6 }}>What this assignment asks</h4>
          <span className="ai-badge">AI summary</span>
          <p className="ai-summary-item" style={{ marginTop: 8 }}>{assessment.aiDescriptionSummary}</p>
        </article>
      )}

      <article className="callout" style={{ padding: 12 }}>
        <h4 className="section-heading" style={{ marginBottom: 6 }}>Relevant modules</h4>
        {assessment.relevantModules?.length > 0 ? (
          <div className="module-relevant">
            {assessment.relevantModules.map((m) => (
              <span key={m.weekNumber} className="module-relevant-tag">Week {m.weekNumber}: {m.topic}</span>
            ))}
          </div>
        ) : (
          <p className="assessment-card-status">No linked modules yet.</p>
        )}
      </article>

      <article className="callout" style={{ padding: 12 }}>
        <h4 className="section-heading" style={{ marginBottom: 6 }}>What markers want</h4>
        {!assessment.hasRubric ? (
          <p className="assessment-card-status">No rubric available for this assessment.</p>
        ) : assessment.aiRubricSummary?.length > 0 ? (
          <ul className="ai-summary-list">
            {assessment.aiRubricSummary.map((bullet, index) => (
              <li key={index} className="ai-summary-item">{bullet}</li>
            ))}
          </ul>
        ) : (
          <p className="assessment-card-status">AI rubric summary loading...</p>
        )}
      </article>

      <article className="callout" style={{ padding: 12 }}>
        <h4 className="section-heading" style={{ marginBottom: 6 }}>Grade what-if</h4>
        <input
          className="grade-slider"
          type='range'
          min={0}
          max={100}
          step={1}
          value={whatIfScore}
          onChange={e => setWhatIfScore(Number(e.target.value))}
        />
        <div className="slider-labels">
          <span>0%</span>
          <span>If I score {whatIfScore}%</span>
          <span>100%</span>
        </div>
        <div className="calculator-results">
          <div className="calculator-result-row">
            <span className="result-label">Projected grade</span>
            <span className={`result-value ${projected != null && projected >= 50 ? 'result-value--pass' : 'result-value--fail'}`}>
              {projected ?? 'N/A'}%
            </span>
          </div>
          <div className="calculator-result-row">
            <span className="result-label">Pass threshold</span>
            <span className="result-value">50%</span>
          </div>
        </div>
      </article>
    </section>
  )
}
