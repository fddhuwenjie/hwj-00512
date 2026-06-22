import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  CalendarCheck,
  ClipboardList,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await api.auth.logout();
    logout();
    navigate('/login');
  };

  const allNavItems = [
    { path: '/', label: '首页', icon: LayoutDashboard, roles: ['admin', 'counselor', 'client'] },
    { path: '/counselors', label: '咨询师管理', icon: Users, roles: ['admin', 'counselor'] },
    { path: '/clients', label: '来访者档案', icon: UserCircle, roles: ['admin', 'counselor'] },
    { path: '/profile', label: '我的档案', icon: UserCircle, roles: ['client'] },
    { path: '/appointments', label: '预约管理', icon: CalendarCheck, roles: ['admin', 'counselor', 'client'] },
    { path: '/assessments', label: '量表评估', icon: ClipboardList, roles: ['admin', 'counselor', 'client'] },
    { path: '/session-records', label: '咨询记录', icon: FileText, roles: ['admin', 'counselor', 'client'] },
    { path: '/statistics', label: '统计报表', icon: BarChart3, roles: ['admin', 'counselor'] },
  ];

  const navItems = user ? allNavItems.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full">
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-blue-600">心理咨询中心</h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-medium">{user?.name?.[0] || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.role === 'admin' ? '管理员' : user?.role === 'counselor' ? '咨询师' : '来访者'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                退出登录
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 flex items-center px-4 sm:px-6 bg-white border-b border-gray-200">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 mr-2"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">心理咨询预约管理系统</h2>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
