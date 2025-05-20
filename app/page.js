"use client";
import { useState } from "react";
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer, Marker } from "@react-google-maps/api";
import { getDistance, computeDestinationPoint } from "geolib";
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

  // Helper: Bearing calculation
  function getBearing(start, end) {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  // Efficiently sample every 10 meters along the polyline
  const extractAllRoutePoints = (result) => {
    if (!result?.routes?.[0]?.overview_path) return;
    const path = result.routes[0].overview_path.map(latLngToObj);

    const interval = 500; // meters
    let sampledPoints = [];
    if (path.length === 0) return;

    sampledPoints.push(path[0]);
    let lastPoint = path[0];

    for (let i = 1; i < path.length; i++) {
      const segStart = lastPoint;
      const segEnd = path[i];
      let segDist = getDistance(segStart, segEnd);

      if (segDist < interval) {
        lastPoint = segEnd;
        continue;
      }

      const bearing = getBearing(segStart, segEnd);
      let covered = 0;
      while (segDist - covered >= interval) {
        const newPoint = computeDestinationPoint(segStart, covered + interval, bearing);
        sampledPoints.push(newPoint);
        covered += interval;
      }
      lastPoint = segEnd;
    }

    // Always add the last point
    sampledPoints.push(path[path.length - 1]);
    setRoutePoints(sampledPoints);
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
      { Label: "Interval (meter)", Value: 10 },
      { Label: "Total Points", Value: data.length },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Route Points");

    const wsMeta = XLSX.utils.json_to_sheet(meta);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Route Info");

    // Download
    XLSX.writeFile(wb, "route_points.xlsx");
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
          zoom={25}
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
                  extractAllRoutePoints(result);
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
              Too many markers! Zoom in or increase interval.
            </div>
          )}

          {routePoints.slice(0, 20000).map((point, idx) => (
            <Marker
              key={idx}
              position={{ lat: point.latitude, lng: point.longitude }}
             
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                scaledSize: { width: 20, height: 20 }
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
