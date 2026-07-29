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

export default function LocationMiniMap({ location, meetingUrl = '', compact = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if ((!location || !location.trim()) && (!meetingUrl || !meetingUrl.trim())) {
      setGeoData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const queryUrl = `/api/geocode?location=${encodeURIComponent(location || '')}&meetingUrl=${encodeURIComponent(meetingUrl || '')}`;

    fetch(queryUrl)
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
  }, [location, meetingUrl]);

  useEffect(() => {
    if (!geoData || geoData.isVirtual || !mapRef.current) return;

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
    return null; // Silent placeholder while loading
  }

  // Completely hide container for events without physical locations or virtual URLs
  if (!geoData || !geoData.valid) {
    return null;
  }

  // Render Virtual Meeting HUD Card with Scan-to-Join QR Code for Online Events
  if (geoData.isVirtual) {
    const meetingUrlData = geoData.meetingUrl || meetingUrl || 'https://zoom.us';
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=3&color=00f0ff&bgcolor=080c18&data=${encodeURIComponent(
      meetingUrlData
    )}`;

    return (
      <div className={`hud-mini-map-wrapper hud-virtual-wrapper ${compact ? 'hud-mini-map-compact' : ''}`}>
        <div className="hud-mini-map-header hud-virtual-header">
          <span className="hud-mini-map-title">
            {geoData.platformIcon} {geoData.platformName}
          </span>
          <span className="hud-virtual-status-badge">ONLINE</span>
        </div>

        <div className="hud-virtual-body">
          <div className="hud-virtual-qr-container">
            <img src={qrImageUrl} alt="Scan to Join Virtual Meeting" className="hud-virtual-qr-img" />
            <span className="hud-virtual-qr-tag">SCAN TO JOIN 📱</span>
          </div>

          <div className="hud-virtual-info-stack">
            <span className="hud-virtual-platform-tag">{geoData.platformName}</span>
            <span className="hud-virtual-url-preview" title={meetingUrlData}>
              {meetingUrlData.replace(/^https?:\/\//i, '')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    '141 Grove Av, Cedarhurst, NY'
  )}&destination=${encodeURIComponent(geoData.destination.label)}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=3&color=00f0ff&bgcolor=080c18&data=${encodeURIComponent(
    googleMapsUrl
  )}`;

  const travel = geoData.travelTimes || { walk: '18m', bike: '6m', transit: '14m', drive: '5m' };

  // Construct modes array and sort ascending by duration minutes (fastest to slowest, left to right)
  const modes = [
    { key: 'walk', icon: '🚶', label: 'Walk', value: travel.walk, mins: parseDurationToMins(travel.walk) },
    { key: 'bike', icon: '🚴', label: 'Bike', value: travel.bike, mins: parseDurationToMins(travel.bike) },
    { key: 'transit', icon: '🚆', label: 'Transit', value: travel.transit, mins: parseDurationToMins(travel.transit) },
    { key: 'drive', icon: '🚗', label: 'Drive', value: travel.drive, mins: parseDurationToMins(travel.drive) }
  ];

  modes.sort((a, b) => a.mins - b.mins);

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

      {/* Horizontal Multi-Modal Travel Time Bar (Sorted Fastest -> Slowest Left to Right) */}
      <div className="hud-travel-mode-bar">
        {modes.map((m, idx) => (
          <React.Fragment key={m.key}>
            {idx > 0 && <span className="travel-mode-sep">•</span>}
            <div
              className={`travel-mode-item ${idx === 0 ? 'travel-mode-fastest' : ''}`}
              title={`${m.label} Duration`}
            >
              <span className="travel-mode-icon">{m.icon}</span>
              <span className="travel-mode-val">{m.value}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
