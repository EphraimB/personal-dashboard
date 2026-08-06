'use client';

import React, { useEffect, useRef, useState } from 'react';

const WalkIcon = () => (
  <svg className="travel-mode-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 9.8V14h2V9.9l1.8-.7z"/>
  </svg>
);

const BikeIcon = () => (
  <svg className="travel-mode-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm8.8-6.2l-1.4-2.4c-.4-.7-1.1-1.2-1.9-1.4l-2.6-.5c-.8-.2-1.6.2-2 1l-1.3 2.6 1.8.9 1.1-2.2 1.5.3-2.6 5.2h2.2l1.6-3.2 2 2.5V22h2v-6.5l-2.4-3.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
  </svg>
);

const TransitIcon = () => (
  <svg className="travel-mode-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M12 2c-4.4 0-8 .5-8 4v9.5C4 17.4 5.6 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.9 0 3.5-1.6 3.5-3.5V6c0-3.5-3.6-4-8-4zm-4.5 15c-.8 0-1.5-.7-1.5-1.5S6.7 14 7.5 14s1.5.7 1.5 1.5S8.3 17 7.5 17zm9 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
  </svg>
);

const DriveIcon = () => (
  <svg className="travel-mode-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
  </svg>
);

function parseDurationToMins(durStr) {
  if (!durStr || durStr === 'N/A' || durStr === '-') return 99999;
  if (durStr.includes('< 1m')) return 0.5;
  let total = 0;
  const hMatch = durStr.match(/(\d+)\s*h/);
  const mMatch = durStr.match(/(\d+)\s*m/);
  if (hMatch) total += parseInt(hMatch[1], 10) * 60;
  if (mMatch) total += parseInt(mMatch[1], 10);
  return total > 0 ? total : 99999;
}

export default function LocationMiniMap({ location, meetingUrl = '', compact = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Default Home Base: 141 Grove Av, Cedarhurst, NY
  const HOME_COORDS = { lat: 40.6253378, lon: -73.7206490 };

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
    if (geoData && geoData.isVirtual) return;

    let mapInstance = null;
    let timerId = null;

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
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }

      const isRouteMap = geoData && geoData.valid && !geoData.isVirtual;
      const origin = isRouteMap ? geoData.origin : HOME_COORDS;
      const destination = isRouteMap ? geoData.destination : null;

      // Create static read-only TV map
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

      mapInstanceRef.current = mapInstance;

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

      L.marker([origin.lat, origin.lon], { icon: homeIcon }).addTo(mapInstance);

      if (isRouteMap && destination) {
        // Custom Destination Icon (Cyan Neon)
        const destIcon = L.divIcon({
          className: 'hud-map-pin pin-dest',
          html: `<div class="pin-marker dest-marker" title="${destination.label}">📍</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        });

        L.marker([destination.lat, destination.lon], { icon: destIcon }).addTo(mapInstance);

        // Add dashed connection line
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

        const bounds = L.latLngBounds([
          [origin.lat, origin.lon],
          [destination.lat, destination.lon]
        ]);
        mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });

        timerId = setTimeout(() => {
          if (mapInstanceRef.current === mapInstance && mapRef.current) {
            try {
              mapInstance.invalidateSize();
              mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
            } catch (e) {}
          }
        }, 150);
      } else {
        // Standby Mode: Center on Home (141 Grove Av, Cedarhurst)
        mapInstance.setView([HOME_COORDS.lat, HOME_COORDS.lon], 14);

        timerId = setTimeout(() => {
          if (mapInstanceRef.current === mapInstance && mapRef.current) {
            try {
              mapInstance.invalidateSize();
              mapInstance.setView([HOME_COORDS.lat, HOME_COORDS.lon], 14);
            } catch (e) {}
          }
        }, 150);
      }
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [geoData]);

  // Render Virtual Meeting HUD Card with Scan-to-Join QR Code for Online Events (Full-Card 100% Fill)
  if (geoData && geoData.isVirtual) {
    const meetingUrlData = geoData.meetingUrl || meetingUrl || 'https://zoom.us';
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=2&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
      meetingUrlData
    )}`;

    return (
      <div className={`hud-mini-map-wrapper hud-virtual-wrapper ${compact ? 'hud-mini-map-compact' : ''}`}>
        <div className="hud-mini-map-header hud-virtual-header">
          <span className="hud-mini-map-title" style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--color-cyan)', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            {geoData.platformName.toUpperCase()} // REMOTE HUD
          </span>
          <span className="hud-virtual-status-badge">● ONLINE MEETING</span>
        </div>

        <div className="hud-virtual-body">
          <div className="hud-virtual-qr-container">
            <img src={qrImageUrl} alt="Scan to Join Virtual Meeting" className="hud-virtual-qr-img" />
            <span className="hud-virtual-qr-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 18h3v3h-3z" />
              </svg>
              SCAN TO JOIN MEETING
            </span>
          </div>

          <div className="hud-virtual-info-stack">
            <span className="hud-virtual-platform-tag">{geoData.platformName} LINK</span>
            <span className="hud-virtual-url-preview" title={meetingUrlData}>
              {meetingUrlData.replace(/^https?:\/\/(www\.)?/i, '')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isRouteActive = geoData && geoData.valid && !geoData.isVirtual;
  const isUnmapped = location && location.trim() && (!geoData || !geoData.valid);

  const googleMapsUrl = isRouteActive
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        '141 Grove Av, Cedarhurst, NY'
      )}&destination=${encodeURIComponent(geoData.destination.label)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || '141 Grove Av, Cedarhurst, NY')}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=2&color=00f0ff&bgcolor=080c18&data=${encodeURIComponent(
    googleMapsUrl
  )}`;

  const travel = (isRouteActive && geoData.travelTimes) || { walk: '18m', bike: '6m', transit: '14m', drive: '5m' };

  const modes = [
    { key: 'walk', IconComponent: WalkIcon, label: 'Walk', value: travel.walk, mins: parseDurationToMins(travel.walk) },
    { key: 'bike', IconComponent: BikeIcon, label: 'Bike', value: travel.bike, mins: parseDurationToMins(travel.bike) },
    { key: 'transit', IconComponent: TransitIcon, label: 'Transit', value: travel.transit, mins: parseDurationToMins(travel.transit) },
    { key: 'drive', IconComponent: DriveIcon, label: 'Drive', value: travel.drive, mins: parseDurationToMins(travel.drive) }
  ];

  modes.sort((a, b) => a.mins - b.mins);

  return (
    <div className={`hud-mini-map-wrapper ${compact ? 'hud-mini-map-compact' : ''}`}>
      <div className="hud-mini-map-header">
        <span className="hud-mini-map-title">
          {isRouteActive ? '📍 ROUTE RADAR' : isUnmapped ? '⚠️ UNMAPPED RADAR' : '🏠 HOME BASE RADAR'}
        </span>
        <span className={isUnmapped ? 'hud-mini-map-badge badge-warning' : 'hud-mini-map-badge'}>
          {isRouteActive ? `⚡ ${geoData.formattedDistance}` : isUnmapped ? 'GEOCODE UNRESOLVED' : 'CEDARHURST, NY'}
        </span>
      </div>

      <div className="hud-mini-map-canvas-container">
        <div ref={mapRef} className="hud-mini-map-canvas" />

        {/* Visual Cue Banner for Unmapped / Unresolved Locations */}
        {isUnmapped && (
          <div className="hud-unmapped-banner">
            ⚠️ UNABLE TO MAP ADDRESS: "{location}"
          </div>
        )}

        {/* Scan-to-Navigate 180px QR Code Badge for 8-10ft TV Kiosk Phone Camera Scanning */}
        <div className="hud-mini-map-qr-badge" title="Scan with Phone Camera for Directions">
          <img src={qrImageUrl} alt="Scan QR Code for Directions" className="hud-qr-img" />
          <span className="hud-qr-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 18h3v3h-3z" />
            </svg>
            {isRouteActive ? 'SCAN NAV' : 'GPS NAV // 141 GROVE'}
          </span>
        </div>
      </div>

      {/* Horizontal Multi-Modal Travel Time Bar */}
      {isRouteActive && (
        <div className="hud-travel-mode-bar">
          {modes.map((m, idx) => {
            const IconComp = m.IconComponent;
            return (
              <React.Fragment key={m.key}>
                {idx > 0 && <span className="travel-mode-sep">•</span>}
                <div
                  className={`travel-mode-item ${idx === 0 ? 'travel-mode-fastest' : ''}`}
                  title={`${m.label} Duration`}
                >
                  <span className="travel-mode-icon">
                    <IconComp />
                  </span>
                  <span className="travel-mode-val">{m.value}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
