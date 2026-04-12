export default function UnitAssessments({assignments}) {

  if (!assignments) return null;


  return (
    <div className="unit-assignments__container">

      {assignments.map((assignment) => {
        
        return (
          <div className="unit-assignment__card">
            <h2 >{assignment.name}</h2>

            <div className="unit-assignment__card-subtitle">
              <span>
                Due {assignment.dueDateFormatted} - {Math.abs(assignment.daysUntilDue)} days
              </span>

              <span style={{fontWeight: '600'}}>
                {assignment.pointsPossible}%
              </span>
            </div>

            <div className="unit-assignment__card-progress-bar">
              <div
                className="unit-assignment__card-progress"
              ></div>
            </div>
          </div>
        );

      })}

    </div>
  );
}