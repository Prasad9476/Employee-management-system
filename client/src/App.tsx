import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import ChangePassword from './components/Auth/ChangePassword';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeesList from './components/Employees/EmployeesList';
import EmployeeProfile from './components/Employees/EmployeeProfile';
import MyPortal from './components/SelfService/MyPortal';
import Attendance from './components/Attendance/Attendance';
import Leaves from './components/Leaves/Leaves';
import Payroll from './components/Payroll/Payroll';
import Performance from './components/Performance/Performance';
import { ShieldAlert, LogIn } from 'lucide-react';

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-800">You don't have access</h2>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">
        This area requires a different role. Ask your administrator if you believe this is a mistake.
      </p>
      <Link to="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
        <LogIn className="w-4 h-4" /> Back to dashboard
      </Link>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isChecking } = useAuth();
  if (isChecking) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PasswordGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

const routeRoles: Record<string, string[]> = {
  employees: ['Admin', 'HR', 'Manager'],
  attendance: ['Admin', 'HR', 'Manager'],
  payroll: ['Admin', 'HR'],
  performance: ['Admin', 'HR', 'Manager'],
};

function RoleRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const allowed = routeRoles[path];
  if (allowed && (!user || !allowed.includes(user.role))) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

function App() {
  const { checkAuth, isAuthenticated } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<PasswordGate><Dashboard /></PasswordGate>} />
          <Route path="employees" element={<PasswordGate><RoleRoute path="employees"><EmployeesList /></RoleRoute></PasswordGate>} />
          <Route path="employees/:id" element={<PasswordGate><RoleRoute path="employees"><EmployeeProfile /></RoleRoute></PasswordGate>} />
          <Route path="me" element={<PasswordGate><MyPortal /></PasswordGate>} />
          <Route path="attendance" element={<PasswordGate><RoleRoute path="attendance"><Attendance /></RoleRoute></PasswordGate>} />
          <Route path="leaves" element={<PasswordGate><Leaves /></PasswordGate>} />
          <Route path="payroll" element={<PasswordGate><RoleRoute path="payroll"><Payroll /></RoleRoute></PasswordGate>} />
          <Route path="performance" element={<PasswordGate><RoleRoute path="performance"><Performance /></RoleRoute></PasswordGate>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;