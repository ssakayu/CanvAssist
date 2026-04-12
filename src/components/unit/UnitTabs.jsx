import { useState } from 'react';
import './UnitTabs.css';
import UnitAssessments from './UnitAssessments';
import UnitMaterials from './UnitMaterials';

export default function UnitTabs({assignments, modules}) {

  const [activeTab, setActiveTab] = useState('assessments');


  return (
    <>
    
      <div className='unit-tabs'>
        <span
          onClick={() => {setActiveTab('assessments')}}
          className={activeTab === 'assessments' && 'active'}
          style={{borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px'}}
        >Assessments</span>

        <span
          onClick={() => {setActiveTab('materials')}}
          className={activeTab === 'materials' && 'active'}
          style={{borderTopRightRadius: '8px', borderBottomRightRadius: '8px'}}
        >Materials</span>
      </div>

      {activeTab === 'assessments' && <UnitAssessments assignments={assignments} />}

      {activeTab === 'materials' && <UnitMaterials modules={modules} />}

    </>
  );

}
