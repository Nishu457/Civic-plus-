/* CivicPulse AI — Footer */

import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="container py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-mark.png"
                alt="CivicPulse AI Logo"
                className="w-8 h-8 object-contain rounded-lg ring-1 ring-blue-500/30"
              />
              <div className="flex flex-col leading-none">
                <span className="font-bold text-base text-[#111111]">CivicPulse AI</span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase mt-0.5">
                  People Report • AI Acts • Cleaner Cities
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              AI-powered civic issue reporting with multi-layer evidence verification and explainable priority scoring.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#111111] mb-3">Platform</h4>
            <ul className="space-y-2 list-none p-0">
              <li>
                <Link to="/report" className="text-xs text-gray-500 hover:text-[#2563EB] transition-colors no-underline">
                  Report an Issue
                </Link>
              </li>
              <li>
                <Link to="/explore" className="text-xs text-gray-500 hover:text-[#2563EB] transition-colors no-underline">
                  Explore & Track Issues
                </Link>
              </li>
              <li>
                <Link to="/map" className="text-xs text-gray-500 hover:text-[#2563EB] transition-colors no-underline">
                  Live Geographic Map
                </Link>
              </li>
              <li>
                <Link to="/my-reports" className="text-xs text-gray-500 hover:text-[#2563EB] transition-colors no-underline">
                  Citizen Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Methodology */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#111111] mb-3">Methodology</h4>
            <ul className="space-y-2 list-none p-0 text-xs text-gray-500">
              <li>Binary Magic Bytes & SHA-256</li>
              <li>EXIF Metadata & GPS Distance</li>
              <li>Gemini AI Vision Classification</li>
              <li>0–100 Explainable Priority Engine</li>
            </ul>
          </div>

          {/* Governance */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#111111] mb-3">Governance</h4>
            <ul className="space-y-2 list-none p-0 text-xs text-gray-500">
              <li>No Single-Signal Fraud Verdicts</li>
              <li>Public Data Privacy Protection</li>
              <li>Immutable Admin Audit Logging</li>
              <li>Open Data Sheets Export</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-400">
          <p>
            © {new Date().getFullYear()} CivicPulse AI. Evidence-first civic priority intelligence.
          </p>
          <p className="text-center sm:text-right">
            Prototype deployment. Data processed with privacy protection.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
