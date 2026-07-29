'use client';

import React, { useEffect, useRef, useState } from 'react';

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

      // Create map
      mapInstance = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: !L.Browser.mobile,
        scrollWheelZoom: false
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
      const homeMarker = L.marker([origin.lat, origin.lon], { icon: homeIcon }).addTo(mapInstance);
      homeMarker.bindPopup(`<b>HOME</b><br/>141 Grove Av, Cedarhurst, NY`);

      const destMarker = L.marker([destination.lat, destination.lon], { icon: destIcon }).addTo(mapInstance);
      destMarker.bindPopup(`<b>DESTINATION</b><br/>${destination.label}`);

      // Add dashed connection line between Home and Destination
      const line = L.polyline(
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

  return (
    <div className={`hud-mini-map-wrapper ${compact ? 'hud-mini-map-compact' : ''}`}>
      <div className="hud-mini-map-header">
        <span className="hud-mini-map-title">📍 ROUTE RADAR</span>
        <span className="hud-mini-map-badge">⚡ {geoData.formattedDistance}</span>
      </div>

      <div className="hud-mini-map-canvas-container">
        <div ref={mapRef} className="hud-mini-map-canvas" />
      </div>

      <div className="hud-mini-map-footer">
        <span className="hud-mini-map-dest-label" title={geoData.destination.label}>
          TO: {geoData.destination.label}
        </span>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hud-mini-map-nav-btn"
          onClick={(e) => e.stopPropagation()}
        >
          MAPS ↗
        </a>
      </div>
    </div>
  );
}
