import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User, Home } from 'lucide-react';

interface HTELayoutProps {
  children: React.ReactNode;
  hteCompany?: string;
}

export function HTELayout({ children, hteCompany = 'HTE Dashboard' }: HTELayoutProps) {
  const navigate = useNavigate();
  const hteUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const handleLogout = () => {
    // Clear JWT tokens from localStorage
    localStorage.removeItem('ojt_jwt_access_token');
    localStorage.removeItem('ojt_jwt_refresh_token');
    localStorage.removeItem('ojt_hte_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Home className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-gray-900 font-bold">HTE Manager</h1>
                <p className="text-xs text-gray-500">{hteCompany}</p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/hte/settings')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={20} className="text-gray-600" />
              </button>
              <button
                onClick={() => navigate('/hte/profile')}
                className="w-10 h-10 hover:bg-gray-100 rounded-full transition-all overflow-hidden flex items-center justify-center border border-gray-200"
                title="Profile"
              >
                {hteUser?.photo ? (
                  <img src={hteUser.photo} alt={hteUser.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-gray-600" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
