/* CivicPulse AI — Landing Page */

import { Link } from 'react-router-dom';
import {
  Camera,
  MapPin,
  BarChart3,
  ArrowRight,
  Scan,
  Brain,
  FileSearch,
  Zap,
  Eye,
  Lock,
} from 'lucide-react';
import { CATEGORIES } from '../types';
import { useEffect, useState, useRef } from 'react';
import { listReports } from '../services/api';

const Landing = () => {
  const heroRef = useRef<HTMLElement | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    categoriesCount: number;
    withImages: number;
    loaded: boolean;
  }>({ total: 0, categoriesCount: 0, withImages: 0, loaded: false });

  const handleHeroPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    heroRef.current.style.setProperty('--hero-x', `${x}px`);
    heroRef.current.style.setProperty('--hero-y', `${y}px`);
    heroRef.current.style.setProperty('--hero-opacity', '1');
  };

  const handleHeroPointerLeave = () => {
    if (!heroRef.current) return;
    heroRef.current.style.setProperty('--hero-opacity', '0');
  };

  useEffect(() => {
    listReports({ page: 1, page_size: 50 })
      .then((data) => {
        const uniqueCategories = new Set(data.reports.map((r) => r.category)).size;
        const withImages = data.reports.filter((r) => r.has_image).length;
        setStats({
          total: data.total,
          categoriesCount: uniqueCategories || Object.keys(CATEGORIES).length,
          withImages,
          loaded: true,
        });
      })
      .catch(() => {
        setStats({ total: 0, categoriesCount: 0, withImages: 0, loaded: true });
      });
  }, []);

  return (
    <div className="fade-in">
      {/* ── Hero ──────────────────────────────────────── */}
      <section
        ref={heroRef}
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
        className="relative py-16 sm:py-24 lg:py-28 border-b border-gray-100 overflow-hidden"
      >
        {/* Subtle cursor-following radial glow */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: 'var(--hero-opacity, 0)',
            background:
              'radial-gradient(550px circle at var(--hero-x, 50%) var(--hero-y, 50%), rgba(37, 99, 235, 0.08), rgba(34, 211, 238, 0.04) 40%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div className="container relative z-10 text-center max-w-3xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative mb-3 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-600 rounded-2xl blur-md opacity-30 group-hover:opacity-60 transition duration-500" />
              <img
                src="/logo-mark.png"
                alt="CivicPulse AI Logo"
                className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl shadow-xl ring-2 ring-blue-500/30"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 badge-accent px-3 py-1">
              <Zap size={13} className="text-[#2563EB]" />
              <span>Civic Problem Priority Engine</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#111111] mb-5 leading-tight">
            Evidence-Driven Civic Reporting for Smarter Public Action
          </h1>

          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Report local public hazards with verified photos and GPS accuracy.
            Our explainable AI priority engine ensures urgent community issues get noticed and resolved first.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/report"
              className="btn-primary btn-lg w-full sm:w-auto no-underline flex items-center justify-center gap-2"
            >
              Report an Issue
              <ArrowRight size={17} />
            </Link>
            <Link
              to="/explore"
              className="btn-secondary btn-lg w-full sm:w-auto no-underline flex items-center justify-center"
            >
              Explore Issues
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50/60 border-b border-gray-200">
        <div className="container px-4">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
              Transparent Methodology
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] mt-1.5 mb-3">
              How CivicPulse Works
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              From on-site photo capture to explainable priority triage — built on objective signals, not arbitrary votes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Camera size={22} className="text-[#111111]" />,
                step: '01',
                title: 'Capture Evidence',
                desc: 'Upload a clear photo. Original camera captures preserve EXIF timestamps and device provenance.',
              },
              {
                icon: <MapPin size={22} className="text-[#111111]" />,
                step: '02',
                title: 'Pin Location',
                desc: 'Precise coordinates cross-referenced against EXIF GPS to detect geographic discrepancies.',
              },
              {
                icon: <Brain size={22} className="text-[#2563EB]" />,
                step: '03',
                title: 'Gemini AI Vision',
                desc: 'Vision models classify hazard type, severity level, and verify photo relevance objectively.',
              },
              {
                icon: <BarChart3 size={22} className="text-[#111111]" />,
                step: '04',
                title: 'Priority Score (0–100)',
                desc: 'Transparent formula weighing safety risks, evidence quality, and municipal urgency.',
              },
            ].map((item, i) => (
              <div key={i} className="card p-6 bg-white hover:border-gray-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="font-mono text-xs font-bold text-gray-400">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[#111111] mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Issue Categories ─────────────────────────── */}
      <section className="py-16 sm:py-20 border-b border-gray-200">
        <div className="container px-4">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
              Coverage Areas
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] mt-1.5 mb-3">
              Civic Issue Categories
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Select a category below to submit an issue or view existing reports in Andhra Pradesh.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <Link
                key={key}
                to={`/explore?category=${key}`}
                className="card p-5 hover:border-[#2563EB] transition-all no-underline group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-[#111111] group-hover:text-[#2563EB] transition-colors">
                    {cat.label}
                  </h4>
                  <span className="w-2 h-2 rounded-full bg-gray-200 group-hover:bg-[#2563EB] transition-colors" />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Multi-Layer Verification Pillars ──────────── */}
      <section className="py-16 sm:py-20 bg-gray-50/60 border-b border-gray-200">
        <div className="container px-4">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
              Trust & Integrity
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] mt-1.5 mb-3">
              6-Layer Evidence Verification
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              CivicPulse AI treats evidence as multi-factor signals rather than simplistic binary verdicts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <Scan size={18} className="text-[#2563EB]" />,
                title: 'File & Binary Integrity',
                desc: 'True MIME verification, binary magic bytes check, and clean re-encoding to strip malicious scripts.',
              },
              {
                icon: <FileSearch size={18} className="text-[#111111]" />,
                title: 'EXIF Metadata Analysis',
                desc: 'Device model and capture timestamps are analyzed. Missing EXIF (e.g. from WhatsApp) is not penalized.',
              },
              {
                icon: <MapPin size={18} className="text-[#2563EB]" />,
                title: 'Location Distance Cross-Check',
                desc: 'Haversine distance comparison between EXIF GPS and reported location flags discrepancies with transparency.',
              },
              {
                icon: <Eye size={18} className="text-[#111111]" />,
                title: 'Duplicate & Hash Matching',
                desc: 'Cryptographic SHA-256 and perceptual dhash detect repeated images across multiple submissions.',
              },
              {
                icon: <Brain size={18} className="text-[#2563EB]" />,
                title: 'Gemini AI Vision Classification',
                desc: 'Objective automated hazard analysis detects category mismatches, spam, and severity grades.',
              },
              {
                icon: <Lock size={18} className="text-[#111111]" />,
                title: 'Privacy & Governance',
                desc: 'EXIF is stripped from all public URLs. Full immutable audit trail records all administrative updates.',
              },
            ].map((pillar, i) => (
              <div key={i} className="card p-5 bg-white">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    {pillar.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#111111] mb-1">{pillar.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{pillar.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Real Platform Statistics ─────────────────── */}
      <section className="py-16 sm:py-20 border-b border-gray-200">
        <div className="container px-4">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
              Live Metrics
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] mt-1.5 mb-2">
              System Activity & Verification
            </h2>
            <p className="text-xs text-gray-400">
              Real metrics from the CivicPulse database engine
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="card p-6 text-center">
              <div className="text-3xl font-bold font-mono text-[#111111] mb-1">
                {stats.loaded ? stats.total : '...'}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Reports Logged</div>
            </div>

            <div className="card p-6 text-center">
              <div className="text-3xl font-bold font-mono text-[#2563EB] mb-1">
                {stats.loaded ? stats.withImages : '...'}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">With Photo Evidence</div>
            </div>

            <div className="card p-6 text-center">
              <div className="text-3xl font-bold font-mono text-[#111111] mb-1">
                {stats.loaded ? stats.categoriesCount : '...'}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Active Categories</div>
            </div>

            <div className="card p-6 text-center">
              <div className="text-3xl font-bold font-mono text-[#111111] mb-1">
                100%
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Audit Logged</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-[#111111] text-white">
        <div className="container text-center max-w-xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-white">
            Have a Public Issue to Report?
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mb-8 leading-relaxed">
            Take a photo, capture the GPS location, and submit your report in under 2 minutes.
            Your evidence directly informs community priorities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/report"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Report an Issue Now
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/map"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-lg transition-colors no-underline border border-white/20"
            >
              View Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
