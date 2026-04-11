import { useEffect, useState } from "react";
import getAssignments from "../../api/getAssignments";

export default function Unit({
    unitId,
    unitCode,
}) {

  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    const loadAssignments = async () => {
      const unitAssignments = await getAssignments(unitId);
      console.log(unitAssignments);
      setAssignments(unitAssignments);
    }
    
    loadAssignments();

  }, []);


    return (
        <div>
            Unit {unitId}
            <br />
            Unit Code: {unitCode}
        </div>        
    );
}
