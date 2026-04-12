import { useState, useEffect } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { getUnit, getCompletedModules, toggleModuleCompleted } from '../../lib/storage.js'
import { calculateCurrentGrade, calculateRequiredScore } from '../../lib/utils.js'

export default function Unit({ unitId, unit: initialUnit }) {
  const { setView } = useGlobal()
  const [unit, setUnit] = useState(initialUnit ?? null)
  const [completedModules, setCompletedModules] = useState({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [fresh, completed] = await Promise.all([getUnit(unitId), getCompletedModules()])
      if (!cancelled) {
        if (fresh) setUnit(fresh)
        setCompletedModules(completed)
      }
    }
    load()
    const handleMessage = (msg) => {
      if (['AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) load()
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => { cancelled = true; chrome.runtime.onMessage.removeListener(handleMessage) }
  }, [unitId])

  if (!unit) return <p>Loading...</p>

  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const neededToPass = calculateRequiredScore(unit.assessments, 50)
  const sortedAssessments = [...(unit.assessments ?? [])].sort((a, b) => {
    if (!a.dueAt) return 1
    if (!b.dueAt) return -1
    return new Date(a.dueAt) - new Date(b.dueAt)
  })

  return (
    <div>
      {/* ── Unit header ── */}
      <section style={{ marginBottom: 10 }}>
        <strong>UNIT</strong>
        <pre>
{`id           : ${unit.id}
code         : ${unit.code}
name         : ${unit.friendlyName}
currentGrade : ${grade ?? '—'}%
neededToPass : ${neededToPass ?? '—'}%
aiLinked     : ${unit.relevantModulesLinked ?? false}`}
        </pre>
      </section>

      {/* ── Assessments ── */}
      <section style={{ marginBottom: 10 }}>
        <strong>ASSESSMENTS ({sortedAssessments.length})</strong>
        {sortedAssessments.map(a => (
          <div key={a.id} style={{ border: '1px solid #ccc', padding: 6, marginTop: 6 }}>
            <pre>
{`id           : ${a.id}
name         : ${a.name}
dueAt        : ${a.dueAt ?? '—'}
daysUntilDue : ${a.daysUntilDue ?? '—'}
points       : ${a.pointsPossible}
urgencyScore : ${a.urgencyScore ?? '—'}
gradingType  : ${a.gradingType}
hasRubric    : ${a.hasRubric}
aiRubric     : ${a.aiRubricSummary ? `yes (${a.aiRubricSummary.length} bullets)` : 'no'}
relModules   : ${a.relevantModules?.length ? a.relevantModules.map(m => `W${m.weekNumber}`).join(', ') : 'none'}
sub.status   : ${a.submission?.status ?? '—'}
sub.score    : ${a.submission?.score ?? '—'}
sub.late     : ${a.submission?.late ?? false}
sub.missing  : ${a.submission?.missing ?? false}
sub.attempt  : ${a.submission?.attempt ?? '—'}
description  : ${a.description ? a.description.slice(0, 120) + (a.description.length > 120 ? '…' : '') : '—'}`}
            </pre>
            <button onClick={() => setView({ page: 'assessment', params: { assessment: a, unit } })}>
              → open detail
            </button>
          </div>
        ))}
      </section>

      {/* ── Modules ── */}
      <section>
        <strong>MODULES ({unit.modules?.length ?? 0})</strong>
        {(unit.modules ?? []).map(m => (
          <div key={m.id} style={{ border: '1px solid #ccc', padding: 6, marginTop: 6 }}>
            <pre>
{`id                  : ${m.id}
weekNumber          : ${m.weekNumber}
topic               : ${m.topic}
fullName            : ${m.fullName}
itemCount           : ${m.itemCount}
completed           : ${completedModules[m.id] ?? false}
aiSummary           : ${m.aiSummary ?? '—'}
relevantAssessments : ${m.relevantAssessments?.length ? m.relevantAssessments.join(', ') : 'none'}`}
            </pre>
            <details>
              <summary>items ({m.items?.length ?? 0})</summary>
              {(m.items ?? []).map(i => (
                <pre key={i.id} style={{ marginLeft: 8 }}>
{`  [${i.itemType}] ${i.title}`}
                </pre>
              ))}
            </details>
            <button onClick={async () => {
              const newState = await toggleModuleCompleted(m.id)
              setCompletedModules(prev => ({ ...prev, [m.id]: newState }))
            }}>
              toggle completed
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
