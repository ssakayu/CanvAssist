import { useState, useEffect } from 'react'
import { getUnit } from '../../lib/storage.js'
import { projectGrade, calculateCurrentGrade } from '../../lib/utils.js'

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

  return (
    <div>
      {/* ── Assessment fields ── */}
      <section style={{ marginBottom: 10 }}>
        <strong>ASSESSMENT</strong>
        <pre>
{`id           : ${assessment.id}
name         : ${assessment.name}
dueAt        : ${assessment.dueAt ?? '—'}
daysUntilDue : ${assessment.daysUntilDue ?? '—'}
points       : ${assessment.pointsPossible}
urgencyScore : ${assessment.urgencyScore ?? '—'}
gradingType  : ${assessment.gradingType}
htmlUrl      : ${assessment.htmlUrl ?? '—'}
sub.status   : ${assessment.submission?.status ?? '—'}
sub.score    : ${assessment.submission?.score ?? '—'}
sub.late     : ${assessment.submission?.late ?? false}
sub.missing  : ${assessment.submission?.missing ?? false}
sub.attempt  : ${assessment.submission?.attempt ?? '—'}
sub.submitted: ${assessment.submission?.submittedAt ?? '—'}
sub.graded   : ${assessment.submission?.gradedAt ?? '—'}`}
        </pre>
        {assessment.description && (
          <>
            <strong>description:</strong>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{assessment.description}</p>
          </>
        )}
      </section>

      {/* ── Grade context ── */}
      <section style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginBottom: 10 }}>
        <strong>GRADE CONTEXT</strong>
        <pre>
{`unit currentGrade : ${grade ?? '—'}%
unit code         : ${unit.code}`}
        </pre>
      </section>

      {/* ── Rubric (raw) ── */}
      <section style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginBottom: 10 }}>
        <strong>RUBRIC (raw) — hasRubric: {String(assessment.hasRubric)}</strong>
        {assessment.hasRubric ? (
          assessment.rubric.map(c => (
            <div key={c.id} style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #999' }}>
              <pre>
{`criterion : ${c.description}
points    : ${c.points}
longDesc  : ${c.longDescription || '—'}`}
              </pre>
              {c.ratings.map(r => (
                <pre key={r.id} style={{ marginLeft: 8 }}>
{`  rating: ${r.description} (${r.points}pts)
  desc  : ${r.longDescription || '—'}`}
                </pre>
              ))}
            </div>
          ))
        ) : (
          <p>No rubric</p>
        )}
      </section>

      {/* ── AI rubric summary ── */}
      <section style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginBottom: 10 }}>
        <strong>AI RUBRIC SUMMARY — {assessment.aiRubricSummary ? `${assessment.aiRubricSummary.length} bullets` : 'not generated'}</strong>
        {assessment.aiRubricSummary ? (
          <ol style={{ paddingLeft: 16, marginTop: 4 }}>
            {assessment.aiRubricSummary.map((b, i) => <li key={i}>{b}</li>)}
          </ol>
        ) : (
          <p>—</p>
        )}
      </section>

      {/* ── Relevant modules ── */}
      <section style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginBottom: 10 }}>
        <strong>RELEVANT MODULES — {assessment.relevantModules?.length ? assessment.relevantModules.length : 'none'}</strong>
        {assessment.relevantModules?.length > 0 ? (
          <ul style={{ paddingLeft: 16, marginTop: 4 }}>
            {assessment.relevantModules.map(m => (
              <li key={m.weekNumber}>Week {m.weekNumber}: {m.topic}</li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </section>

      {/* ── Grade what-if ── */}
      <section style={{ borderTop: '1px solid #ccc', paddingTop: 8 }}>
        <strong>GRADE WHAT-IF</strong>
        <div style={{ marginTop: 4 }}>
          <label>
            if I score {whatIfScore}% on this:
            <input
              type='range' min={0} max={100} step={1}
              value={whatIfScore}
              onChange={e => setWhatIfScore(Number(e.target.value))}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
        <pre>
{`currentGrade  : ${grade ?? '—'}%
projectedGrade: ${projected ?? '—'}%
pass threshold: 50%
result        : ${projected === null ? '—' : projected >= 50 ? 'PASS' : 'FAIL'}`}
        </pre>
      </section>
    </div>
  )
}
