/* CivicPulse AI — Interactive Map View */

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, ArrowRight, Crosshair, Loader2, X
} from 'lucide-react';
import { listReports } from '../services/api';
import type { ReportListItem } from '../types';
import { CATEGORIES, STATUS_LABELS } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(null);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);

  // Default center: Vijayawada, Andhra Pradesh, India
  const DEFAULT_CENTER: [number, number] = [16.5062, 80.6480];
  const DEFAULT_ZOOM = 10;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    // Clean OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fetch reports
  useEffect(() => {
    setLoading(true);
    listReports({
      page: 1,
      page_size: 100,
      category: category || undefined,
      status: status || undefined,
    })
      .then((res) => {
        setReports(res.reports || []);
      })
      .catch((err) => console.error('Failed to load map reports:', err))
      .finally(() => setLoading(false));
  }, [category, status]);

  // Update map markers when reports change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    const validReports = reports.filter(
      (r) => r.latitude != null && r.longitude != null
    );

    const bounds: [number, number][] = [];

    validReports.forEach((r) => {
      const lat = r.latitude!;
      const lng = r.longitude!;
      bounds.push([lat, lng]);

      const isSelected = selectedReport?.report_id === r.report_id;
      const score = r.priority_score ?? 50;

      // Color scheme: Selected is electric blue, otherwise black to gray based on priority
      let markerColor = '#111111';
      if (isSelected) {
        markerColor = '#2563EB';
      } else if (score >= 80) {
        markerColor = '#111111';
      } else if (score >= 60) {
        markerColor = '#3F3F46';
      } else {
        markerColor = '#71717A';
      }

      // SVG DivIcon
      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background-color: ${markerColor};
            width: ${isSelected ? '32px' : '26px'};
            height: ${isSelected ? '32px' : '26px'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: ${isSelected ? '0 0 0 3px rgba(37,99,235,0.4), 0 3px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.25)'};
            cursor: pointer;
            transition: all 0.15s ease;
          ">
            <span style="
              transform: rotate(45deg);
              color: white;
              font-size: ${isSelected ? '11px' : '9px'};
              font-weight: 700;
              font-family: monospace;
            ">${score}</span>
          </div>
        `,
        iconSize: isSelected ? [32, 32] : [26, 26],
        iconAnchor: isSelected ? [16, 32] : [13, 26],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([lat, lng], { icon });

      marker.on('click', () => {
        setSelectedReport(r);
        mapInstanceRef.current?.panTo([lat, lng]);
      });

      layer.addLayer(marker);
    });

    if (bounds.length > 0 && !selectedReport) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [reports, selectedReport]);

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.flyTo([latitude, longitude], 14);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation failed:', err);
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col">
      {/* Top Filter Floating Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] max-w-3xl mx-auto flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm p-2 rounded-lg border border-gray-200 shadow-sm flex flex-wrap items-center gap-2 pointer-events-auto w-full sm:w-auto">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input py-1 px-2.5 text-xs w-full sm:w-40 font-medium cursor-pointer"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORIES).map(([k, cat]) => (
              <option key={k} value={k}>{cat.label}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input py-1 px-2.5 text-xs w-full sm:w-36 font-medium cursor-pointer"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          <button
            onClick={handleLocateMe}
            disabled={locating}
            className="btn-secondary btn-sm py-1 px-2.5 text-xs flex items-center gap-1.5 hover:text-[#2563EB] hover:border-[#2563EB]"
            title="Center on my current location"
          >
            {locating ? <Loader2 size={13} className="animate-spin text-[#2563EB]" /> : <Crosshair size={13} />}
            My Location
          </button>

          <span className="text-[11px] text-gray-500 ml-auto sm:ml-2 hidden sm:inline font-mono">
            {loading ? 'Plotting...' : `${reports.filter(r => r.latitude != null).length} mapped`}
          </span>
        </div>
      </div>

      {/* Map Leaflet Container */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Selected Report Floating Card */}
      {selectedReport && (
        <div className="absolute bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-96 z-[1000] fade-in">
          <div className="card p-4 card-elevated bg-white border border-gray-200 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-semibold text-[#111111]">
                  {selectedReport.report_id}
                </span>
                <span className="badge badge-outline text-[10px]">
                  {selectedReport.category_label}
                </span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 text-gray-400 hover:text-black border-0 bg-transparent cursor-pointer"
                aria-label="Close card"
              >
                <X size={15} />
              </button>
            </div>

            <h3 className="font-bold text-sm text-[#111111] line-clamp-2">
              {selectedReport.title}
            </h3>

            {selectedReport.address && (
              <p className="text-xs text-gray-500 flex items-center gap-1 line-clamp-1">
                <MapPin size={12} className="shrink-0 text-[#2563EB]" /> {selectedReport.address}
              </p>
            )}

            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Priority</span>
                <span className="font-bold font-mono text-sm text-[#111111]">
                  {selectedReport.priority_score ?? '—'}/100
                </span>
              </div>
              <Link
                to={`/report/${selectedReport.report_id}`}
                className="btn-primary btn-sm py-1.5 px-3 text-xs no-underline inline-flex items-center gap-1"
              >
                View Details <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
