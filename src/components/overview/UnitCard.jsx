import { useGlobal } from "../../context/GlobalContext"

export default function UnitCard({
    code,
    friendlyName,
    unitId,
    badge,
    badgeVariant,
    grade,
    footerRight,
    progress,
    barVariant,
  }) {

    const {setView} = useGlobal();

    const badgeClass =
      badgeVariant === 'soon'
        ? 'canvAssist-badge canvAssist-badge--soon'
        : badgeVariant === 'risk'
          ? 'canvAssist-badge canvAssist-badge--risk'
          : 'canvAssist-badge canvAssist-badge--ok'
  
    const fillClass =
      barVariant === 'red'
        ? 'canvAssist-bar-fill canvAssist-bar-fill--red'
        : 'canvAssist-bar-fill canvAssist-bar-fill--green'



    function handleClick() {
      setView({
        page: 'unit',
        params: {
          unitId: unitId,
          unitCode: code,
        },
      });
    }

  
    return (
      <li className="canvAssist-unit" onClick={handleClick}>
        <div className="canvAssist-unit-top">
          <span className="canvAssist-unit-code">{code}</span>
          <span className={badgeClass}>{badge}</span>
        </div>
        <p className="canvAssist-unit-name">{friendlyName}</p>
        <div className="canvAssist-bar" role="presentation">
          <div
            className={fillClass}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="canvAssist-unit-footer">
          <span>
            Current grade:
            {' '}
            <strong>{grade}%</strong>
          </span>
          <span>{footerRight}</span>
        </div>
      </li>
    )
  }