import { Database, Server, Wrench, FileText, Circle, Shield, LogOut, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import type { TabType } from '../types';
import { useAuth } from './AuthProvider';
import packageJson from '../../package.json';

interface SideNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isLive?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SideNav({ activeTab, onTabChange, isLive = true, collapsed, onToggleCollapse }: SideNavProps) {
  const { username, authEnabled, logout } = useAuth();

  const navItems = [
    { id: 'server' as TabType, label: 'Server', icon: Server },
    { id: 'instances' as TabType, label: 'Instances', icon: Database },
    { id: 'tools' as TabType, label: 'Tools', icon: Wrench },
    { id: 'prompts' as TabType, label: 'Prompts', icon: FileText },
    { id: 'security' as TabType, label: 'Security', icon: Shield },
  ];

  return (
    <div
      className={`h-screen bg-gray-900 text-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`border-b border-gray-800 flex items-center ${collapsed ? 'p-3 justify-center' : 'p-6 justify-between'}`}>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">MCP Config</h1>
            <p className="text-sm text-gray-400 mt-1">v{packageJson.version}</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg transition-all duration-200 ${
                collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
              } ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-gray-800 py-3 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
        {/* Documentation link */}
        <a
          href="/docs/"
          target="_blank"
          rel="noopener noreferrer"
          title="Documentation"
          className={`flex items-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors py-2 ${
            collapsed ? 'justify-center px-2' : 'gap-2 px-2'
          }`}
        >
          <BookOpen size={16} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm">Documentation</span>}
        </a>

        {/* Live indicator */}
        <div className={`flex items-center py-2 ${collapsed ? 'justify-center' : 'gap-2 px-2'}`} title={isLive ? 'Hot Reload Active' : 'Disconnected'}>
          <Circle
            className={`flex-shrink-0 ${isLive ? 'text-green-500 fill-green-500' : 'text-gray-500 fill-gray-500'}`}
            size={8}
          />
          {!collapsed && (
            <span className="text-sm text-gray-400">
              {isLive ? 'Hot Reload Active' : 'Disconnected'}
            </span>
          )}
        </div>

        {/* User / logout */}
        {authEnabled && username && (
          collapsed ? (
            <button
              onClick={logout}
              className="w-full flex justify-center p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
              title={`Sign out (${username})`}
            >
              <LogOut size={16} />
            </button>
          ) : (
            <div className="px-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 truncate" title={username}>
                  {username}
                </span>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all flex-shrink-0"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
