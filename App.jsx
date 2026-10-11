import React, { useEffect, useMemo, useRef, useState } from "react";
import { scenarios } from "./data/scenarios.js";
import IncidentCard from "./components/IncidentCard.jsx";
import DisasterMap from "./components/DisasterMap.jsx";
import ImageryPanel from "./components/ImageryPanel.jsx";
import L from "leaflet";

export default function App() {
  const [scenario, setScenario] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightedIncident, setHighlightedIncident] = useState(null);
  const [imageAssessment, setImageAssessment] = useState(null);
  const [includeAssessment, setIncludeAssessment] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  function reset(next = null) {
    request.current?.abort();
    request.current = null;
    setScenario(next);
    setDispatches([]);
    setAdvice(null);
    setLoading(false);
    setError("");
    setHighlightedIncident(null);
    setImageAssessment(null);
    setIncludeAssessment(false);
  }

  function invalidatePlan() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setAdvice(null);
    setError("");
  }

  function updateImageAssessment(next) {
    if (includeAssessment) invalidatePlan();
    setImageAssessment(next);
    setIncludeAssessment(false);
  }

  function toggleAssessment() {
    invalidatePlan();
    setIncludeAssessment((previous) => !previous);
  }

  function viewIncident(name) {
    setHighlightedIncident(name);
    const index = scenario.incidents.findIndex(
      (incident) => incident.name === name,
    );
    const card = document.getElementById(`incident-card-${index}`);
    card?.scrollIntoView({ block: "center" });
    card?.focus({ preventScroll: true });
  }

  function addIncident(details) {
    if (loading)
      return "Wait for the advisor to finish, then save the incident.";
    if (scenario.incidents.length >= 10)
      return "This simulation supports up to 10 incidents.";
    if (!details.name || !details.condition)
      return "Enter an incident name and condition.";
    if (
      scenario.incidents.some(
        (incident) =>
          incident.name.toLowerCase() === details.name.toLowerCase(),
      )
    ) {
      return "Choose a unique incident name.";
    }
    if (
      !Number.isInteger(details.people) ||
      details.people < 1 ||
      details.people > 10000
    ) {
      return "People affected must be a whole number between 1 and 10,000.";
    }
    const urgencyByRisk = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
    const center = L.latLng(
      scenario.mapCenter.latitude,
      scenario.mapCenter.longitude,
    );
    const distance = Number(
      (
        center.distanceTo([details.latitude, details.longitude]) / 1609.344
      ).toFixed(1),
    );
    if (distance > 1000)
      return "Choose a point within 1,000 miles of the scenario center.";
    const incident = {
      name: details.name,
      people: details.people,
      risk: details.risk,
      description: details.condition,
      conditions: details.condition,
      latitude: details.latitude,
      longitude: details.longitude,
      urgency: urgencyByRisk[details.risk],
      distance,
    };

    //append to a new scenario object; never change the predefined data file.
    setScenario((previous) => ({
      ...previous,
      incidents: [...previous.incidents, incident],
    }));

    //old advice does not include this incident, ask again for a complete plan
    setAdvice(null);
    setError("");
    return null;
  }

  async function askAdvisor() {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");

    //complete scenario plus player assignments: Python gets current resources
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/rescue-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scenario,
          dispatches,
          ...(includeAssessment && imageAssessment ? { imageAssessment } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Advisor request failed");
      const result = await response.json();
      if (request.current === controller) setAdvice(result);
    } catch {
      if (request.current === controller)
        setError(
          "Cannot reach the advisor. Check that Python is running on port 8001, then try again.",
        );
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        setLoading(false);
        request.current = null;
      }
    }
  }

  function dispatch(incident) {

    //one team per incident; never use more teams than the scenario supplies
    if (
      loading ||
      !advice ||
      dispatches.length >= scenario.rescueTeams ||
      dispatches.some((entry) => entry.incident === incident)
    )
      return;
    setDispatches((previous) => [
      ...previous,
      { team: previous.length + 1, incident },
    ]);
  }

  const available = scenario ? scenario.rescueTeams - dispatches.length : 0;
  const decisionFeedback = useMemo(() => {
    if (!scenario || !advice || !advice.priorities?.length) return null;

    const assigned = new Set(dispatches.map((entry) => entry.incident));
    const remaining = advice.priorities.filter(
      (item) => !assigned.has(item.incident),
    );

    if (!dispatches.length) {
      return {
        tone: "neutral",
        badge: "NEXT PRIORITY",
        message: remaining[0]
          ? `The highest remaining target is ${remaining[0].incident}. Send the first team where the advisor says the need is greatest.`
          : "All incidents are already assigned. Review the log or start a new simulation to test a different response.",
        remaining: remaining.slice(0, 3),
      };
    }

    const latest = dispatches.at(-1);
    const latestPriority =
      advice.priorities.find((item) => item.incident === latest.incident)
        ?.priority ?? Number.POSITIVE_INFINITY;
    const topRemaining = remaining[0];

    if (latestPriority <= 2) {
      return {
        tone: "positive",
        badge: "GOOD MATCH",
        message: topRemaining
          ? `${latest.incident} was a high-priority choice. The next best target is ${topRemaining.incident}, which should receive the next team.`
          : `${latest.incident} was a strong choice. No higher-priority incident remains unassigned.`,
        remaining: remaining.slice(0, 3),
      };
    }

    return {
      tone: "warning",
      badge: "IMPACT ALERT",
      message: topRemaining
        ? `${latest.incident} shifts attention away from the top recommendation. ${topRemaining.incident} is now the best remaining incident to prioritize.`
        : `${latest.incident} uses a team on a lower-ranked incident. Review the log and consider whether another incident should take priority next.`,
      remaining: remaining.slice(0, 3),
    };
  }, [advice, dispatches, scenario]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✚</span>
          <div>
            <strong>SKY RESCUE</strong>
            <span>AI-ASSISTED DISASTER RESPONSE</span>
          </div>
        </div>
        <div className="simulation-chip">
          <span className="status-dot" /> PYTHON PALS
        </div>
      </header>
      {!scenario ? (
        <main key="start-screen" className="start-screen">
          <div className="eyebrow accent">
            EMERGENCY OPERATIONS · TRAINING MODE
          </div>
          <h1>
            When resources are limited,
            <br />
            <span>your decisions matter</span>
          </h1>
          <p className="intro">AI-Assisted Disaster Response Simulation</p>
          <p className="start-copy">
            Get started by clicking one of the three disaster scenarios below - assess all incidents, consult with the advisor, and make your own decision to dispatch rescue teams.
          </p>
          <div className="section-heading">
            <h2>Disaster Scenarios:</h2>
          </div>
          <div className="scenario-grid">
            {scenarios.map((item, index) => (
              <button
                key={item.id}
                className={`scenario-choice ${item.id}`}
                onClick={() => reset(item)}
              >
                <div className="scenario-top">
                  
                  <span className="eyebrow">SCENARIO {index + 1}</span>
                </div>
                <h3>{item.disaster.toUpperCase()}</h3>
                <p>{item.overview}</p>
                <div className="scenario-location">{item.location}</div>
                <div className="scenario-bottom">
                  <span>
                    {item.incidents.length} incidents · {item.rescueTeams}{" "}
                    rescue teams
                  </span>
                  <span aria-hidden="true">↗</span>
                </div>
              </button>
            ))}
          </div>
          <div className="learning-note">
            <span className="note-symbol">i</span>
            <p>
              <strong>Made by the Python Pals - Leah & Kriti</strong>
              </p>
          </div>
        </main>
      ) : (
        <main key={scenario.id} className="dashboard">
          <div className="dashboard-heading">
            <div>
              <div className="eyebrow accent">
                SKYRESCUE - EMERGENCY OPERATIONS CENTER
              </div>
              <h1>
                 {scenario.disaster} response
              </h1>
            </div>
            <button className="secondary" onClick={() => reset()}>
              ↻ Start New Simulation
            </button>
          </div>
          <div className="operation-status">
            <span className="status-dot" />
            <strong>ACTIVE SIMULATION</strong>
            <span>{scenario.weather}</span>
          </div>
          <section className="stats" aria-label="Scenario overview">
            {[
              ["DISASTER", scenario.disaster],
              [
                "PEOPLE REQUIRING ASSISTANCE",
                scenario.incidents.reduce(
                  (total, item) => total + item.people,
                  0,
                ),
              ],
              [
                "RESCUE TEAMS AVAILABLE",
                `${available} / ${scenario.rescueTeams}`,
              ],
              ["AVAILABLE SHELTERS", scenario.shelters.length],
              ["BLOCKED ROADS", scenario.blockedRoads.length],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <span className="eyebrow">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <div className="resource-details">
            <p>
              <strong>Shelters</strong> {scenario.shelters.join(" · ")}
            </p>
            <p>
              <strong>Blocked roads</strong>{" "}
              {scenario.blockedRoads.join(" · ") || "None"}
            </p>
          </div>
          <DisasterMap
            key={scenario.id}
            scenario={scenario}
            onViewIncident={viewIncident}
            onAddIncident={addIncident}
            busy={loading}
          />
          <ImageryPanel
            key={scenario.id}
            assessment={imageAssessment}
            included={includeAssessment}
            onAssessmentChange={updateImageAssessment}
            onToggleInclude={toggleAssessment}
            planBusy={loading}
          />
          <div className="workspace">
            <section className="incidents">
              <div className="section-heading">
                <h2>Incidents requiring assistance</h2>
                <span className="eyebrow">
                  {scenario.incidents.length} REPORTED
                </span>
              </div>
              <div className="incident-grid">
                {scenario.incidents.map((item, index) => (
                  <IncidentCard
                    key={item.name}
                    incident={item}
                    index={index}
                    highlighted={highlightedIncident === item.name}
                    team={
                      dispatches.find((entry) => entry.incident === item.name)
                        ?.team
                    }
                  />
                ))}
              </div>
              <section className="dispatch-panel">
                <div className="eyebrow accent">YOUR DECISION</div>
                <h2>
                  {available > 0
                    ? `WHERE SHOULD RESCUE TEAM ${dispatches.length + 1} GO?`
                    : "ALL RESCUE TEAMS DISPATCHED"}
                </h2>
                <p>
                  {advice
                    ? "Choose any unassigned incident."
                    : "Ask the advisor for priorities, then make your decision."}
                </p>
                <div className="dispatch-options">
                  {scenario.incidents.map((item) => (
                    <button
                      className="secondary"
                      key={item.name}
                      disabled={
                        !advice ||
                        loading ||
                        available === 0 ||
                        dispatches.some((entry) => entry.incident === item.name)
                      }
                      onClick={() => dispatch(item.name)}
                    >
                      {item.name}
                      <span aria-hidden="true"> →</span>
                    </button>
                  ))}
                </div>
                <div aria-live="polite">
                  {dispatches.length > 0 && (
                    <p className="dispatch-confirmation">
                      RESCUE TEAM {dispatches.length} DISPATCHED →{" "}
                      {dispatches.at(-1).incident}
                    </p>
                  )}
                </div>
              </section>
            </section>
            <aside className="sidebar">
              <section className="advisor-panel">
                <div className="panel-title">
                  <span className="advisor-icon">✧</span>
                  <div>
                    <span className="eyebrow">DECISION SUPPORT</span>
                    <h2>Response Advisor</h2>
                  </div>
                </div>
                <p className="muted">
                  Get a suggested priority order based on this simulated
                  situation.
                </p>
                <button
                  className="primary"
                  onClick={askAdvisor}
                  disabled={loading}
                >
                  {loading
                    ? "ANALYZING SCENARIO…"
                    : "ASK AI FOR RESCUE PRIORITY"}
                  <span aria-hidden="true"> ↗</span>
                </button>
                <div aria-live="polite" aria-busy={loading}>
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                  {advice ? (
                    <>
                      <div className={`advisor-source ${advice.source}`}>
                        {advice.source === "ai"
                          ? "AI EMERGENCY ADVISOR"
                          : "LOCAL EMERGENCY ADVISOR"}
                      </div>
                      {advice.source === "local" && (
                        <p className="fallback-note">
                          OpenAI is unavailable or not configured. Using the
                          local scoring algorithm.
                        </p>
                      )}
                      <ol className="priority-list">
                        {advice.priorities.map((item) => (
                          <li key={item.incident}>
                            <span className="priority-number">
                              {item.priority}
                            </span>
                            <div>
                              <span className="eyebrow">
                                PRIORITY {item.priority}
                              </span>
                              <h3>{item.incident}</h3>
                              <p>{item.reason}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="recommendation">
                        <span className="eyebrow accent">
                          OVERALL RECOMMENDATION
                        </span>
                        <p>{advice.summary}</p>
                      </div>
                      {dispatches.length > 0 && (
                        <p className="fallback-note">
                          Advice reflects the last request. Ask again to include
                          your latest dispatches.
                        </p>
                      )}
                    </>
                  ) : (
                    !loading && (
                      <div className="advisor-empty">
                        <span>✧</span>
                        <p>
                          Your advisor is standing by.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </section>
              <section className="feedback-panel">
                <div className="panel-title">
                  <span className="feedback-icon">◎</span>
                  <div>
                    <span className="eyebrow">DECISION FEEDBACK</span>
                    <h2>Impact on rescue priorities</h2>
                  </div>
                </div>
                {decisionFeedback ? (
                  <>
                    <div className={`feedback-badge ${decisionFeedback.tone}`}>
                      {decisionFeedback.badge}
                    </div>
                    <p className="feedback-message">{decisionFeedback.message}</p>
                    {decisionFeedback.remaining.length > 0 && (
                      <ul className="feedback-list">
                        {decisionFeedback.remaining.map((item) => (
                          <li key={item.incident}>
                            <span className="feedback-rank">#{item.priority}</span>
                            <div>
                              <strong>{item.incident}</strong>
                              <small>Priority {item.priority}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Ask for advice and make your first dispatch to see how your
                    decision changes the remaining priorities.
                  </p>
                )}
              </section>
              <section className="log-panel">
                <div className="section-heading">
                  <h2>EMERGENCY RESPONSE LOG</h2>
                  <span className="log-count">{dispatches.length}</span>
                </div>
                {dispatches.length ? (
                  <ol className="log-list">
                    {dispatches.map((entry) => (
                      <li key={entry.team}>
                        <span className="log-check">✓</span>
                        <div>
                          <strong>
                            Team {entry.team} → {entry.incident}
                          </strong>
                          <span>DISPATCH RECORDED</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">
                    No teams dispatched yet. Your decisions will appear here.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </main>
      )}
      <footer>
        <span>SKYRESCUE ~ EDUCATIONAL TRAINING SYSTEM</span>
      </footer>
    </div>
  );
}

