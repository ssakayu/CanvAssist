import './AppWrapper.css'
import { useGlobal } from '../context/GlobalContext'
import Overview from './views/Overview'
import Unit from './views/Unit'
import AssessmentDetail from './views/assessmentDetail.jsx'
import { useEffect } from 'react'
import Header from './header/Header'
import { useCanvasData } from '../lib/useCanvasData'

export default function AppWrapper() {
  useCanvasData()

  const { view, setView } = useGlobal()

  useEffect(() => {
    setView({
      page: 'overview',
      params: {},
    })
  }, [])

  return (
    <div className="canvAssist">
      <Header />
      {view.page === 'overview' ? <Overview /> : null}
      {view.page === 'unit' ? <Unit {...view.params} /> : null}
      {view.page === 'assessment' ? <AssessmentDetail {...view.params} /> : null}
    </div>
  )
}