// api/getAssignments.js
// Takes a courseId from getActiveCourses() and returns all assessments for that unit
// Includes submission status and rubric data in one call

import { canvasFetchAll } from './canvasClient.js'

export default async function getAssignments(courseId) {
  const assignments = await canvasFetchAll(
    `/courses/${courseId}/assignments?include[]=submission&order_by=due_at`
  )

  if (!assignments) return []

  return assignments
    .filter(a => isRelevantAssignment(a))
    .map(a => cleanAssignment(a))
}

// Filter out assignments that aren't relevant to the student
function isRelevantAssignment(a) {
  return (
    a.published &&                    // must be published
    !a.omit_from_final_grade &&       // must count toward grade
    a.points_possible > 0             // must be worth something
  )
}

// Transforms raw Canvas assignment into clean app shape
function cleanAssignment(a) {
  return {
    id: a.id,
    name: a.name,
    description: stripHtml(a.description || ''),
    dueAt: a.due_at,
    dueDateFormatted: formatDueDate(a.due_at),
    daysUntilDue: getDaysUntilDue(a.due_at),
    pointsPossible: a.points_possible,
    gradingType: a.grading_type,
    htmlUrl: a.html_url,

    // Submission info
    submission: cleanSubmission(a.submission),

    // Rubric — array of criteria, empty if no rubric set
    rubric: cleanRubric(a.rubric || []),
    hasRubric: Array.isArray(a.rubric) && a.rubric.length > 0,

    // Computed fields used by utils.js for urgency scoring
    urgencyScore: 0,          // calculated later by utils.js
    aiRubricSummary: null,    // filled later by ai.js
    relevantModules: [],      // filled later by ai.js
  }
}

// Cleans submission object — handles null (not submitted yet)
function cleanSubmission(submission) {
  if (!submission) {
    return {
      status: 'unsubmitted',
      score: null,
      submittedAt: null,
      gradedAt: null,
      late: false,
      missing: false,
      attempt: null,
    }
  }

  return {
    status: submission.workflow_state || 'unsubmitted',
    // workflow_state values:
    // 'submitted'      → student submitted, not graded yet
    // 'graded'         → marked, score available
    // 'unsubmitted'    → nothing submitted
    // 'pending_review' → submitted, waiting for review

    score: submission.score ?? null,
    submittedAt: submission.submitted_at || null,
    gradedAt: submission.graded_at || null,
    late: submission.late || false,
    missing: submission.missing || false,
    attempt: submission.attempt || null,
  }
}

// Cleans rubric criteria array
// Each criterion has a description, max points, and rating levels
function cleanRubric(rubric) {
  if (!rubric || rubric.length === 0) return []

  return rubric.map(criterion => ({
    id: criterion.id,
    description: criterion.description || '',
    longDescription: criterion.long_description || '',
    points: criterion.points || 0,

    // Rating levels from highest to lowest
    // e.g. High Distinction → Distinction → Credit → Pass → Fail
    ratings: (criterion.ratings || []).map(r => ({
      id: r.id,
      description: r.description || '',
      longDescription: r.long_description || '',
      points: r.points || 0,
    })),
  }))
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Strips HTML tags from Canvas assignment descriptions
// Canvas stores descriptions as raw HTML so this is always needed
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// Formats due date into readable string
// '2026-04-11T13:59:59Z' → 'Fri 11 Apr'
function formatDueDate(dueAt) {
  if (!dueAt) return 'No due date'
  return new Date(dueAt).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Returns number of days until due date
// Negative means overdue
function getDaysUntilDue(dueAt) {
  if (!dueAt) return null
  const now = new Date()
  const due = new Date(dueAt)
  const diffMs = due - now
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}