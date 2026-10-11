import React from "react";

export default function IncidentCard({ incident, index, team, highlighted }) {
  return (
    <article
      id={`incident-card-${index}`}
      tabIndex={-1}
      aria-label={`${incident.name} incident${highlighted ? ", selected from map" : ""}`}
      className={`incident-card risk-${incident.risk.toLowerCase()}${highlighted ? " highlighted" : ""}`}
    >
      <div className="card-top">
        <span className="eyebrow">
          INCIDENT {String.fromCharCode(65 + index)}
        </span>
        <span className={`risk-badge ${incident.risk.toLowerCase()}`}>
          {incident.risk}
        </span>
      </div>
      <h3>{incident.name}</h3>
      <p className="description">{incident.description}</p>
      <div className="incident-numbers">
        <div>
          <strong>{incident.people}</strong>
          <span>PEOPLE</span>
        </div>
        <div>
          <strong>
            {incident.distance}
            <small> mi</small>
          </strong>
          <span>DISTANCE</span>
        </div>
        <div>
          <strong>
            {incident.urgency}
            <small>/3</small>
          </strong>
          <span>URGENCY</span>
        </div>
      </div>
      <div className="conditions">
        <span className="eyebrow">CONDITIONS</span>
        <p>{incident.conditions}</p>
      </div>
      {team && <div className="assigned">✓ Rescue Team {team} dispatched</div>}
    </article>
  );
}
