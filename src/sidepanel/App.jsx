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

  function goToAssessment(assessment) {
    setSelectedAssessment(assessment)
    setCurrentScreen('assessment')
  }

  function goBack() {
    if (currentScreen === 'assessment') setCurrentScreen('unit')
    if (currentScreen === 'unit') setCurrentScreen('overview')
  }

  return (
    <div>
      {currentScreen === 'overview' && (
        <Overview onSelectUnit={goToUnit} />
      )}
      {currentScreen === 'unit' && (
        <UnitView
          unit={selectedUnit}
          onBack={goBack}
          onSelectAssessment={goToAssessment}
        />
      )}
      {currentScreen === 'assessment' && (
        <AssessmentDetail
          assessment={selectedAssessment}
          unit={selectedUnit}
          onBack={goBack}
        />
      )}
    </div>
  )
}