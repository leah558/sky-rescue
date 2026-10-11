import React, { useState } from "react";

export default function AddIncidentForm({ coordinates, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState("");
  const [risk, setRisk] = useState("HIGH");
  const [condition, setCondition] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const message = onSave({
      name: name.trim(),
      people: Number(people),
      risk,
      condition: condition.trim(),
      ...coordinates,
    });
    // App validates uniqueness and the existing advisor's incident limit.
    if (message) setError(message);
  }

  return (
    <form
      className="map-incident-form"
      onSubmit={submit}
      aria-label="Add incident"
    >
      <div className="section-heading">
        <h3>New incident</h3>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="picked-coordinates">
        Selected coordinates:{" "}
        <strong>
          {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
        </strong>
      </p>
      <div className="map-form-fields">
        <label htmlFor="incident-name">
          Incident Name
          <input
            autoFocus
            id="incident-name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label htmlFor="incident-people">
          People Affected
          <input
            id="incident-people"
            type="number"
            required
            min={1}
            max={10000}
            step={1}
            value={people}
            onChange={(event) => setPeople(event.target.value)}
          />
        </label>
        <label htmlFor="incident-risk">
          Risk Level
          <select
            id="incident-risk"
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
          >
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MODERATE">MODERATE</option>
          </select>
        </label>
        <label className="condition-field" htmlFor="incident-condition">
          Condition
          <textarea
            id="incident-condition"
            required
            maxLength={600}
            rows={2}
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
          />
        </label>
      </div>
      <p className="muted">
        Use given details. Urgency follows risk (Critical 3, High 2,
        Moderate 1). Distance is straight-line miles from the scenario center.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="secondary">
        SAVE INCIDENT
      </button>
    </form>
  );
}
