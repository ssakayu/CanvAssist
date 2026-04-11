// sidepanel/App.jsx
// Navigation controller — manages which screen is shown
// Passes data between screens

import { useState } from 'react'
import Overview from '../screens/overview.jsx'
import UnitView from '../screens/unitView.jsx'
import AssessmentDetail from '../screens/assessmentDetail.jsx'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('overview')
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [selectedAssessment, setSelectedAssessment] = useState(null)

  function goToUnit(unit) {
    setSelectedUnit(unit)
    setCurrentScreen('unit')
  }

  function goToAssessment(assessment, unit) {
    setSelectedAssessment(assessment)
    // Update unit in case it was refreshed with AI data
    if (unit) setSelectedUnit(unit)
    setCurrentScreen('assessment')
  }

  function goBack() {
    if (currentScreen === 'assessment') setCurrentScreen('unit')
    else if (currentScreen === 'unit') setCurrentScreen('overview')
  }

  return (
    <>
      {currentScreen === 'overview' && (
        <Overview onSelectUnit={goToUnit} />
      )}
      {currentScreen === 'unit' && selectedUnit && (
        <UnitView
          unit={selectedUnit}
          onBack={goBack}
          onSelectAssessment={goToAssessment}
        />
      )}
      {currentScreen === 'assessment' && selectedAssessment && selectedUnit && (
        <AssessmentDetail
          assessment={selectedAssessment}
          unit={selectedUnit}
          onBack={goBack}
        />
      )}
    </>
  )
}