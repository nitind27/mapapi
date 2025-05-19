"use client";

import { useState } from "react";
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "500px"
};

export default function Page() {
  const [start, setStart] = useState({ lat: "", lng: "" });
  const [end, setEnd] = useState({ lat: "", lng: "" });
  const [directions, setDirections] = useState(null);
  const [turnPoints, setTurnPoints] = useState([]);
  const [routeRequested, setRouteRequested] = useState(false);

  const handleInput = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("start")) {
      setStart({ ...start, [name.split("-")[1]]: value });
    } else {
      setEnd({ ...end, [name.split("-")[1]]: value });
    }
  };

  const handleRoute = () => {
    setDirections(null);
    setTurnPoints([]);
    setRouteRequested(true);
  };

  const extractTurnPoints = (result) => {
    if (!result?.routes?.[0]?.legs?.[0]?.steps) return;
    const steps = result.routes[0].legs[0].steps;
    const turnMarkers = steps
      .filter(
        (step) =>
          step.maneuver &&
          (step.maneuver.includes("left") || step.maneuver.includes("right"))
      )
      .map((step, idx) => ({
        position: {
          lat: step.end_location.lat(),
          lng: step.end_location.lng()
        },
        maneuver: step.maneuver,
        idx
      }));
    setTurnPoints(turnMarkers);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Route Turns Highlighter</h2>
      <div style={{ marginBottom: 10 }}>
        <input
          name="start-lat"
          placeholder="Start Latitude"
          value={start.lat}
          onChange={handleInput}
          style={{ marginRight: 5 }}
        />
        <input
          name="start-lng"
          placeholder="Start Longitude"
          value={start.lng}
          onChange={handleInput}
          style={{ marginRight: 15 }}
        />
        <input
          name="end-lat"
          placeholder="End Latitude"
          value={end.lat}
          onChange={handleInput}
          style={{ marginRight: 5 }}
        />
        <input
          name="end-lng"
          placeholder="End Longitude"
          value={end.lng}
          onChange={handleInput}
          style={{ marginRight: 15 }}
        />
        <button
          onClick={handleRoute}
          disabled={
            !start.lat || !start.lng || !end.lat || !end.lng
          }
        >
          Enter
        </button>
      </div>

      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={{
            lat: Number(start.lat) || 28.6139,
            lng: Number(start.lng) || 77.2090
          }}
          zoom={13}
        >
          {routeRequested && start.lat && start.lng && end.lat && end.lng && (
            <DirectionsService
              options={{
                destination: { lat: Number(end.lat), lng: Number(end.lng) },
                origin: { lat: Number(start.lat), lng: Number(start.lng) },
                travelMode: "DRIVING"
              }}
              callback={(result, status) => {
                if (status === "OK") {
                  setDirections(result);
                  extractTurnPoints(result);
                  setRouteRequested(false);
                }
              }}
            />
          )}

          {directions && (
            <DirectionsRenderer
              options={{
                directions: directions
              }}
            />
          )}

          {turnPoints.map((point) => (
            <Marker
              key={point.idx}
              position={point.position}
              label={
                point.maneuver.includes("left") ? "L" : "R"
              }
              icon={{
                url:
                  point.maneuver.includes("left")
                    ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                    : "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
