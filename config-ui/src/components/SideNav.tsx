import React from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface SideNavProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SideNav: React.FC<SideNavProps> = ({ items, activeTab, onTabChange }) => {
  return (
    <aside className="w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800/50 min-h-screen flex flex-col sticky top-0 shadow-2xl">
      {/* Logo Section */}
      <div className="px-8 pt-8 pb-6 border-b border-slate-800/30">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🚀</span>
          <h1 className="text-xl font-black tracking-tight text-white">MCP Config</h1>
        </div>
        <p className="text-xs text-slate-500 font-medium">Configuration Manager</p>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-8">
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="px-8 py-6 border-t border-slate-800/30 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Hot Reload Active</span>
        </div>
        <div className="pt-2 border-t border-slate-800/30">
          <p className="text-xs text-slate-600 font-medium">Version</p>
          <p className="text-xs text-slate-400 mt-1">v0.3.15</p>
        </div>
      </div>
    </aside>
  );
};
