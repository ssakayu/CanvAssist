// screens/Overview.jsx
import { useState, useEffect } from 'react'
import { getUnits, getLastSync } from '../lib/storage.js'
import { getRankedAssessments, getUnitStatus, getStatusLabel, formatLastSync, calculateCurrentGrade } from '../lib/utils.js'

export default function Overview({ onSelectUnit }) {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadData()

    const handleMessage = (msg) => {
      if (msg.type === 'SYNC_COMPLETE') loadData()
      if (msg.type === 'AI_UNIT_COMPLETE') loadData()
      if (msg.type === 'AI_COMPLETE') loadData()
      if (msg.type === 'SYNC_ERROR') {
        setError(msg.error)
        setSyncing(false)
        setLoading(false)
      }
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
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  function handleSync() {
    setSyncing(true)
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }

  if (loading) return (
    <div className='state-container'>
      <p className='state-text'>Loading your Canvas data...</p>
    </div>
  )

  if (error) return (
    <div className='state-container'>
      <p className='state-text'>Could not load Canvas data</p>
      <p className='state-subtext'>Make sure you are logged into Canvas</p>
      <button onClick={handleSync}>Try again</button>
    </div>
  )

  if (units.length === 0) return (
    <div className='state-container'>
      <p className='state-text'>No data yet</p>
      <p className='state-subtext'>Open Canvas and click sync</p>
      <button className='sync-btn' onClick={handleSync}>Sync now</button>
    </div>
  )

  const allAssessments = getRankedAssessments(units)
  const dueThisWeek = allAssessments.filter(
    a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 7
  )
  const mostUrgent = allAssessments[0] ?? null

  return (
    <div className='screen'>
      <div className='app-header'>
        <div className='app-logo'>
          <div className='app-logo-dot' />
          CanvAssist
        </div>
        <span className='app-sync-label'>
          {syncing ? 'Syncing...' : formatLastSync(lastSync)}
        </span>
      </div>

      <div className='stats-row'>
        <div className='stat-card'>
          <div className={`stat-number ${dueThisWeek.length > 2 ? 'stat-number--red' : 'stat-number--amber'}`}>
            {dueThisWeek.length}
          </div>
          <div className='stat-label'>Due this week</div>
        </div>
        <div className='stat-card'>
          <div className='stat-number'>
            {mostUrgent?.daysUntilDue !== null ? `${mostUrgent?.daysUntilDue}d` : '—'}
          </div>
          <div className='stat-label'>Most urgent</div>
        </div>
        <div className='stat-card'>
          <div className='stat-number'>{units.length}</div>
          <div className='stat-label'>Units</div>
        </div>
      </div>

      {mostUrgent && (
        <div className='urgent-callout'>
          <span className='urgent-callout-label'>Most urgent</span>
          <span className='urgent-callout-name'>{mostUrgent.name}</span>
          <span className='urgent-callout-meta'>
            {mostUrgent.unitCode} · Due {mostUrgent.dueDateFormatted} · {mostUrgent.pointsPossible}pts
          </span>
        </div>
      )}

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

      <button className='sync-btn' onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Canvas data'}
      </button>
    </div>
  )
}

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
        <span className={`chip chip--${status}`}>{statusLabel}</span>
      </div>
      <div className='progress-bar'>
        <div className='progress-fill' style={{ width: `${grade ?? 0}%` }} />
      </div>
      <div className='unit-card-bottom'>
        <span className='unit-grade'>
          {grade !== null ? `${grade}% current` : 'No grades yet'}
        </span>
        {upcomingCount > 0 && (
          <span className='unit-upcoming'>{upcomingCount} due soon</span>
        )}
      </div>
    </div>
  )
}