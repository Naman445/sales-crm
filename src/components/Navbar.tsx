import React from 'react';
import { LayoutDashboard, ClipboardList, Table2, Briefcase, Package, LogOut, UserCircle } from 'lucide-react';
import { Page, AppUser } from '../types';

interface NavbarProps {
  current: Page;
  onChange: (page: Page) => void;
  user: AppUser;
  onLogout: () => void;
}

const links: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'entry',     label: 'Meeting Entry', icon: <ClipboardList size={18} /> },
  { id: 'dashboard', label: 'Dashboard',     icon: <LayoutDashboard size={18} /> },
  { id: 'table',     label: 'All Meetings',  icon: <Table2 size={18} /> },
  { id: 'inventory', label: 'Inventory',     icon: <Package size={18} /> },
];

const roleBadge: Record<string, string> = {
  Manager: 'bg-purple-400/20 text-purple-200 border-purple-400/40',
  Sales:   'bg-blue-400/20 text-blue-200 border-blue-400/40',
  BD:      'bg-emerald-400/20 text-emerald-200 border-emerald-400/40',
};

export default function Navbar({ current, onChange, user, onLogout }: NavbarProps) {
  return (
    <nav className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight shrink-0">
          <Briefcase size={24} className="text-yellow-300" />
          <span className="hidden sm:inline">Sales<span className="text-yellow-300">CRM</span></span>
        </div>

        {/* Nav links */}
        <div className="flex gap-1 overflow-x-auto">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => onChange(link.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                current === link.id
                  ? 'bg-white text-indigo-700 shadow'
                  : 'text-indigo-100 hover:bg-indigo-500/50'
              }`}
            >
              {link.icon}
              <span className="hidden md:inline">{link.label}</span>
            </button>
          ))}
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <UserCircle size={20} className="text-indigo-300" />
            <div className="text-right">
              <div className="text-white text-xs font-semibold leading-tight truncate max-w-[100px]">
                {user.name}
              </div>
              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleBadge[user.role] || 'bg-white/10 text-white/60 border-white/20'}`}>
                {user.role}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 border border-red-400/20"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline text-xs">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
