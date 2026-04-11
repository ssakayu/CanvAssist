// src/components/views/AssessmentDetail.jsx
import { useState, useEffect } from "react"
import { getUnit } from "../../lib/storage.js"
import { projectGrade, calculateCurrentGrade, getUrgencyLabel, getUrgencyColor } from "../../lib/utils.js"

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
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [initialAssessment.id])

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const projected = projectGrade(unit.assessments, assessment.id, whatIfScore)
  const passThreshold = 50

  const urgencyColor = getUrgencyColor(assessment.daysUntilDue)
  const urgencyValueClass = `canvAssist-info-value ${
    urgencyColor === 'red' ? 'canvAssist-info-value--red'
    : urgencyColor === 'amber' ? 'canvAssist-info-value--amber'
    : 'canvAssist-info-value--green'
  }`

  return (
    <div className='canvAssist-body'>

      {/* Breadcrumb */}
      <div className='canvAssist-breadcrumb'>
        <span>{unit.code}</span>
        <span className='canvAssist-breadcrumb-sep'>›</span>
        <span style={{ color: '#111827' }}>
          {assessment.name.length > 35 ? assessment.name.slice(0, 35) + '...' : assessment.name}
        </span>
      </div>

      {/* Info grid */}
      <div className='canvAssist-info-grid'>
        <div className='canvAssist-info-card'>
          <span className='canvAssist-info-value'>{assessment.pointsPossible}pts</span>
          <span className='canvAssist-info-label'>Worth</span>
        </div>
        <div className='canvAssist-info-card'>
          <span className={urgencyValueClass}>{getUrgencyLabel(assessment.daysUntilDue)}</span>
          <span className='canvAssist-info-label'>Due</span>
        </div>
        <div className='canvAssist-info-card'>
          <span className='canvAssist-info-value'>{grade !== null ? `${grade}%` : '—'}</span>
          <span className='canvAssist-info-label'>Current grade</span>
        </div>
        <div className='canvAssist-info-card'>
          <span className='canvAssist-info-value'>
            {assessment.submission?.status === 'graded'
              ? `${assessment.submission.score ?? '—'}pts`
              : assessment.submission?.status === 'submitted'
                ? 'Submitted'
                : 'Not submitted'
            }
          </span>
          <span className='canvAssist-info-label'>Submission</span>
        </div>
      </div>

      {/* Meta tags */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Due {assessment.dueDateFormatted}</span>
        {assessment.submission?.late && <span className='canvAssist-meta-tag canvAssist-meta-tag--late'>Late</span>}
        {assessment.submission?.missing && <span className='canvAssist-meta-tag canvAssist-meta-tag--missing'>Missing</span>}
      </div>

      <div className='canvAssist-divider' />

      {/* What markers want */}
      <div className='canvAssist-section-hdr'>What markers want</div>

      {assessment.aiRubricSummary ? (
        <div>
          <span className='canvAssist-ai-badge'>AI decoded</span>
          <ul className='canvAssist-ai-list'>
            {assessment.aiRubricSummary.map((bullet, i) => (
              <li key={i} className='canvAssist-ai-item'>{bullet}</li>
            ))}
          </ul>
        </div>
      ) : assessment.hasRubric ? (
        <RawRubric rubric={assessment.rubric} />
      ) : (
        <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
          {assessment.description || 'No rubric or description available.'}
        </p>
      )}

      <div className='canvAssist-divider' />

      {/* Grade what-if */}
      <div className='canvAssist-section-hdr'>Grade what-if</div>

      <div className='canvAssist-slider-label'>
        <span>If I score {whatIfScore}% on this assessment</span>
      </div>
      <input
        type='range'
        min={0}
        max={100}
        step={1}
        value={whatIfScore}
        onChange={e => setWhatIfScore(Number(e.target.value))}
        className='canvAssist-grade-slider'
      />

      <div className='canvAssist-calc-results'>
        <div className='canvAssist-calc-row'>
          <span className='canvAssist-calc-label'>Current overall</span>
          <span className='canvAssist-calc-value'>{grade !== null ? `${grade}%` : '—'}</span>
        </div>
        <div className='canvAssist-calc-row'>
          <span className='canvAssist-calc-label'>Projected overall</span>
          <span className={`canvAssist-calc-value ${projected >= passThreshold ? 'canvAssist-calc-value--pass' : 'canvAssist-calc-value--fail'}`}>
            {projected !== null ? `${projected}%` : '—'}
          </span>
        </div>
        <div className='canvAssist-calc-row'>
          <span className='canvAssist-calc-label'>To pass this unit</span>
          <span className='canvAssist-calc-value'>Need 50%+</span>
        </div>
      </div>

      {projected !== null && (
        <p className={`canvAssist-calc-message canvAssist-calc-message--${projected >= passThreshold ? 'pass' : 'fail'}`}>
          {projected >= 85
            ? 'Looking great — on track for Distinction.'
            : projected >= 65
              ? 'On track — keep it up.'
              : projected >= passThreshold
                ? 'Passing but tight — worth putting in more effort.'
                : "Below passing — you'll need to score higher to pass this unit."
          }
        </p>
      )}

    </div>
  )
}

function RawRubric({ rubric }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rubric?.map(criterion => (
        <div key={criterion.id} style={{ border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{criterion.description}</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{criterion.points}pts</span>
          </div>
          {criterion.ratings?.map(rating => (
            <div key={rating.id} style={{ padding: '5px 0', borderTop: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{rating.description}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{rating.points}pts</span>
              </div>
              {rating.longDescription && (
                <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{rating.longDescription}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}