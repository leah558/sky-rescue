import React, { useState } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import AddIncidentForm from "./AddIncidentForm.jsx";

// Static HTML only: incident names are rendered as escaped React text in popups.
const riskIcons = Object.fromEntries(
  ["CRITICAL", "HIGH", "MODERATE"].map((risk) => [
    risk,
    L.divIcon({
      className: `incident-map-marker ${risk.toLowerCase()}`,
      html: `<span aria-hidden="true">${risk[0]}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    }),
  ]),
);
const shelterIcon = L.divIcon({
  className: "shelter-map-marker",
  html: '<span aria-hidden="true">⌂</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});
const zoneColors = {
  flood: "#3b82f6",
  wildfire: "#f97316",
  tornado: "#a78bfa",
};

function MapClick({ active, onPick }) {
  useMapEvents({
    click(event) {
      if (!active) return;
      // Leaflet returns geographic coordinates for the point that was clicked.
      const point = event.latlng.wrap();
      if (Math.abs(point.lat) <= 90)
        onPick({ latitude: point.lat, longitude: point.lng });
    },
  });
  return null;
}

export default function DisasterMap({
  scenario,
  onViewIncident,
  onAddIncident,
  busy,
}) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(null);
  const [tileError, setTileError] = useState(false);
  const atLimit = scenario.incidents.length >= 10;
  const zone = scenario.dangerZone;
  const positions = [...scenario.incidents, ...scenario.shelterLocations].map(
    (place) => [place.latitude, place.longitude],
  );
  // Initial bounds include every predefined incident, shelter, and danger circle.
  const bounds = L.latLngBounds(positions);
  if (zone)
    bounds.extend(
      L.latLng(zone.latitude, zone.longitude).toBounds(zone.radius * 2),
    );

  function cancel() {
    setAdding(false);
    setPicked(null);
  }
  function save(details) {
    const error = onAddIncident(details);
    if (!error) cancel();
    return error;
  }

  return (
    <section className="map-panel" aria-label="Disaster Response Map">
      <div className="section-heading">
        <div>
          <h2>Disaster Response Map</h2>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={busy || (!adding && atLimit)}
          aria-pressed={adding}
          onClick={() => (adding ? cancel() : setAdding(true))}
        >
          {adding ? "CANCEL ADD INCIDENT" : "ADD INCIDENT"}
        </button>
      </div>
      <p className="map-disclaimer">
        Simulated
      </p>
      <div className="map-legend" aria-label="Marker legend">
        <span>
          <i className="legend-dot critical" /> C · CRITICAL
        </span>
        <span>
          <i className="legend-dot high" /> H · HIGH
        </span>
        <span>
          <i className="legend-dot moderate" /> M · MODERATE
        </span>
        <span>
          <i className="legend-dot shelter" /> ⌂ · SHELTER
        </span>
        {zone && <span>{zone.name} · area</span>}
      </div>
      <div className={`map-container-wrap${adding ? " adding-incident" : ""}`}>
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [36, 36], maxZoom: 13 }}
          className="disaster-map"
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <MapClick active={adding && !picked && !busy} onPick={setPicked} />
          {zone && (
            <Circle
              center={[zone.latitude, zone.longitude]}
              radius={zone.radius}
              interactive={false}
              pathOptions={{
                color: zoneColors[scenario.id] || "#55e5c1",
                fillOpacity: 0.15,
                weight: 2,
                dashArray: "6 5",
              }}
            />
          )}
          {scenario.incidents.map((incident) => (
            <Marker
              key={incident.name}
              position={[incident.latitude, incident.longitude]}
              icon={riskIcons[incident.risk]}
              title={`Incident: ${incident.name} (${incident.risk})`}
              alt={`Incident: ${incident.name} (${incident.risk})`}
              bubblingMouseEvents={false}
            >
              <Popup>
                <div className="incident-popup">
                  <h3>{incident.name}</h3>
                  <dl>
                    <dt>People affected</dt>
                    <dd>{incident.people}</dd>
                    <dt>Risk</dt>
                    <dd>{incident.risk}</dd>
                    <dt>Condition</dt>
                    <dd>{incident.conditions}</dd>
                    <dt>Distance</dt>
                    <dd>{incident.distance} miles</dd>
                  </dl>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onViewIncident(incident.name)}
                  >
                    VIEW INCIDENT
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          {scenario.shelterLocations.map((shelter) => (
            <Marker
              key={shelter.name}
              position={[shelter.latitude, shelter.longitude]}
              icon={shelterIcon}
              title={`Shelter: ${shelter.name}`}
              alt={`Shelter: ${shelter.name}`}
              bubblingMouseEvents={false}
            >
              <Popup>
                <strong>{shelter.name}</strong>
                <p>Simulation shelter</p>
              </Popup>
            </Marker>
          ))}
          {picked && (
            <CircleMarker
              center={[picked.latitude, picked.longitude]}
              radius={10}
              interactive={false}
              pathOptions={{ color: "#55e5c1", fillOpacity: 0.5 }}
            />
          )}
        </MapContainer>
      </div>
      <div aria-live="polite">
        {adding && !picked && (
          <p className="map-mode-message">
            ADD INCIDENT: click an empty spot on the map to choose its
            coordinates.
          </p>
        )}
        {tileError && (
          <p className="fallback-note">
            Some OpenStreetMap tiles could not load. Markers and incident
            creation still work; tiles need internet access.
          </p>
        )}
        {atLimit && (
          <p className="fallback-note">
            Maximum 10 incidents per simulation, matching the existing advisor
            limit.
          </p>
        )}
      </div>
      {picked && (
        <AddIncidentForm coordinates={picked} onSave={save} onCancel={cancel} />
      )}
    </section>
  );
}
