// api/getModules.js
// Takes a courseId from getActiveCourses() and returns weekly study materials
// Filters to only weekly content modules — skips overview, assessment, and resource modules
// Based on QUT Canvas structure where weekly modules are named "Week N - Topic Name"

import { canvasFetchAll } from './canvasClient.js'

export default async function getModules(courseId) {
  const modules = await canvasFetchAll(
    `/courses/${courseId}/modules?include[]=items`
  )

  if (!modules) return []

  return modules
    .filter(m => isWeeklyModule(m))
    .map(m => cleanModule(m))
    .sort((a, b) => a.weekNumber - b.weekNumber)
}

// Only keep modules that are actual weekly content
// QUT pattern: 'Week 1 - Topic Name', 'Week 2 - Topic Name' etc.
// Skips: Overview, About Assessments, Assessment 1, Additional Resources
function isWeeklyModule(module) {
  return /^Week\s+\d+/i.test(module.name || '')
}

function cleanModule(m) {
  const { weekNumber, topic } = parseModuleName(m.name)
  const items = (m.items || []).filter(i => isRelevantItem(i))

  return {
    id: m.id,
    weekNumber,
    topic,                          // 'Machine Learning Introduction and Linear Regression'
    fullName: m.name,               // 'Week 1 - Machine Learning Introduction...'
    items: items.map(i => cleanItem(i)),
    itemCount: items.length,
    completed: false,               // ticked by student, stored in chrome.storage
    aiSummary: null,                // filled later by ai.js
    relevantAssessments: [],        // filled later by ai.js
  }
}

// Extracts week number and topic from module name
// 'Week 1 - Machine Learning Introduction and Linear Regression'
// → { weekNumber: 1, topic: 'Machine Learning Introduction and Linear Regression' }
function parseModuleName(name) {
  const match = name.match(/^Week\s+(\d+)\s*[-–]?\s*(.*)$/i)
  if (match) {
    return {
      weekNumber: parseInt(match[1]),
      topic: match[2].trim() || `Week ${match[1]}`,
    }
  }
  return { weekNumber: 0, topic: name }
}

// Only keep the core study items — skip solutions and supplementary content
// Students need: Overview, Lecture content, Practical work
// Students don't need: Solutions (spoilers), Review (redundant), Additional Content
function isRelevantItem(item) {
  const title = item.title?.toLowerCase() || ''

  const skipPatterns = [
    'solution',       // Practical Solutions — spoilers
    'additional',     // Additional Content — supplementary
    'review',         // Week Review — redundant with overview
    'feedback',       // Give feedback — admin
    'safety',         // Safety modules — admin
    'career',         // Career help — admin
  ]

  return !skipPatterns.some(pattern => title.includes(pattern))
}

function cleanItem(item) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    // Classify the item so the UI can show the right icon
    // 'lecture' | 'practical' | 'overview' | 'other'
    itemType: classifyItem(item.title),
    htmlUrl: item.html_url || null,
    pageUrl: item.page_url || null,
  }
}

// Classifies item by title so UI can show appropriate label
// 'Week 1 - Pre-recorded Content' → 'lecture'
// 'Week 1 - Practical'           → 'practical'
// 'Week 1 - Overview'            → 'overview'
function classifyItem(title) {
  const t = title?.toLowerCase() || ''
  if (t.includes('pre-recorded') || t.includes('lecture') || t.includes('content')) return 'lecture'
  if (t.includes('practical') || t.includes('lab') || t.includes('tutorial')) return 'practical'
  if (t.includes('overview')) return 'overview'
  if (t.includes('code') || t.includes('example') || t.includes('activity')) return 'activity'
  return 'other'
}