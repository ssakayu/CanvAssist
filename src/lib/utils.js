// lib/utils.js
// Utility functions used across the app
// No Canvas API calls here — pure data transformation and calculation

// ─── URGENCY SCORING ──────────────────────────────────────────────────────────
// Calculates how urgently a student should work on an assessment
// Higher score = more urgent
// Based on two factors:
//   1. How soon it's due (days left)
//   2. How much it's worth (points possible)

export function calculateUrgencyScore(assessment) {
  const daysLeft = assessment.daysUntilDue

  // Already submitted — no urgency
  if (assessment.submission?.status === 'graded') return 0
  if (assessment.submission?.status === 'submitted') return 0

  // No due date — can't calculate
  if (daysLeft === null) return 0

  // Overdue — highest urgency regardless of weight
  if (daysLeft < 0) return 1000

  // Urgency formula:
  // weight / days left — higher weight + fewer days = more urgent
  // e.g. 30% due in 2 days = 15 urgency
  // e.g. 10% due in 7 days = 1.4 urgency
  const weight = assessment.pointsPossible || 10
  const score = weight / Math.max(daysLeft, 0.5)

  return Math.round(score * 10) / 10
}

// Adds urgency scores to all assessments across all units
// Call this after fetching data, before saving to storage
export function addUrgencyScores(units) {
  return units.map(unit => ({
    ...unit,
    assessments: unit.assessments.map(assessment => ({
      ...assessment,
      urgencyScore: calculateUrgencyScore(assessment),
    }))
  }))
}

// Returns all assessments across all units sorted by urgency
// Used by Overview screen to show ranked list
export function getRankedAssessments(units) {
  const all = units.flatMap(unit =>
    unit.assessments.map(a => ({ ...a, unitCode: unit.code, unitId: unit.id }))
  )

  return all
    .filter(a => a.daysUntilDue === null || a.daysUntilDue > -7) // exclude very old
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
}

// ─── GRADE CALCULATION ────────────────────────────────────────────────────────
// Calculates current grade from individual assignment scores
// Used as fallback when Canvas hides the total grade

export function calculateCurrentGrade(assessments) {
  const graded = assessments.filter(
    a => a.submission?.score !== null && a.pointsPossible > 0
  )

  if (graded.length === 0) return null

  const earned = graded.reduce((sum, a) => sum + a.submission.score, 0)
  const possible = graded.reduce((sum, a) => sum + a.pointsPossible, 0)

  return Math.round((earned / possible) * 100)
}

// Calculates what score a student needs on remaining assessments to hit a target
// e.g. "I need 65% overall, I currently have 48% — what do I need on the remaining work?"
export function calculateRequiredScore(assessments, targetGrade) {
  const graded = assessments.filter(a => a.submission?.score !== null)
  const ungraded = assessments.filter(a => a.submission?.score === null && a.daysUntilDue > 0)

  if (ungraded.length === 0) return null

  const earnedPoints = graded.reduce((sum, a) => sum + (a.submission.score || 0), 0)
  const totalPoints = assessments.reduce((sum, a) => sum + a.pointsPossible, 0)
  const remainingPoints = ungraded.reduce((sum, a) => sum + a.pointsPossible, 0)

  const targetPoints = (targetGrade / 100) * totalPoints
  const neededPoints = targetPoints - earnedPoints

  if (neededPoints <= 0) return 0 // already achieved target
  if (remainingPoints <= 0) return null // no remaining work

  return Math.round((neededPoints / remainingPoints) * 100)
}

// Projected grade if student scores a given percentage on an assessment
// Used by the grade what-if calculator
export function projectGrade(assessments, assessmentId, hypotheticalScore) {
  const updated = assessments.map(a => {
    if (a.id !== assessmentId) return a
    return {
      ...a,
      submission: { ...a.submission, score: (hypotheticalScore / 100) * a.pointsPossible }
    }
  })

  return calculateCurrentGrade(updated)
}

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────

// Returns a status label for a unit based on current grade
// Used by Overview screen unit cards
export function getUnitStatus(currentGrade, passGrade = 50) {
  if (currentGrade === null) return 'unknown'
  if (currentGrade >= 85) return 'distinction'
  if (currentGrade >= passGrade + 10) return 'on_track'
  if (currentGrade >= passGrade) return 'borderline'
  return 'at_risk'
}

// Human readable label for unit status
export function getStatusLabel(status) {
  const labels = {
    distinction: 'Distinction',
    on_track: 'On track',
    borderline: 'Watch this',
    at_risk: 'At risk',
    unknown: 'No grades yet',
  }
  return labels[status] || 'Unknown'
}

// Returns urgency label based on days until due
export function getUrgencyLabel(daysUntilDue) {
  if (daysUntilDue === null) return 'No due date'
  if (daysUntilDue < 0) return 'Overdue'
  if (daysUntilDue === 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  if (daysUntilDue <= 3) return `Due in ${daysUntilDue} days`
  if (daysUntilDue <= 7) return `Due in ${daysUntilDue} days`
  return `Due in ${Math.ceil(daysUntilDue / 7)} weeks`
}

// Returns colour class based on urgency
export function getUrgencyColor(daysUntilDue) {
  if (daysUntilDue === null) return 'gray'
  if (daysUntilDue < 0) return 'red'
  if (daysUntilDue <= 2) return 'red'
  if (daysUntilDue <= 5) return 'amber'
  return 'green'
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

// Formats a timestamp into "Synced X minutes ago" style
export function formatLastSync(lastSync) {
  if (!lastSync) return 'Never synced'

  const diffMs = Date.now() - lastSync
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 1) return 'Synced just now'
  if (diffMins < 60) return `Synced ${diffMins}m ago`
  if (diffHours < 24) return `Synced ${diffHours}h ago`
  return 'Synced over a day ago'
}

// Returns number of days between two dates
export function daysBetween(date1, date2) {
  const diffMs = new Date(date2) - new Date(date1)
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}