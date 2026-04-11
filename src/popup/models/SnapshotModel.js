export class SnapshotModel {
  static groupByUnit(snapshot) {
    if (!snapshot) return []
    const allAssessments = snapshot.assessments ?? []
    const resources = snapshot.resources ?? []
    const units = snapshot.units ?? []

    const map = new Map()
    for (const unit of units) {
      map.set(unit.code, {
        code: unit.code,
        name: unit.name,
        assessments: [],
        resources: [],
        currentGrade: unit.currentGrade,
        passMark: unit.passMark ?? 50,
      })
    }

    for (const item of allAssessments) {
      const code = item.unitCode || 'Unknown'
      const existing = map.get(code) ?? {
        code,
        name: item.unitName || code,
        assessments: [],
        resources: [],
        currentGrade: null,
        passMark: 50,
      }
      existing.assessments.push(item)
      map.set(code, existing)
    }

    for (const material of resources) {
      const code = material.unitCode || 'Unknown'
      const existing = map.get(code) ?? {
        code,
        name: code,
        assessments: [],
        resources: [],
        currentGrade: null,
        passMark: 50,
      }
      existing.resources.push(material)
      map.set(code, existing)
    }

    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }

  static computeStats(units) {
    const allAssessments = units.flatMap((unit) => unit.assessments)
    const dueThisWeek = allAssessments.filter((item) => item.daysLeft != null && item.daysLeft <= 7 && item.daysLeft >= 0).length
    const urgent = allAssessments.filter((item) => item.daysLeft != null && item.daysLeft <= 3 && item.daysLeft >= 0).length
    return {
      dueThisWeek,
      urgent,
      activeUnits: units.length,
    }
  }

  static getInitialSelection(snapshot) {
    const units = SnapshotModel.groupByUnit(snapshot)
    const firstUnit = units[0]
    return {
      selectedUnitCode: firstUnit?.code || '',
      selectedAssessmentId: firstUnit?.assessments?.[0]?.id || '',
    }
  }
}
