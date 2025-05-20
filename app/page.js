"use client";
import { useState } from "react";
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer, Marker } from "@react-google-maps/api";
import * as XLSX from "xlsx";

const containerStyle = { width: "100%", height: "500px" };

export default function Page() {
  const [start, setStart] = useState({ lat: "", lng: "" });
  const [end, setEnd] = useState({ lat: "", lng: "" });
  const [directions, setDirections] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
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
    setRoutePoints([]);
    setRouteRequested(true);
  };

  // Helper: Google LatLng to simple object
  const latLngToObj = (latLng) => ({
    latitude: typeof latLng.lat === "function" ? latLng.lat() : latLng.lat,
    longitude: typeof latLng.lng === "function" ? latLng.lng() : latLng.lng,
  });

  // Angle calculation between three points (A-B-C)
  function getAngle(a, b, c) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const ab = {
      x: b.longitude - a.longitude,
      y: b.latitude - a.latitude,
    };
    const bc = {
      x: c.longitude - b.longitude,
      y: c.latitude - b.latitude,
    };

    const dot = ab.x * bc.x + ab.y * bc.y;
    const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
    const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);

    if (magAB === 0 || magBC === 0) return 0;

    let angleRad = Math.acos(dot / (magAB * magBC));
    return toDeg(angleRad);
  }

  // Extract points where there is a turn (angle threshold)
  const extractTurnPoints = (result) => {
    if (!result?.routes?.[0]?.overview_path) return;
    const path = result.routes[0].overview_path.map(latLngToObj);

    const angleThreshold = 15; // degrees, adjust for sensitivity
    let turnPoints = [];

    for (let i = 1; i < path.length - 1; i++) {
      const a = path[i - 1];
      const b = path[i];
      const c = path[i + 1];
      const angle = getAngle(a, b, c);
      if (angle < 180 - angleThreshold) {
        turnPoints.push(b);
      }
    }
    setRoutePoints(turnPoints);
  };

  // Download Excel
  const handleDownloadExcel = () => {
    // Prepare data for Excel
    const data = routePoints.map((point, idx) => ({
      SNo: idx + 1,
      Latitude: point.latitude,
      Longitude: point.longitude,
    }));

    // Add start/end info in a separate sheet
    const meta = [
      { Label: "Start Latitude", Value: start.lat },
      { Label: "Start Longitude", Value: start.lng },
      { Label: "End Latitude", Value: end.lat },
      { Label: "End Longitude", Value: end.lng },
      { Label: "Total Points", Value: data.length },
      { Label: "Angle Threshold (deg)", Value: 15 },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Turn Points");

    const wsMeta = XLSX.utils.json_to_sheet(meta);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Route Info");

    // Download
    XLSX.writeFile(wb, "route_turn_points.xlsx");
  };

  return (
    <div style={{ padding: 20 }}>
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
        <button
          style={{ marginLeft: 10 }}
          onClick={handleDownloadExcel}
          disabled={routePoints.length === 0}
        >
          Download Excel
        </button>
      </div>

      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={{
            lat: Number(start.lat) || 28.6139,
            lng: Number(start.lng) || 77.2090
          }}
          zoom={15}
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

          {routePoints.length > 2000 && (
            <div style={{ color: "red", background: "#fff", padding: 5, position: "absolute", zIndex: 10 }}>
              Too many markers! Increase angle threshold.
            </div>
          )}

          {routePoints.slice(0, 2000).map((point, idx) => (
            <Marker
              key={idx}
              position={{ lat: point.latitude, lng: point.longitude }}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: { width: 20, height: 20 }
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
