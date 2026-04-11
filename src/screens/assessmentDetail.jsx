// screens/AssessmentDetail.jsx
// Third screen — shown when student taps an assessment from UnitView
// Shows everything about one assessment in one place:
//   - Key info (due date, points, status)
//   - Rubric decoded (AI summary if available, raw rubric if not)
//   - Relevant materials (AI flagged if available)
//   - Grade what-if calculator

import { useState } from 'react'
import { projectGrade, calculateCurrentGrade, getUrgencyLabel, getUrgencyColor } from '../lib/utils.js'

export default function AssessmentDetail({ assessment, unit, onBack }) {
  const [whatIfScore, setWhatIfScore] = useState(70)

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const projected = projectGrade(unit.assessments, assessment.id, whatIfScore)

  const { submission } = assessment
  const isGraded = submission?.status === 'graded'
  const isSubmitted = submission?.status === 'submitted'

  return (
    <div className='assessment-detail'>

      {/* Header */}
      <div className='assessment-detail-header'>
        <button className='back-btn' onClick={onBack}>← Back</button>
        <div className='breadcrumb'>
          <span>{unit.code}</span>
          <span className='breadcrumb-sep'>›</span>
          <span>{assessment.name}</span>
        </div>
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
            {isGraded
              ? `${submission.score}/${assessment.pointsPossible}`
              : isSubmitted
                ? 'Submitted'
                : 'Not submitted'
            }
          </div>
          <div className='info-label'>Your submission</div>
        </div>
      </div>

      {/* Due date + submission details */}
      <div className='assessment-meta'>
        <span>Due {assessment.dueDateFormatted}</span>
        {submission?.late && <span className='meta-tag meta-tag--late'>Late</span>}
        {submission?.missing && <span className='meta-tag meta-tag--missing'>Missing</span>}
      </div>

      <div className='divider' />

      {/* Rubric section */}
      <section className='detail-section'>
        <h3 className='section-heading'>What markers want</h3>

        {assessment.aiRubricSummary ? (
          // AI decoded version — shown once ai.js is integrated
          <AiRubricSummary summary={assessment.aiRubricSummary} />
        ) : assessment.hasRubric ? (
          // Raw rubric — shown before AI is integrated
          <RawRubric rubric={assessment.rubric} />
        ) : (
          // No rubric set by lecturer
          <NoRubric description={assessment.description} />
        )}
      </section>

      <div className='divider' />

      {/* Relevant materials section */}
      <section className='detail-section'>
        <h3 className='section-heading'>Relevant materials</h3>

        {assessment.relevantModules && assessment.relevantModules.length > 0 ? (
          // AI flagged relevant weeks — shown once ai.js is integrated
          <RelevantMaterials
            modules={assessment.relevantModules}
            allModules={unit.modules}
          />
        ) : (
          // Fallback — show all modules for this unit
          <AllModules modules={unit.modules} />
        )}
      </section>

      <div className='divider' />

      {/* Grade what-if calculator */}
      <section className='detail-section'>
        <h3 className='section-heading'>Grade what-if</h3>
        <GradeCalculator
          assessment={assessment}
          currentGrade={grade}
          projectedGrade={projected}
          whatIfScore={whatIfScore}
          onScoreChange={setWhatIfScore}
        />
      </section>

    </div>
  )
}

// ─── RUBRIC COMPONENTS ────────────────────────────────────────────────────────

// Shown after AI is integrated — plain language bullets
function AiRubricSummary({ summary }) {
  return (
    <div className='ai-summary'>
      <span className='ai-badge'>AI decoded</span>
      <ul className='ai-summary-list'>
        {summary.map((point, i) => (
          <li key={i} className='ai-summary-item'>{point}</li>
        ))}
      </ul>
    </div>
  )
}

// Shown before AI — raw rubric criteria with ratings
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

          {/* Rating levels — HD, D, C, P, F */}
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

// Shown when no rubric exists — just show the description
function NoRubric({ description }) {
  return (
    <div className='no-rubric'>
      {description ? (
        <p className='assessment-description'>{description}</p>
      ) : (
        <p className='no-rubric-text'>No rubric or description available for this assessment.</p>
      )}
    </div>
  )
}

// ─── MATERIALS COMPONENTS ─────────────────────────────────────────────────────

// Shown after AI flags relevant modules
function RelevantMaterials({ modules, allModules }) {
  const relevant = allModules.filter(m => modules.includes(m.id))

  return (
    <div className='relevant-materials'>
      {relevant.map(module => (
        <div key={module.id} className='relevant-module'>
          <span className='relevant-module-week'>Week {module.weekNumber}</span>
          <span className='relevant-module-topic'>{module.topic}</span>
          {module.aiSummary && (
            <p className='relevant-module-summary'>{module.aiSummary}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// Shown before AI — list all modules so student can find relevant ones themselves
function AllModules({ modules }) {
  if (!modules || modules.length === 0) {
    return <p className='no-materials'>No materials found for this unit.</p>
  }

  return (
    <div className='all-modules'>
      <p className='all-modules-hint'>
        Check which weeks are relevant to this assessment.
      </p>
      {modules.map(module => (
        <div key={module.id} className='module-row'>
          <span className='module-row-week'>Week {module.weekNumber}</span>
          <span className='module-row-topic'>{module.topic}</span>
        </div>
      ))}
    </div>
  )
}

// ─── GRADE CALCULATOR ─────────────────────────────────────────────────────────

function GradeCalculator({ assessment, currentGrade, projectedGrade, whatIfScore, onScoreChange }) {
  const passThreshold = 50

  return (
    <div className='grade-calculator'>

      <div className='calculator-row'>
        <span className='calculator-label'>
          If I score {whatIfScore}% on this assessment
        </span>
      </div>

      {/* Slider */}
      <input
        type='range'
        min={0}
        max={100}
        step={1}
        value={whatIfScore}
        onChange={e => onScoreChange(Number(e.target.value))}
        className='grade-slider'
      />

      <div className='slider-labels'>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      {/* Results */}
      <div className='calculator-results'>
        <div className='calculator-result-row'>
          <span className='result-label'>Current overall</span>
          <span className='result-value'>
            {currentGrade !== null ? `${currentGrade}%` : '—'}
          </span>
        </div>
        <div className='calculator-result-row'>
          <span className='result-label'>Projected overall</span>
          <span className={`result-value result-value--${projectedGrade >= passThreshold ? 'pass' : 'fail'}`}>
            {projectedGrade !== null ? `${projectedGrade}%` : '—'}
          </span>
        </div>
        <div className='calculator-result-row'>
          <span className='result-label'>To pass this unit</span>
          <span className='result-value'>Need 50%+</span>
        </div>
      </div>

      {/* Honest message */}
      {projectedGrade !== null && (
        <p className={`calculator-message ${projectedGrade >= passThreshold ? 'calculator-message--pass' : 'calculator-message--fail'}`}>
          {projectedGrade >= 85
            ? 'Looking great — on track for Distinction.'
            : projectedGrade >= 65
              ? 'On track — keep it up.'
              : projectedGrade >= passThreshold
                ? 'Passing but tight — worth putting in more effort.'
                : 'Below passing — you\'ll need to score higher to pass this unit.'
          }
        </p>
      )}

    </div>
  )
}