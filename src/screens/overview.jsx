// screens/Overview.jsx
// First screen the student sees when opening CanvAssist
// Shows stats summary + list of current units
// Clicking a unit navigates to UnitView

import { useState, useEffect } from 'react'
import { getUnits, getLastSync } from '../lib/storage.js'
import { getRankedAssessments, getUnitStatus, getStatusLabel, formatLastSync, calculateCurrentGrade } from '../lib/utils.js'

export default function Overview({ onSelectUnit }) {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()

    // Listen for sync updates from background.js
    const handleMessage = (msg) => {
      if (msg.type === 'SYNC_COMPLETE') loadData()
      if (msg.type === 'SYNC_ERROR') setError(msg.error)
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  async function loadData() {
    try {
      const [storedUnits, sync] = await Promise.all([
        getUnits(),
        getLastSync(),
      ])
      setUnits(storedUnits)
      setLastSync(sync)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSync() {
    setLoading(true)
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={handleSync} />
  if (units.length === 0) return <EmptyState onSync={handleSync} />

  // Stats for the top summary
  const allAssessments = getRankedAssessments(units)
  const dueThisWeek = allAssessments.filter(a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7)
  const mostUrgent = allAssessments[0] ?? null

  return (
    <div className='overview'>

      {/* Header */}
      <div className='overview-header'>
        <span className='overview-title'>CanvAssist</span>
        <span className='overview-sync'>{formatLastSync(lastSync)}</span>
      </div>

      {/* Stats summary */}
      <div className='stats-row'>
        <div className='stat-card'>
          <div className='stat-number'>{dueThisWeek.length}</div>
          <div className='stat-label'>Due this week</div>
        </div>
        <div className='stat-card'>
          <div className='stat-number'>{units.length}</div>
          <div className='stat-label'>Active units</div>
        </div>
        <div className='stat-card'>
          <div className='stat-number'>
            {mostUrgent ? `${mostUrgent.daysUntilDue}d` : '—'}
          </div>
          <div className='stat-label'>Most urgent</div>
        </div>
      </div>

      {/* Most urgent assessment callout */}
      {mostUrgent && (
        <div className='urgent-callout'>
          <span className='urgent-label'>Most urgent</span>
          <span className='urgent-name'>{mostUrgent.name}</span>
          <span className='urgent-meta'>
            {mostUrgent.unitCode} · Due {mostUrgent.dueDateFormatted} · {mostUrgent.pointsPossible}pts
          </span>
        </div>
      )}

      {/* Unit list */}
      <div className='section-label'>Your units</div>
      <div className='unit-list'>
        {units.map(unit => (
          <UnitCard
            key={unit.id}
            unit={unit}
            onClick={() => onSelectUnit(unit)}
          />
        ))}
      </div>

      {/* Manual sync button */}
      <button className='sync-btn' onClick={handleSync}>
        Sync Canvas data
      </button>

    </div>
  )
}

// ─── UNIT CARD ────────────────────────────────────────────────────────────────

function UnitCard({ unit, onClick }) {
  const grade = unit.currentGrade ?? calculateCurrentGrade(unit.assessments)
  const status = getUnitStatus(grade)
  const statusLabel = getStatusLabel(status)

  const upcomingCount = unit.assessments.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 14
  ).length

  return (
    <div className='unit-card' onClick={onClick}>
      <div className='unit-card-top'>
        <div className='unit-card-left'>
          <span className='unit-code'>{unit.code}</span>
          <span className='unit-name'>{unit.friendlyName}</span>
        </div>
        <span className={`unit-status unit-status--${status}`}>
          {statusLabel}
        </span>
      </div>

      <div className='unit-card-bottom'>
        <span className='unit-grade'>
          {grade !== null ? `${grade}%` : 'No grades yet'}
        </span>
        {upcomingCount > 0 && (
          <span className='unit-upcoming'>
            {upcomingCount} due soon
          </span>
        )}
      </div>
    </div>
  )
}

// ─── STATES ───────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className='state-container'>
      <p className='state-text'>Syncing Canvas data...</p>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div className='state-container'>
      <p className='state-text'>Could not load Canvas data.</p>
      <p className='state-subtext'>Make sure you are logged into Canvas.</p>
      <button onClick={onRetry}>Try again</button>
    </div>
  )
}

function EmptyState({ onSync }) {
  return (
    <div className='state-container'>
      <p className='state-text'>No data yet.</p>
      <p className='state-subtext'>Open Canvas in a tab and sync.</p>
      <button onClick={onSync}>Sync now</button>
    </div>
  )
}