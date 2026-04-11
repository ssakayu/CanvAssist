// screens/AssessmentDetail.jsx
// Reads fresh data from storage on mount so AI summaries show correctly
// even if AI enrichment finished after the component first rendered

import { useState, useEffect } from 'react'
import { getUnit } from '../lib/storage.js'
import { projectGrade, calculateCurrentGrade, getUrgencyLabel, getUrgencyColor } from '../lib/utils.js'

export default function AssessmentDetail({ assessment: initialAssessment, unit: initialUnit, onBack }) {
  const [assessment, setAssessment] = useState(initialAssessment)
  const [unit, setUnit] = useState(initialUnit)
  const [whatIfScore, setWhatIfScore] = useState(70)

  useEffect(() => {
    // Load fresh data immediately — AI may have finished after component mounted
    loadFreshData()

    // Also reload when AI enrichment completes
    const handleMessage = (msg) => {
      if (msg.type === 'AI_UNIT_COMPLETE' && msg.unitId === initialUnit.id) loadFreshData()
      if (msg.type === 'AI_COMPLETE') loadFreshData()
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [initialAssessment.id])

  async function loadFreshData() {
    const freshUnit = await getUnit(initialUnit.id)
    if (!freshUnit) return
    const freshAssessment = freshUnit.assessments.find(a => a.id === initialAssessment.id)
    if (freshAssessment) setAssessment(freshAssessment)
    setUnit(freshUnit)
  }

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const projected = projectGrade(unit.assessments, assessment.id, whatIfScore)
  const passThreshold = 50

  return (
    <div className='screen'>

      {/* Header */}
      <div className='app-header'>
        <button className='back-btn' onClick={onBack}>← Back</button>
        <span className='app-sync-label'>{unit.code}</span>
      </div>

      {/* Breadcrumb */}
      <div className='breadcrumb'>
        <span>{unit.code}</span>
        <span className='breadcrumb-sep'>›</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 11 }}>
          {assessment.name.length > 40 ? assessment.name.slice(0, 40) + '...' : assessment.name}
        </span>
      </div>

      {/* Key info grid */}
      <div className='info-grid'>
        <div className='info-card'>
          <div className='info-value'>{assessment.pointsPossible}pts</div>
          <div className='info-label'>Worth</div>
        </div>
        <div className='info-card'>
          <div className={`info-value info-value--${getUrgencyColor(assessment.daysUntilDue)}`}>
            {getUrgencyLabel(assessment.daysUntilDue)}
          </div>
          <div className='info-label'>Due</div>
        </div>
        <div className='info-card'>
          <div className='info-value'>
            {grade !== null ? `${grade}%` : '—'}
          </div>
          <div className='info-label'>Current grade</div>
        </div>
        <div className='info-card'>
          <div className='info-value'>
            {assessment.submission?.status === 'graded'
              ? `${assessment.submission.score ?? '—'}pts`
              : assessment.submission?.status === 'submitted'
                ? 'Submitted'
                : 'Not submitted'
            }
          </div>
          <div className='info-label'>Your submission</div>
        </div>
      </div>

      {/* Due date + late/missing tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Due {assessment.dueDateFormatted}
        </span>
        {assessment.submission?.late && (
          <span className='meta-tag meta-tag--late'>Late</span>
        )}
        {assessment.submission?.missing && (
          <span className='meta-tag meta-tag--missing'>Missing</span>
        )}
      </div>

      <div className='divider' />

      {/* Rubric section */}
      <section>
        <h3 className='section-heading'>What markers want</h3>

        {assessment.aiRubricSummary ? (
          // ✅ AI decoded — shown after enrichment
          <div>
            <span className='ai-badge'>AI decoded</span>
            <ul className='ai-summary-list'>
              {assessment.aiRubricSummary.map((point, i) => (
                <li key={i} className='ai-summary-item'>{point}</li>
              ))}
            </ul>
          </div>
        ) : assessment.hasRubric ? (
          // Raw rubric — shown before AI runs
          <RawRubric rubric={assessment.rubric} />
        ) : (
          // No rubric — show description
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {assessment.description || 'No rubric or description available.'}
          </p>
        )}
      </section>

      <div className='divider' />

      {/* Relevant materials section */}
      <section>
        <h3 className='section-heading'>Relevant materials</h3>

        <RelevantMaterials
          modules={unit.modules}
          assessmentName={assessment.name}
        />
      </section>

      <div className='divider' />

      {/* Grade what-if calculator */}
      <section>
        <h3 className='section-heading'>Grade what-if</h3>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          If I score {whatIfScore}% on this assessment
        </div>

        <input
          type='range'
          min={0}
          max={100}
          step={1}
          value={whatIfScore}
          onChange={e => setWhatIfScore(Number(e.target.value))}
          className='grade-slider'
        />

        <div className='slider-labels'>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>

        <div className='calculator-results'>
          <div className='calculator-result-row'>
            <span className='result-label'>Current overall</span>
            <span className='result-value'>
              {grade !== null ? `${grade}%` : '—'}
            </span>
          </div>
          <div className='calculator-result-row'>
            <span className='result-label'>Projected overall</span>
            <span className={`result-value result-value--${projected >= passThreshold ? 'pass' : 'fail'}`}>
              {projected !== null ? `${projected}%` : '—'}
            </span>
          </div>
          <div className='calculator-result-row'>
            <span className='result-label'>To pass this unit</span>
            <span className='result-value'>Need 50%+</span>
          </div>
        </div>

        {projected !== null && (
          <p className={`calculator-message calculator-message--${projected >= passThreshold ? 'pass' : 'fail'}`}>
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
      </section>

    </div>
  )
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function RawRubric({ rubric }) {
  return (
    <div className='raw-rubric'>
      {rubric.map(criterion => (
        <div key={criterion.id} className='rubric-criterion'>
          <div className='rubric-criterion-header'>
            <span className='rubric-criterion-name'>{criterion.description}</span>
            <span className='rubric-criterion-points'>{criterion.points}pts</span>
          </div>
          {criterion.longDescription && (
            <p className='rubric-criterion-desc'>{criterion.longDescription}</p>
          )}
          <div className='rubric-ratings'>
            {criterion.ratings.map(rating => (
              <div key={rating.id} className='rubric-rating'>
                <div className='rubric-rating-header'>
                  <span className='rubric-rating-label'>{rating.description}</span>
                  <span className='rubric-rating-points'>{rating.points}pts</span>
                </div>
                {rating.longDescription && (
                  <p className='rubric-rating-desc'>{rating.longDescription}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RelevantMaterials({ modules, assessmentName }) {
  // Find modules AI flagged as relevant to this assessment
  const relevant = modules.filter(
    m => m.relevantAssessments?.includes(assessmentName)
  )

  if (relevant.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {relevant.map(module => (
          <div key={module.id} style={{
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Week {module.weekNumber}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
              {module.topic}
            </div>
            {module.aiSummary && (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {module.aiSummary}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Fallback — show all modules before AI flags them
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Check which weeks are relevant to this assessment:
      </p>
      {modules.map(module => (
        <div key={module.id} style={{
          display: 'flex',
          gap: 10,
          padding: '7px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 48 }}>
            Wk {module.weekNumber}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            {module.topic}
          </span>
        </div>
      ))}
    </div>
  )
}