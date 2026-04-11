const COURSE_CODE_REGEX = /\b[A-Z]{2,4}\d{2,4}\b/
const CANVAS_BASE_URL = 'https://canvas.qut.edu.au'

const clean = (value = '') => value.replace(/\s+/g, ' ').trim()

function isCanvasPage() {
  const isQutCanvas = location.hostname === 'canvas.qut.edu.au'
  const isAllowedPath = location.pathname === '/' || location.pathname.startsWith('/courses')
  return isQutCanvas && isAllowedPath
}

function extractUnitCode(courseObj) {
  // Handle both string and object input for backwards compatibility
  if (typeof courseObj === 'string') {
    const match = courseObj.match(COURSE_CODE_REGEX)
    return match?.[0] ?? 'Unnamed'
  }
  
  // First try course_code field if it exists
  if (courseObj.course_code) {
    const match = courseObj.course_code.match(COURSE_CODE_REGEX)
    if (match) return match[0]
  }
  // Then try extracting from name
  const nameMatch = courseObj.name?.match(COURSE_CODE_REGEX)
  if (nameMatch) return nameMatch[0]
  // Fallback: use first part of name before dash or space
  const parts = clean(courseObj.name || '').split(/[\s\-–—]/)[0]
  return parts || 'Unnamed'
}

function inferAssessmentStatus(daysLeft) {
  if (daysLeft == null) return 'Upcoming'
  if (daysLeft < 0) return 'Overdue'
  if (daysLeft <= 3) return 'Due soon'
  if (daysLeft <= 10) return 'Upcoming'
  return 'On track'
}

function toDaysLeft(dueAt) {
  if (!dueAt) return null
  const millis = new Date(dueAt).getTime() - Date.now()
  return Math.ceil(millis / (1000 * 60 * 60 * 24))
}

function formatDueText(dueAt) {
  if (!dueAt) return 'No due date'
  return new Date(dueAt).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

async function fetchCanvasJson(path) {
  const url = path.startsWith('http') ? path : `${CANVAS_BASE_URL}${path}`
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function mapCourse(course) {
  const unitCode = extractUnitCode(course)
  const currentGrade =
    course.enrollments?.find((enrollment) => typeof enrollment.computed_current_score === 'number')
      ?.computed_current_score ?? null

  return {
    id: String(course.id),
    code: unitCode,
    name: clean(course.name || course.course_code || unitCode),
    currentGrade: currentGrade != null ? Math.round(currentGrade) : null,
    passMark: 50,
  }
}

async function fetchAssignmentsForCourse(course) {
  try {
    const submissions = await fetchCanvasJson(
      `/api/v1/courses/${course.id}/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`,
    )

    return submissions
      .filter((submission) => submission?.assignment?.name)
      .map((submission) => {
        const assignment = submission.assignment
        const dueAt = assignment?.due_at || null
        const daysLeft = toDaysLeft(dueAt)
        return {
          id: `a-${assignment.id}`,
          unitCode: course.code,
          unitName: course.name,
          title: clean(assignment.name),
          dueText: formatDueText(dueAt),
          dueAt,
          score: submission.score,
          possible: assignment?.points_possible,
          weight: typeof assignment.points_possible === 'number' ? Math.round(assignment.points_possible) : null,
          status: inferAssessmentStatus(daysLeft),
          graded: submission.score !== null,
          workflow_state: submission.workflow_state,
          daysLeft,
        }
      })
  } catch {
    return []
  }
}

async function fetchMaterialsForCourse(course) {
  try {
    const modules = await fetchCanvasJson(`/api/v1/courses/${course.id}/modules?include[]=items&per_page=20`)
    return modules.flatMap((module, moduleIndex) => {
      const items = Array.isArray(module.items) ? module.items : []
      return items
        .filter((item) => item?.title)
        .map((item, itemIndex) => ({
          id: `m-${module.id}-${item.id ?? itemIndex}`,
          unitCode: course.code,
          week: `Wk ${module.position ?? moduleIndex + 1}`,
          title: clean(item.title),
          description: clean(module.name || 'Canvas module material'),
          covered: module.state === 'completed',
          url: item.html_url || module.html_url || '#',
        }))
    })
  } catch {
    return []
  }
}

function parseDomAssessments() {
  const cards = Array.from(document.querySelectorAll('a, li, tr, div'))
  return cards
    .map((el, index) => {
      const text = clean(el.textContent || '')
      if (!text || !/assignment|quiz|exam|project|due/i.test(text)) return null

      const title = clean(el.querySelector('a, strong, h3, h4')?.textContent || text.split('Due')[0]).slice(0, 90)
      if (!title) return null

      const dueTextMatch = text.match(/due[^\n\r]*/i)
      const dueText = clean(dueTextMatch?.[0] || 'No due date')
      const unitCode = extractUnitCode(text)

      return {
        id: `dom-a-${index}`,
        unitCode,
        unitName: unitCode,
        title,
        dueText,
        dueAt: null,
        weight: null,
        status: 'Upcoming',
        daysLeft: null,
      }
    })
    .filter(Boolean)
    .slice(0, 40)
}

function parseDomResources() {
  const links = Array.from(document.querySelectorAll('a[href]'))
  return links
    .map((link, index) => {
      const text = clean(link.textContent || '')
      if (!text || !/module|week|lecture|tutorial|reading|resource/i.test(text)) return null

      const context = clean(link.closest('li, tr, div, section')?.textContent || '')
      const unitCode = extractUnitCode(context)

      return {
        id: `dom-r-${index}`,
        unitCode,
        week: 'Wk ?',
        title: text.slice(0, 90),
        description: context.slice(0, 120) || 'Canvas learning material',
        covered: /complete|done|covered/i.test(context),
        url: link.href,
      }
    })
    .filter(Boolean)
    .slice(0, 60)
}

function buildUnitsFromDom(assessments, resources) {
  const map = new Map()
  for (const item of [...assessments, ...resources]) {
    const code = item.unitCode || 'Unknown'
    if (!map.has(code)) {
      map.set(code, {
        id: code,
        code,
        name: code,
        currentGrade: null,
        passMark: 50,
      })
    }
  }
  return [...map.values()]
}

export async function buildStudyLensSnapshot() {
  if (!isCanvasPage()) {
    throw new Error('Open https://canvas.qut.edu.au/ or https://canvas.qut.edu.au/courses then sync again.')
  }

  try {
    const coursesRaw = await fetchCanvasJson('/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=100')
    let preferredCourses = coursesRaw

    try {
      const favoriteCourses = await fetchCanvasJson('/api/v1/users/self/favorites/courses?per_page=100')
      const favoriteIds = new Set((favoriteCourses || []).map((course) => String(course.id)))
      if (favoriteIds.size) {
        const favoriteOnly = coursesRaw.filter((course) => favoriteIds.has(String(course.id)))
        if (favoriteOnly.length) preferredCourses = favoriteOnly
      }
    } catch {
      // Keep using active courses when favorites endpoint is unavailable.
    }

    const courses = preferredCourses.map(mapCourse)

    const assignmentGroups = await Promise.all(courses.map((course) => fetchAssignmentsForCourse(course)))
    const materialGroups = await Promise.all(courses.map((course) => fetchMaterialsForCourse(course)))

    const assessments = assignmentGroups.flat()
    const resources = materialGroups.flat()

    if (courses.length || assessments.length || resources.length) {
      return {
        sourceUrl: location.href,
        syncedAt: new Date().toISOString(),
        units: courses,
        assessments,
        resources,
      }
    }
  } catch {
    // Fallback below when API is blocked or empty.
  }

  const domAssessments = parseDomAssessments()
  const domResources = parseDomResources()

  return {
    sourceUrl: location.href,
    syncedAt: new Date().toISOString(),
    units: buildUnitsFromDom(domAssessments, domResources),
    assessments: domAssessments,
    resources: domResources,
  }
}