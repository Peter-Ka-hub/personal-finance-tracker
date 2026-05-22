import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Wallet, LogOut, Settings, LayoutDashboard, BarChart3 } from "lucide-react";

export default function Layout({ onLogout }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12">
      {/* Nawigacja */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl hover:text-blue-700 transition-colors">
            <Wallet size={24} />
            <span>Finance Tracker</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <Link 
              to="/" 
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Pulpit</span>
            </Link>
            <Link 
              to="/charts" 
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/charts' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Wykresy</span>
            </Link>
            <Link 
              to="/categories" 
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/categories' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Settings size={18} />
              <span className="hidden sm:inline">Kategorie</span>
            </Link>
            
            <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
            
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center gap-2"
              title="Wyloguj"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline text-sm font-medium">Wyloguj</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        <Outlet />
      </main>
    </div>
  );
}
