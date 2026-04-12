import { useEffect, useState } from "react";
import getAssignments from "../../api/getAssignments";
import getModules from "../../api/getModules";
import './Unit.css';
import UnitTabs from "../unit/UnitTabs";

export default function Unit({
    unitId,
    unitCode,
    friendlyName,
}) {

  const [assignments, setAssignments] = useState([]);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      // Fetch data
      const unitAssignments = await getAssignments(unitId);
      const unitModules = await getModules(unitId);
      console.log('assignments', unitAssignments);
      console.log('modules', unitModules);

      // Assign data
      setAssignments(unitAssignments);
      setModules(unitModules);
    }
    
    loadData();

  }, []);


    return (
      <div>
        <div className="unit-title">
          <h1 className="font-subtitle">{unitCode} — {friendlyName}</h1>
          
          <p>Current grade: {62}</p>
        </div>
        
        <UnitTabs assignments={assignments} modules={modules} />
      </div>        
    );
}
