
// api/getActiveCourses.js
// Step 1 of the data flow — gets all real semester units
// Returns courseId which is used by every other API call
import { canvasFetch } from './canvasClient.js'

export default async function getActiveCourses() {
  const courses = await canvasFetch(
    '/courses?enrollment_state=active&per_page=10&include[]=total_scores'
  )

  if (!courses) return []

  return courses
    .filter(c => isRealUnit(c))
    .map(c => cleanCourse(c))
}

// QUT semester units always follow the pattern: CAB302_26se1
// The _26se1 suffix means year 26, semester 1
function isRealUnit(course) {
  return /_\d{2}se\d/.test(course.course_code || '')
}

function cleanCourse(c) {
  return {
    id: c.id,                                      // ← the key, used by all other calls
    code: extractCode(c.course_code),              // 'CAB302'
    fullName: c.name,                              // 'CAB302_26se1 Agile Software Engineering'
    friendlyName: extractFriendlyName(c.name),    // 'Agile Software Engineering'
    currentGrade: c.enrollments?.[0]?.computed_current_score ?? null,
    finalGrade: c.enrollments?.[0]?.computed_final_score ?? null,
    gradesHidden: c.hide_final_grades ?? false,
    startAt: c.start_at,
    endAt: c.end_at,
  }
}

// 'CAB302_26se1' → 'CAB302'
function extractCode(courseCode) {
  const match = courseCode.match(/([A-Z]{2,3}\d{3})/)
  return match ? match[1] : courseCode
}

// 'CAB302_26se1 Agile Software Engineering' → 'Agile Software Engineering'
function extractFriendlyName(fullName) {
  return fullName.replace(/^[A-Z]{2,3}\d{3}_\d{2}se\d\s*/, '').trim()

}