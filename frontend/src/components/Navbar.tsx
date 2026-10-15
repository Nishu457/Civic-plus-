/* CivicPulse AI — Navigation Header */

import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, User, Shield, FileText, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Close mobile menu on route change or Escape key
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/explore', label: 'Explore Issues' },
    { path: '/map', label: 'Map View' },
    { path: '/report', label: 'Report Issue' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-md p-1"
          aria-label="CivicPulse AI Home"
        >
          <div className="w-8 h-8 bg-[#111111] rounded-lg flex items-center justify-center relative">
            <span className="text-white font-bold text-xs tracking-wider">CP</span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#2563EB]" />
          </div>
          <span className="font-bold text-base tracking-tight text-[#111111]">
            CivicPulse
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB] ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
              AI
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  active
                    ? 'text-[#2563EB] font-semibold bg-blue-50/70'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#111111]'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#2563EB] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                to="/my-reports"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  isActive('/my-reports')
                    ? 'text-[#2563EB] font-semibold bg-blue-50/70'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#111111]'
                }`}
              >
                <FileText size={16} />
                My Reports
              </Link>

              <Link
                to="/profile"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  isActive('/profile')
                    ? 'text-[#2563EB] font-semibold bg-blue-50/70'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#111111]'
                }`}
                title="Citizen Profile & Verification"
              >
                <UserCheck size={16} className={user?.isVerified ? "text-[#2563EB]" : "text-gray-500"} />
                <span>Profile</span>
                {user?.isVerified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Verified Citizen" />
                )}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    isActive('/admin')
                      ? 'text-[#2563EB] font-semibold bg-blue-50/70'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-[#111111]'
                  }`}
                >
                  <Shield size={16} />
                  Admin
                </Link>
              )}

              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#111111] transition-colors border-0 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                title="Sign out of your session"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="btn-primary btn-sm no-underline"
            >
              <User size={15} />
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-[#111111] transition-colors border-0 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="container py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-md text-sm font-medium min-h-[44px] no-underline transition-colors ${
                    active
                      ? 'text-[#2563EB] bg-blue-50/80 font-semibold border-l-4 border-[#2563EB]'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-[#111111]'
                  }`}
                >
                  <span>{link.label}</span>
                  {active && <span className="w-2 h-2 rounded-full bg-[#2563EB]" />}
                </Link>
              );
            })}

            <div className="border-t border-gray-100 mt-2 pt-2 flex flex-col gap-1">
              {user ? (
                <>
                  <Link
                    to="/my-reports"
                    className={`flex items-center gap-2 px-3.5 py-3 rounded-md text-sm font-medium min-h-[44px] no-underline ${
                      isActive('/my-reports')
                        ? 'text-[#2563EB] bg-blue-50/80 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FileText size={16} /> My Reports
                  </Link>

                  <Link
                    to="/profile"
                    className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-md text-sm font-medium min-h-[44px] no-underline ${
                      isActive('/profile')
                        ? 'text-[#2563EB] bg-blue-50/80 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <UserCheck size={16} className={user?.isVerified ? "text-[#2563EB]" : "text-gray-500"} /> Profile & Verification
                    </span>
                    {user?.isVerified && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Verified
                      </span>
                    )}
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`flex items-center gap-2 px-3.5 py-3 rounded-md text-sm font-medium min-h-[44px] no-underline ${
                        isActive('/admin')
                          ? 'text-[#2563EB] bg-blue-50/80 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Shield size={16} /> Admin Dashboard
                    </Link>
                  )}

                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-3.5 py-3 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 w-full min-h-[44px] border-0 bg-transparent cursor-pointer text-left"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary w-full min-h-[44px] no-underline mt-1"
                >
                  <User size={16} /> Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
