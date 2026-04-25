import { useState, useEffect } from 'react';
import { AuthProvider } from './components/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { SideNav } from './components/SideNav';
import { InstancesTab } from './components/tabs/InstancesTab';
import { ServerTab } from './components/tabs/ServerTab';
import { ToolsTab } from './components/tabs/ToolsTab';
import { PromptsTab } from './components/tabs/PromptsTab';
import { SecurityTab } from './components/tabs/SecurityTab';
import { Loader2 } from 'lucide-react';
import type { TabType } from './types';

const SIDEBAR_COLLAPSED_KEY = 'mcp_sidebar_collapsed';
const SMALL_SCREEN_BREAKPOINT = 768;

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('server');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => window.innerWidth < SMALL_SCREEN_BREAKPOINT || localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  );
  // Track whether collapse was triggered by screen size (vs manual toggle)
  const [autoCollapsed, setAutoCollapsed] = useState<boolean>(
    () => window.innerWidth < SMALL_SCREEN_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      const isSmall = window.innerWidth < SMALL_SCREEN_BREAKPOINT;
      if (isSmall) {
        // Auto-collapse on small screens
        setSidebarCollapsed(true);
        setAutoCollapsed(true);
      } else if (autoCollapsed) {
        // Restore user preference when screen grows back
        const userPref = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        setSidebarCollapsed(userPref);
        setAutoCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      setAutoCollapsed(false);
      return next;
    });
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'instances':
        return <InstancesTab />;
      case 'server':
        return <ServerTab />;
      case 'tools':
        return <ToolsTab />;
      case 'prompts':
        return <PromptsTab />;
      case 'security':
        return <SecurityTab />;
      default:
        return <ServerTab />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isLive={true}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
