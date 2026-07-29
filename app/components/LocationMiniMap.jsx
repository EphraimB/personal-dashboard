'use client';

import React, { useEffect, useRef, useState } from 'react';

function parseDurationToMins(durStr) {
  if (!durStr) return 9999;
  if (durStr.includes('< 1m')) return 0.5;
  let total = 0;
  const hMatch = durStr.match(/(\d+)\s*h/);
  const mMatch = durStr.match(/(\d+)\s*m/);
  if (hMatch) total += parseInt(hMatch[1], 10) * 60;
  if (mMatch) total += parseInt(mMatch[1], 10);
  return total > 0 ? total : 9999;
}

export default function LocationMiniMap({ location, compact = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!location) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/geocode?location=${encodeURIComponent(location)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data && data.valid) {
            setGeoData(data);
          } else {
            setGeoData(null);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to geocode location:', err);
        if (isMounted) {
          setGeoData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [location]);

  useEffect(() => {
    if (!geoData || !mapRef.current) return;

    let mapInstance = null;

    // Dynamically import Leaflet client-side only
    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      // Fix default Leaflet marker icon paths in Webpack/Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });

      // Cleanup existing map instance if re-rendering
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const { origin, destination } = geoData;

      // Create static read-only TV map (disable all drag, zoom, touch, and scroll wheel interactions)
      mapInstance = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false
      });

      // Add CartoDB Dark Matter tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(mapInstance);

      // Custom Home Icon (Green Neon)
      const homeIcon = L.divIcon({
        className: 'hud-map-pin pin-home',
        html: `<div class="pin-marker home-marker" title="Home: 141 Grove Av">🏠</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Custom Destination Icon (Cyan Neon)
      const destIcon = L.divIcon({
        className: 'hud-map-pin pin-dest',
        html: `<div class="pin-marker dest-marker" title="${destination.label}">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      // Add markers
      L.marker([origin.lat, origin.lon], { icon: homeIcon }).addTo(mapInstance);
      L.marker([destination.lat, destination.lon], { icon: destIcon }).addTo(mapInstance);

      // Add dashed connection line between Home and Destination
      L.polyline(
        [
          [origin.lat, origin.lon],
          [destination.lat, destination.lon]
        ],
        {
          color: '#00f0ff',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.85
        }
      ).addTo(mapInstance);

      // Fit bounds to show both pins
      const bounds = L.latLngBounds([
        [origin.lat, origin.lon],
        [destination.lat, destination.lon]
      ]);
      mapInstance.fitBounds(bounds, { padding: [25, 25], maxZoom: 15 });

      mapInstanceRef.current = mapInstance;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geoData]);

  if (loading) {
    return null; // Silent placeholder while checking location
  }

  if (!geoData) {
    return null; // Hide mini map entirely if non-physical or unresolvable
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    '141 Grove Av, Cedarhurst, NY'
  )}&destination=${encodeURIComponent(geoData.destination.label)}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=3&color=00f0ff&bgcolor=080c18&data=${encodeURIComponent(
    googleMapsUrl
  )}`;

  const travel = geoData.travelTimes || { walk: '18m', bike: '6m', transit: '14m', drive: '5m' };

  const modeMins = {
    walk: parseDurationToMins(travel.walk),
    bike: parseDurationToMins(travel.bike),
    transit: parseDurationToMins(travel.transit),
    drive: parseDurationToMins(travel.drive)
  };

  let fastestKey = 'drive';
  let minMins = 9999;
  for (const [key, mins] of Object.entries(modeMins)) {
    if (mins < minMins) {
      minMins = mins;
      fastestKey = key;
    }
  }

  return (
    <div className={`hud-mini-map-wrapper ${compact ? 'hud-mini-map-compact' : ''}`}>
      <div className="hud-mini-map-header">
        <span className="hud-mini-map-title">📍 ROUTE RADAR</span>
        <span className="hud-mini-map-badge">⚡ {geoData.formattedDistance}</span>
      </div>

      <div className="hud-mini-map-canvas-container">
        <div ref={mapRef} className="hud-mini-map-canvas" />

        {/* Scan-to-Navigate QR Code Badge for TV display */}
        <div className="hud-mini-map-qr-badge" title="Scan with Phone Camera for Google Maps Directions">
          <img src={qrImageUrl} alt="Scan QR Code for Directions" className="hud-qr-img" />
          <span className="hud-qr-tag">SCAN NAV 📱</span>
        </div>
      </div>

      {/* Horizontal Multi-Modal Travel Time Bar */}
      <div className="hud-travel-mode-bar">
        <div className={`travel-mode-item ${fastestKey === 'walk' ? 'travel-mode-fastest' : ''}`} title="Walking Duration">
          <span className="travel-mode-icon">🚶</span>
          <span className="travel-mode-val">{travel.walk}</span>
        </div>
        <span className="travel-mode-sep">•</span>
        <div className={`travel-mode-item ${fastestKey === 'bike' ? 'travel-mode-fastest' : ''}`} title="Biking Duration">
          <span className="travel-mode-icon">🚴</span>
          <span className="travel-mode-val">{travel.bike}</span>
        </div>
        <span className="travel-mode-sep">•</span>
        <div className={`travel-mode-item ${fastestKey === 'transit' ? 'travel-mode-fastest' : ''}`} title="Public Transit / Train Duration">
          <span className="travel-mode-icon">🚆</span>
          <span className="travel-mode-val">{travel.transit}</span>
        </div>
        <span className="travel-mode-sep">•</span>
        <div className={`travel-mode-item ${fastestKey === 'drive' ? 'travel-mode-fastest' : ''}`} title="Driving Duration">
          <span className="travel-mode-icon">🚗</span>
          <span className="travel-mode-val">{travel.drive}</span>
        </div>
      </div>
    </div>
  );
}
