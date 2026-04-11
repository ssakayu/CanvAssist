import { useEffect, useState } from "react";
import getActiveCourses from "./getActiveCourses";
import "./App.css";

const units = [
  {
    code: "CAB302",
    name: "Agile Software Engineering",
    grade: 62,
    status: "2 due soon",
    statusType: "warning",
    note: "Need 50%+ to pass",
    progress: 62,
    barType: "green",
  },
  {
    code: "IFB220",
    name: "Introduction to AI",
    grade: 74,
    status: "On track",
    statusType: "success",
    note: "Distinction range",
    progress: 74,
    barType: "green",
  },
  {
    code: "CAB420",
    name: "Machine Learning",
    grade: 48,
    status: "At risk",
    statusType: "danger",
    note: "Need 58%+ to pass",
    progress: 48,
    barType: "red",
  },
  {
    code: "SCB300",
    name: "WIL Placement",
    grade: 90,
    status: "On track",
    statusType: "success",
    note: "Looking good",
    progress: 90,
    barType: "green",
  },
];

export default function StudyLens() {
  return (
    <div className="phone-shell">
      <div className="studylens-card">
        <div className="topbar">
          <div className="brand">
            <span className="dot green"></span>
            <h1>StudyLens</h1>
          </div>

          <div className="sync-pill">
            <span className="dot green">{formatLastSync(lastSync)}</span>
            <button className='sync-btn' onClick={handleSync}>Sync Canvas data</button>
            
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-number red">{dueThisWeek.length}</div>
            <div className="stat-label">Due this week</div>
          </div>

          <div className="stat-box">
            <div className="stat-number amber">{mostUrgent ? `${mostUrgent.daysUntilDue}d` : '—'}</div>
            <div className="stat-label">Days to urgent</div>
          </div>

          <div className="stat-box">
            <div className="stat-number white">{units.length}</div>
            <div className="stat-label">Active units</div>
          </div>
        </div>

              {/* Most urgent assessment callout */}
        {mostUrgent && (
        <div className='urgent-callout'>
          <span className='urgent-label'>Most urgent</span>
          <span className='urgent-name'>{mostUrgent.name}</span>
          <span className='urgent-meta'>
            {mostUrgent.unitCode} · Due {mostUrgent.dueDateFormatted} · {mostUrgent.pointsPossible}pts
          </span>
        </div>
        )}  

        <div className="section-title">YOUR UNITS</div>

        <div className="unit-list">
          {units.map((unit) => (
            <div key={unit.id} className="unit-card">
              <div className="unit-header">
                <div >
                  <div className="unit-code">{unit.id}</div>
                  <div className="unit-name" onClick={() => onSelectUnit(unit)}>{unit}</div>
                </div>

                <span className={`status-pill ${unit.statusType}`}>
                  {unit.status}
                </span>
              </div>

              <div className="progress-track">
                <div
                  className={`progress-fill ${unit.barType}`}
                  style={{ width: `${unit.progress}%` }}
                ></div>
              </div>

              <div className="unit-footer">
                <span>Current grade: {unit.grade}%</span>
                <span>{unit.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
