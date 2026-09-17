import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Wallet, BarChart3, LogOut, ClipboardList, User, Bell, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications, useMarkNotificationRead } from '../../hooks/useEmployees';

const allMenuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  { path: '/employees', icon: Users, label: 'Employees', roles: ['Admin', 'HR', 'Manager'] },
  { path: '/attendance', icon: CalendarDays, label: 'Attendance', roles: ['Admin', 'HR', 'Manager'] },
  { path: '/leaves', icon: ClipboardList, label: 'Leaves', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  { path: '/payroll', icon: Wallet, label: 'Payroll', roles: ['Admin', 'HR'] },
  { path: '/performance', icon: BarChart3, label: 'Performance', roles: ['Admin', 'HR', 'Manager'] },
  { path: '/me', icon: User, label: 'My Portal', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [showNotif, setShowNotif] = useState(false);

  const menuItems = user ? allMenuItems.filter((item) => item.roles.includes(user.role)) : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const notifications = notifData?.notifications || [];
  const unread = notifData?.unread || 0;

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm shadow-sm">E</div>
            <span className="text-slate-800">EMS Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-500">{user?.role || 'Employee'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors">
            <LogOut className="w-5 h-5 text-slate-400" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-semibold text-slate-800 capitalize">
            {location.pathname.split('/')[1] === 'me' ? 'My Portal' : (location.pathname.split('/')[1] || 'Dashboard')}
          </h1>
          <div className="relative">
            <button onClick={() => setShowNotif(v => !v)} className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-500" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="font-semibold text-slate-800">Notifications</p>
                    <button onClick={() => setShowNotif(false)}><X className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="max-h-80 overflow-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications</p>
                    ) : notifications.map((n: any) => (
                      <div key={n.id} onClick={() => { if (!n.read) { markRead.mutate(n.id); } }}
                        className={`px-4 py-3 text-sm cursor-pointer transition-colors ${n.read ? 'text-slate-500' : 'bg-blue-50/40 text-slate-800'}`}>
                        <p className="font-medium">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
