import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AdminDashboard,
  AdminWorkersPage,
  AvailabilityPage,
  BookingsPage,
  ComplaintsPage,
  CustomerDashboard,
  EarningsPage,
  LoginPage,
  ProfilePage,
  RequestsPage,
  ServicesPage,
  WorkerDashboard,
} from '@/pages/app-pages';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function RoleGate({ role, children }: { role: 'customer' | 'worker' | 'cooperative_admin'; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const storedRole = typeof window !== 'undefined' ? window.localStorage.getItem('coopwork-role') : null;
  const activeRole = storedRole || 'customer';
  useEffect(() => {
    if (activeRole !== role) {
      setLocation(activeRole === 'worker' ? '/worker/dashboard' : activeRole === 'cooperative_admin' ? '/admin/dashboard' : '/dashboard');
    }
  }, [activeRole, role, setLocation]);
  if (activeRole !== role) return <div className="min-h-[100dvh] grid place-items-center"><div className="skeleton" style={{ width: 170, height: 28 }} /></div>;
  return <>{children}</>;
}

function Home() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/login'); }, [setLocation]);
  return <div className="min-h-[100dvh] grid place-items-center"><div className="skeleton" style={{ width: 170, height: 28 }} /></div>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={LoginPage} />
        <Route path="/dashboard" component={() => <RoleGate role="customer"><CustomerDashboard /></RoleGate>} />
        <Route path="/services" component={ServicesPage} />
        <Route path="/bookings" component={() => <BookingsPage />} />
        <Route path="/complaints" component={ComplaintsPage} />
        <Route path="/worker/dashboard" component={() => <RoleGate role="worker"><WorkerDashboard /></RoleGate>} />
        <Route path="/worker/requests" component={() => <RoleGate role="worker"><RequestsPage /></RoleGate>} />
        <Route path="/worker/bookings" component={() => <RoleGate role="worker"><BookingsPage workerView /></RoleGate>} />
        <Route path="/worker/availability" component={() => <RoleGate role="worker"><AvailabilityPage /></RoleGate>} />
        <Route path="/worker/earnings" component={() => <RoleGate role="worker"><EarningsPage /></RoleGate>} />
        <Route path="/admin/dashboard" component={() => <RoleGate role="cooperative_admin"><AdminDashboard /></RoleGate>} />
        <Route path="/admin/workers" component={() => <RoleGate role="cooperative_admin"><AdminWorkersPage /></RoleGate>} />
        <Route path="/admin/bookings" component={() => <RoleGate role="cooperative_admin"><BookingsPage adminView /></RoleGate>} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
