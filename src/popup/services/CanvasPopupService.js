const MESSAGE_TYPES = {
  SCRAPE: 'STUDYLENS_SCRAPE',
}

export class CanvasPopupService {
  constructor(chromeApi) {
    this.chromeApi = chromeApi
  }

  isCanvasUrl(url = '') {
    try {
      const parsed = new URL(url)
      const isQutCanvas = parsed.hostname === 'canvas.qut.edu.au'
      const isAllowedPath = parsed.pathname === '/' || parsed.pathname.startsWith('/courses')
      return isQutCanvas && isAllowedPath
    } catch {
      return false
    }
  }

  async getActiveTab() {
    const tabs = await this.chromeApi.tabs.query({ active: true, currentWindow: true })
    return tabs[0]
  }

  async requestCanvasSnapshotFromPage(tabId) {
    const [{ result }] = await this.chromeApi.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const COURSE_CODE_REGEX = /\b[A-Z]{2,4}\d{2,4}\b/
        const clean = (value = '') => value.replace(/\s+/g, ' ').trim()

        const requestData = async (url) => {
          const res = await fetch(url, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`)
          }
          return res.json()
        }

        const buildAssessmentMeta = async (courseId) => {
          const groups = await requestData(`/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&per_page=100`)
          const assignments = await requestData(`/api/v1/courses/${courseId}/assignments?per_page=100`)
          const courseDetails = await requestData(`/api/v1/courses/${courseId}`)

          const overallWeightByAssignmentId = new Map()
          const groupWeightById = new Map()
          const groupPointsById = new Map()
          const assignmentCountByGroupId = new Map()
          const assignmentInfoById = new Map()

          for (const group of groups || []) {
            groupWeightById.set(String(group.id), typeof group?.group_weight === 'number' ? group.group_weight : null)
          }

          for (const assignment of assignments || []) {
            const assignmentId = String(assignment.id)
            const groupId = String(assignment.assignment_group_id)
            const pointsPossible = typeof assignment?.points_possible === 'number' ? assignment.points_possible : null

            assignmentInfoById.set(assignmentId, { groupId, pointsPossible })
            assignmentCountByGroupId.set(groupId, (assignmentCountByGroupId.get(groupId) ?? 0) + 1)

            if (pointsPossible != null && pointsPossible > 0) {
              groupPointsById.set(groupId, (groupPointsById.get(groupId) ?? 0) + pointsPossible)
            }
          }

          for (const [assignmentId, info] of assignmentInfoById.entries()) {
            const groupWeight = groupWeightById.get(info.groupId)
            const totalPoints = groupPointsById.get(info.groupId) ?? 0

            if (typeof groupWeight !== 'number') continue

            if (info.pointsPossible != null && info.pointsPossible > 0 && totalPoints > 0) {
              const overallWeight = (info.pointsPossible / totalPoints) * groupWeight
              overallWeightByAssignmentId.set(assignmentId, Math.round(overallWeight * 100) / 100)
              continue
            }

            if ((assignmentCountByGroupId.get(info.groupId) ?? 0) === 1) {
              overallWeightByAssignmentId.set(assignmentId, Math.round(groupWeight * 100) / 100)
            }
          }

          const canUseGroupWeights =
            courseDetails?.apply_assignment_group_weights === true ||
            Array.from(groupWeightById.values()).some((value) => typeof value === 'number' && value > 0)

          const buildPointsBasedWeights = () => {
            const map = new Map()
            const eligible = [...assignmentInfoById.entries()].filter(([, info]) => info.pointsPossible != null && info.pointsPossible > 0)
            const totalCoursePoints = eligible.reduce((sum, [, info]) => sum + info.pointsPossible, 0)
            if (totalCoursePoints <= 0) return map

            for (const [assignmentId, info] of eligible) {
              const overallWeight = (info.pointsPossible / totalCoursePoints) * 100
              map.set(assignmentId, Math.round(overallWeight * 100) / 100)
            }

            return map
          }

          if (!canUseGroupWeights) {
            const pointsMap = buildPointsBasedWeights()
            if (pointsMap.size) {
              overallWeightByAssignmentId.clear()
              for (const [key, value] of pointsMap.entries()) overallWeightByAssignmentId.set(key, value)
            }
          } else {
            const totalOverall = [...overallWeightByAssignmentId.values()].reduce((sum, value) => sum + value, 0)
            const isPlausibleTotal = totalOverall >= 95 && totalOverall <= 105
            if (!isPlausibleTotal) {
              const pointsMap = buildPointsBasedWeights()
              if (pointsMap.size) {
                overallWeightByAssignmentId.clear()
                for (const [key, value] of pointsMap.entries()) overallWeightByAssignmentId.set(key, value)
              }
            }
          }

          return {
            overallWeightByAssignmentId,
            groupWeightById,
            groupPointsById,
            assignmentInfoById,
          }
        }

        const extractCode = (courseObj) => {
          if (courseObj.course_code) {
            const match = courseObj.course_code.match(COURSE_CODE_REGEX)
            if (match) return match[0]
          }
          const nameMatch = courseObj.name?.match(COURSE_CODE_REGEX)
          if (nameMatch) return nameMatch[0]
          const parts = clean(courseObj.name || '').split(/[\s\-–—]/)[0]
          return parts || 'Unnamed'
        }

        const toDaysLeft = (dueAt) => {
          if (!dueAt) return null
          return Math.ceil((new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }

        const statusFor = (daysLeft) => {
          if (daysLeft == null) return 'Upcoming'
          if (daysLeft < 0) return 'Overdue'
          if (daysLeft <= 3) return 'Due soon'
          if (daysLeft <= 10) return 'Upcoming'
          return 'On track'
        }

        const coursesRaw = await requestData('/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=100')
        let preferredCourses = coursesRaw

        try {
          const favoriteCourses = await requestData('/api/v1/users/self/favorites/courses?per_page=100')
          const favoriteIds = new Set((favoriteCourses || []).map((course) => String(course.id)))
          if (favoriteIds.size) {
            const favoriteOnly = coursesRaw.filter((course) => favoriteIds.has(String(course.id)))
            if (favoriteOnly.length) preferredCourses = favoriteOnly
          }
        } catch {
          // Keep using active courses when favorites endpoint is unavailable.
        }

        const units = preferredCourses.map((course) => {
          const code = extractCode(course)
          const enrollment = course.enrollments?.[0]
          return {
            id: String(course.id),
            code,
            name: clean(course.name || course.course_code || code),
            currentGrade: enrollment?.computed_current_score != null ? Math.round(enrollment.computed_current_score) : null,
            passMark: 50,
            restrictQuantitativeData: course.restrict_quantitative_data || false,
            hideFinalGrades: course.hide_final_grades || false,
          }
        })

        const assessments = []
        const resources = []

        for (const unit of units) {
          try {
            const assessmentMeta = await buildAssessmentMeta(unit.id)
            const submissions = await requestData(
              `/api/v1/courses/${unit.id}/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`,
            )

            for (const submission of submissions) {
              if (!submission?.assignment?.name) continue

              const assignment = submission.assignment
              const assignmentId = String(assignment.id)
              const assignmentInfo = assessmentMeta.assignmentInfoById.get(assignmentId)
              const groupId = String(assignment.assignment_group_id ?? assignmentInfo?.groupId ?? '')
              const dueAt = assignment?.due_at || null
              const daysLeft = toDaysLeft(dueAt)
              const pointsPossible =
                typeof assignment?.points_possible === 'number'
                  ? assignment.points_possible
                  : (assignmentInfo?.pointsPossible ?? null)

              let overallWeight = assessmentMeta.overallWeightByAssignmentId.get(assignmentId) ?? null
              if (overallWeight == null && groupId) {
                const groupWeight = assessmentMeta.groupWeightById.get(groupId)
                const totalPoints = assessmentMeta.groupPointsById.get(groupId) ?? 0
                if (typeof groupWeight === 'number') {
                  if (typeof pointsPossible === 'number' && pointsPossible > 0 && totalPoints > 0) {
                    overallWeight = Math.round(((pointsPossible / totalPoints) * groupWeight) * 100) / 100
                  } else if (totalPoints <= 0) {
                    overallWeight = Math.round(groupWeight * 100) / 100
                  }
                }
              }

              assessments.push({
                id: `a-${assignment.id}`,
                unitCode: unit.code,
                unitName: unit.name,
                title: clean(assignment.name),
                dueText: dueAt
                  ? new Date(dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                  : 'No due date',
                dueAt,
                weight: pointsPossible != null ? Math.round(pointsPossible) : null,
                overallWeight,
                score: submission.score,
                possible: pointsPossible,
                status: submission.workflow_state,
                graded: submission.score !== null,
                status_tone: statusFor(daysLeft),
                daysLeft,
              })
            }
          } catch {
            // Keep going per course
          }
        }

        return {
          sourceUrl: location.href,
          syncedAt: new Date().toISOString(),
          units,
          assessments,
          resources,
        }
      },
    })

    return result
  }

  async scrapeFromTab() {
    const tab = await this.getActiveTab()
    if (!tab?.id || !this.isCanvasUrl(tab.url)) {
      return { error: 'Open https://canvas.qut.edu.au/ or https://canvas.qut.edu.au/courses, then click Sync now.' }
    }

    try {
      const directSnapshot = await this.requestCanvasSnapshotFromPage(tab.id)
      if (directSnapshot?.units?.length || directSnapshot?.assessments?.length || directSnapshot?.resources?.length) {
        await this.chromeApi.storage.local.set({ studylensSnapshot: directSnapshot })
        return { snapshot: directSnapshot }
      }

      const response = await this.chromeApi.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.SCRAPE })
      if (response?.ok && response.snapshot) {
        await this.chromeApi.storage.local.set({ studylensSnapshot: response.snapshot })
        return { snapshot: response.snapshot }
      }

      return { error: response?.error || 'Canvas data fetch failed.' }
    } catch {
      return { error: 'Canvas script is not ready. Refresh Canvas and try again.' }
    }
  }

  async readStoredSnapshot() {
    const payload = await this.chromeApi.storage.local.get('studylensSnapshot')
    return payload.studylensSnapshot ?? null
  }

  async loadCanvasData() {
    const tab = await this.getActiveTab()
    if (!tab?.url || !this.isCanvasUrl(tab.url)) {
      return { error: 'Open Canvas to use this extension!!' }
    }

    const result = await this.scrapeFromTab()
    if (result.snapshot) return result

    const stored = await this.readStoredSnapshot()
    if (stored) return { snapshot: stored }

    return { error: result.error || 'Could not load Canvas data' }
  }
}
