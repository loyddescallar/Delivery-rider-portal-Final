import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import riderPhoto from './assets/marimar.jpg';
import scooterRider from './assets/scooter_ni_youngstunna.png';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: HomeIcon },
  { id: 'deliveries', label: 'Deliveries', icon: BoxIcon },
  { id: 'history', label: 'History', icon: ClockIcon },
  { id: 'profile', label: 'Profile', icon: UserIcon }
];

const statusOptions = ['Pending', 'Out for Delivery', 'Delivered', 'Failed'];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ys_token'));
  const [rider, setRider] = useState(() => {
    const saved = localStorage.getItem('ys_rider');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState('dashboard');
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isLoggedIn = Boolean(token && rider);

  async function loadData() {
    if (!localStorage.getItem('ys_token')) return;

    try {
      setLoading(true);
      const [deliveryData, historyData] = await Promise.all([
        api.deliveries(),
        api.history()
      ]);
      setDeliveries(deliveryData.deliveries || []);
      setHistory(historyData.history || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  async function handleLogin(email, password) {
    setMessage('');
    const data = await api.login(email, password);
    localStorage.setItem('ys_token', data.token);
    localStorage.setItem('ys_rider', JSON.stringify(data.rider));
    setToken(data.token);
    setRider(data.rider);
    setView('dashboard');
  }

  function handleLogout() {
    localStorage.removeItem('ys_token');
    localStorage.removeItem('ys_rider');
    setToken(null);
    setRider(null);
    setDeliveries([]);
    setHistory([]);
    setSelectedDelivery(null);
    setView('dashboard');
  }

  async function openDelivery(delivery) {
    try {
      setLoading(true);
      const data = await api.deliveryDetails(delivery.delivery_id);
      setSelectedDelivery(data.delivery);
      setLogs(data.logs || []);
      setView('details');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(status) {
    if (!selectedDelivery) return;

    try {
      setLoading(true);
      const data = await api.updateStatus(
        selectedDelivery.delivery_id,
        status,
        `Rider updated status to ${status}.`
      );
      setSelectedDelivery(data.delivery);
      await loadData();
      const fresh = await api.deliveryDetails(selectedDelivery.delivery_id);
      setLogs(fresh.logs || []);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!selectedDelivery) return;

    try {
      setLoading(true);
      const data = await api.confirmDelivery(selectedDelivery.delivery_id);
      setSelectedDelivery(data.delivery);
      await loadData();
      const fresh = await api.deliveryDetails(selectedDelivery.delivery_id);
      setLogs(fresh.logs || []);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const activeDeliveries = useMemo(
    () => deliveries.filter((item) => item.status !== 'Delivered' && item.status !== 'Failed'),
    [deliveries]
  );

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} message={message} />;
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl lg:px-5">
        <Sidebar view={view} setView={setView} rider={rider} />

       <main
  className={`phone-safe-bottom min-w-0 flex-1 overflow-x-hidden ${
    view === 'profile'
      ? 'px-0 py-0 lg:px-8 lg:py-5'
      : 'px-4 py-5 sm:px-6 lg:px-8 lg:pb-8'
  }`}
>
          {view !== 'dashboard' && view !== 'profile' && <TopBar rider={rider} loading={loading} />}
          {message && (
            <div className="animate-toast mb-4 rounded-3xl border border-ys-muted/40 bg-white/90 px-4 py-3 text-sm text-ys-dark shadow-sm backdrop-blur">
              {message}
              <button className="float-right font-bold transition hover:text-red-500 active:scale-90" onClick={() => setMessage('')}>x</button>
            </div>
          )}

          <div key={view} className="animate-page-enter">
            {view === 'dashboard' && (
              <Dashboard
                rider={rider}
                deliveries={deliveries}
                activeDeliveries={activeDeliveries}
                openDelivery={openDelivery}
                setView={setView}
              />
            )}

            {view === 'deliveries' && (
              <DeliveriesPage deliveries={activeDeliveries} openDelivery={openDelivery} />
            )}

            {view === 'details' && selectedDelivery && (
              <DeliveryDetails
                delivery={selectedDelivery}
                logs={logs}
                onBack={() => setView('deliveries')}
                onStatusUpdate={handleStatusUpdate}
                onConfirm={handleConfirmDelivery}
              />
            )}

            {view === 'history' && (
              <HistoryPage history={history} openDelivery={openDelivery} />
            )}

            {view === 'profile' && (
              <ProfilePage rider={rider} onLogout={handleLogout} />
            )}
          </div>
        </main>
      </div>

      <BottomNav view={view} setView={setView} />
    </div>
  );
}
function LoginScreen({ onLogin, message }) {
  const [email, setEmail] = useState('Group: Descallar, Jebulan, Bello, Delos Santos');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-ys-dark text-white">
      <div className="animated-orb absolute -right-20 -top-20 h-72 w-72 rounded-full bg-ys-lime/70 blur-sm" />
      <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-ys-sage/30 blur-md" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-black/20 road-wave" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-6 pt-8">
        <header className="animate-rise-in text-center">
          <p className="text-sm font-black uppercase tracking-[0.42em] text-ys-lime">
            Young Stunna
          </p>
          <h1 className="mt-2 text-lg font-black uppercase tracking-[0.18em] text-white">
            Delivery Rider Portal
          </h1>
        </header>

        <section className="flex flex-1 flex-col justify-center">
          <div className="animate-rise-in [animation-delay:100ms]">
            <CourierScooterScene />
          </div>

          <div className="animate-rise-in text-center [animation-delay:180ms]">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="h-2 w-10 rounded-full bg-ys-lime" />
            </div>

            <h2 className="text-3xl font-black leading-tight">
              Fast, Safe, and Always
              <span className="block italic text-ys-lime">On Time</span>
            </h2>

            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/75">
              Manage assigned shipments, update delivery status, and confirm successful deliveries.
            </p>
          </div>
        </section>

        <form
          className="animate-rise-in space-y-3 rounded-[2rem] bg-white/95 p-4 text-slate-900 shadow-2xl [animation-delay:260ms]"
          onSubmit={submit}
        >
          <label className="block">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ys-sage focus:ring-4 focus:ring-ys-soft"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email or Username"
            />
          </label>

          <label className="block">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ys-sage focus:ring-4 focus:ring-ys-soft"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
            />
          </label>

          {(error || message) && (
            <p className="animate-toast rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {error || message}
            </p>
          )}

          <button
            className="w-full rounded-2xl bg-ys-lime px-5 py-3 font-black text-ys-dark shadow-lg shadow-ys-lime/30 transition duration-200 hover:bg-ys-sage hover:text-white active:scale-[0.98] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'LOGIN'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Credentials: Moto_rider@youngstunna.com / password123
          </p>
        </form>
      </main>
    </div>
  );
}
function CourierScooterScene() {
  return (
    <div className="relative mx-auto my-2 h-[270px] w-full max-w-[360px] animate-float-slow">
      <div className="absolute inset-x-10 bottom-5 h-5 rounded-full bg-black/25 blur-md" />

      <div className="moving-road absolute inset-x-0 bottom-0 h-10 overflow-hidden rounded-full bg-white/10">
        <span className="road-line left-[10%]" />
        <span className="road-line left-[42%]" />
        <span className="road-line left-[74%]" />
      </div>

      <img
        src={scooterRider}
        alt="Young Stunna delivery rider"
        className="relative z-10 mx-auto h-full w-auto object-contain drop-shadow-2xl scooter-bounce"
      />
    </div>
  );
}

function TopBar({ rider, loading }) {
  return (
    <header className="animate-rise-in mb-5 flex items-center justify-between rounded-[2rem] bg-white/80 px-4 py-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur lg:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ys-sage">
          Young Stunna
        </p>
        <h1 className="text-lg font-black text-ys-dark sm:text-2xl">
          Delivery Rider Portal
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {loading && (
          <span className="hidden text-sm text-slate-500 sm:inline">
            Loading...
          </span>
        )}

        <div className="hidden text-right sm:block">
          <p className="text-sm font-bold text-slate-800">
            {rider.full_name}
          </p>
          <p className="text-xs text-slate-500">Active Rider</p>
        </div>

        <Avatar name={rider.full_name} />
      </div>
    </header>
  );
}

function Sidebar({ view, setView, rider }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 py-5 pr-5 lg:block">
      <div className="flex h-full flex-col rounded-[2rem] bg-ys-dark p-5 text-white shadow-soft">
        <div className="mb-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ys-lime font-black text-ys-dark">YS</div>
          <h1 className="mt-4 text-2xl font-black">Young Stunna</h1>
          <p className="text-sm text-white/60">Delivery Rider Portal</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id || (view === 'details' && item.id === 'deliveries');
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition duration-200 active:scale-[0.98] ${
                  active ? 'bg-ys-lime text-ys-dark' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[1.5rem] bg-white/10 p-4">
          <p className="font-bold">{rider.full_name}</p>
          <p className="mt-1 text-xs text-white/60">{rider.vehicle_type} - {rider.plate_number}</p>
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ view, setView }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.id || (view === 'details' && item.id === 'deliveries');
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold transition duration-200 active:scale-95 ${
                active ? 'scale-[1.03] bg-ys-dark text-white shadow-lg shadow-ys-dark/20' : 'text-slate-500 hover:bg-ys-soft'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Dashboard({ rider, deliveries, activeDeliveries, openDelivery, setView }) {
  const counts = getCounts(deliveries);
  const firstName = rider.full_name.split(' ')[0];
  const recentDelivery = activeDeliveries[0] || deliveries[0];

  return (
  <section className="animate-page-enter mx-auto w-full max-w-[390px] space-y-5 overflow-x-hidden"> 
      <div className="flex items-center justify-between pt-1">
        <button className="grid h-10 w-10 place-items-center rounded-full text-ys-dark active:scale-95">
          ☰
        </button>

        <button className="grid h-10 w-10 place-items-center rounded-full text-ys-dark active:scale-95">
          ♡
        </button>
      </div>

      <div className="animate-rise-in">
        <p className="text-lg text-ys-dark">Good day,</p>
        <h2 className="text-2xl font-black leading-tight text-ys-dark">
          {rider.full_name}! 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Here’s your delivery summary for today.
        </p>
      </div>

      <div className="animate-card-in rounded-[1.75rem] bg-ys-dark p-5 text-white shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black">Today</p>
            <p className="mt-1 text-xs font-semibold text-white/70">
              {new Date().toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>

          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            📅
          </div>
        </div>
      </div>

     <div className="grid w-full grid-cols-2 gap-3">
        <DashboardMetric
          value={deliveries.length}
          label="Assigned"
          icon="📦"
          tone="green"
        />

        <DashboardMetric
          value={counts.Pending}
          label="Pending"
          icon="🛵"
          tone="orange"
        />

        <DashboardMetric
          value={counts['Out for Delivery']}
          label="Out for Delivery"
          icon="🚚"
          tone="blue"
        />

        <DashboardMetric
          value={counts.Delivered}
          label="Delivered"
          icon="✅"
          tone="green"
        />
      </div>

      <button
        onClick={() => setView('deliveries')}
        className="animate-card-in flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#7aa63f] to-[#5f8f31] px-6 py-4 font-black text-white shadow-lg shadow-ys-sage/30 transition duration-200 hover:brightness-105 active:scale-[0.98]"
      >
        <span>View Deliveries</span>
        <span className="text-xl">›</span>
      </button>

      <section className="animate-rise-in pb-3">
        <h3 className="mb-3 text-sm font-black text-ys-dark">Recent Activity</h3>

        {recentDelivery ? (
          <button
            onClick={() => openDelivery(recentDelivery)}
            className="flex w-full items-center justify-between rounded-[1.5rem] bg-white/90 px-4 py-4 text-left shadow-sm ring-1 ring-slate-200/70 transition duration-200 active:scale-[0.98]"
          >
            <div className="min-w-0">
              <p className="text-xs font-black text-ys-dark">
                #{recentDelivery.tracking_number}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-600">
                📍 {recentDelivery.recipient_name}
              </p>
            </div>

            <div className="text-right">
              <StatusBadge status={recentDelivery.status} small />
              <p className="mt-2 text-xs text-slate-400">
                {formatDate(recentDelivery.assigned_date)}
              </p>
            </div>
          </button>
        ) : (
          <EmptyState text="No recent activity yet." />
        )}
      </section>
    </section>
  );
}

function DashboardMetric({ value, label, icon, tone }) {
  const styles = {
    green: {
      icon: 'bg-emerald-50 text-emerald-600',
      number: 'text-emerald-700',
      border: 'ring-emerald-100'
    },
    orange: {
      icon: 'bg-orange-50 text-orange-500',
      number: 'text-orange-600',
      border: 'ring-orange-100'
    },
    blue: {
      icon: 'bg-blue-50 text-blue-500',
      number: 'text-blue-600',
      border: 'ring-blue-100'
    }
  };

  const current = styles[tone] || styles.green;

  return (
    <div
     className={`animate-card-in min-w-0 min-h-[125px] rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ${current.border}`}
    >
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl text-lg ${current.icon}`}>
          {icon}
        </div>

        <p className={`mt-3 text-4xl font-black leading-none tracking-tight ${current.number}`}>
          {value}
        </p>

        <p className="mt-2 text-[13px] font-black leading-tight text-ys-dark">
          {label === 'Out for Delivery' ? (
            <>
              Out for
              <br />
              Delivery
            </>
          ) : (
            label
          )}
        </p>
      </div>
    </div>
  );
}
function DeliveriesPage({ deliveries, openDelivery }) {
  return (
    <section>
      <PageTitle title="Assigned Deliveries" subtitle="Deliveries assigned to your rider account." />
      <div className="grid gap-4 lg:grid-cols-2">
        {deliveries.length ? deliveries.map((delivery) => (
          <DeliveryCard key={delivery.delivery_id} delivery={delivery} onClick={() => openDelivery(delivery)} />
        )) : <EmptyState text="No active assigned deliveries right now." />}
      </div>
    </section>
  );
}

function DeliveryCard({ delivery, onClick }) {
  return (
    <article className="animate-card-in rounded-[2rem] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-1 hover:shadow-soft active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Tracking No.</p>
          <h3 className="mt-1 text-2xl font-black text-ys-dark">{delivery.tracking_number}</h3>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-600">
        <InfoLine label="Recipient" value={delivery.recipient_name} />
        <InfoLine label="Contact" value={delivery.recipient_contact} />
        <InfoLine label="Address" value={delivery.recipient_address} />
      </div>

      <button
        onClick={onClick}
        className="mt-5 w-full rounded-2xl bg-ys-dark px-4 py-3 font-black text-white transition duration-200 hover:bg-ys-sage active:scale-[0.98]"
      >
        View Details
      </button>
    </article>
  );
}

function DeliveryDetails({ delivery, logs, onBack, onStatusUpdate, onConfirm }) {
  return (
    <section className="space-y-5">
      <button onClick={onBack} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ys-dark shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]">
        Back to Deliveries
      </button>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="animate-card-in rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-ys-sage">Delivery Details</p>
              <h2 className="mt-2 text-3xl font-black text-ys-dark">{delivery.tracking_number}</h2>
            </div>
            <StatusBadge status={delivery.status} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailBox label="Recipient" value={delivery.recipient_name} />
            <DetailBox label="Contact Number" value={delivery.recipient_contact} />
            <DetailBox label="Assigned Date" value={formatDate(delivery.assigned_date)} />
            <DetailBox label="Current Status" value={delivery.status} />
          </div>

          <div className="mt-4 rounded-[1.5rem] bg-ys-cream p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Delivery Address</p>
            <p className="mt-2 text-lg font-bold text-ys-dark">{delivery.recipient_address}</p>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-black text-ys-dark">Update Delivery Status</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  disabled={delivery.status === status}
                  onClick={() => onStatusUpdate(status)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                    delivery.status === status
                      ? 'bg-slate-200 text-slate-500'
                      : 'bg-ys-dark text-white hover:bg-ys-sage'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onConfirm}
            disabled={delivery.status === 'Delivered'}
            className="mt-5 w-full rounded-2xl bg-ys-lime px-5 py-4 font-black text-ys-dark shadow-lg shadow-ys-lime/30 transition duration-200 hover:bg-ys-sage hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Confirm Successful Delivery
          </button>
        </div>

        <div className="animate-card-in rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-slate-200/70">
          <h3 className="text-xl font-black text-ys-dark">Status Logs</h3>
          <div className="mt-5 space-y-3">
            {logs.length ? logs.map((log) => (
              <div key={log.log_id} className="rounded-2xl bg-ys-cream p-4">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={log.status} small />
                  <p className="text-xs font-semibold text-slate-400">{formatDate(log.updated_at)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{log.remarks || 'Status updated.'}</p>
              </div>
            )) : <EmptyState text="No status logs yet." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoryPage({ history, openDelivery }) {
  return (
    <section>
      <PageTitle title="Delivery History" subtitle="Completed and failed delivery records in chronological order." />
      <div className="space-y-3">
        {history.length ? history.map((delivery) => (
          <button
            key={delivery.delivery_id}
            onClick={() => openDelivery(delivery)}
            className="animate-list-item flex w-full flex-col gap-3 rounded-[1.75rem] bg-white/90 p-5 text-left shadow-sm ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-1 hover:shadow-soft active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{delivery.tracking_number}</p>
              <h3 className="mt-1 text-lg font-black text-ys-dark">{delivery.recipient_name}</h3>
              <p className="mt-1 text-sm text-slate-500">{delivery.recipient_address}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-slate-400">{formatDate(delivery.delivered_date || delivery.updated_at)}</p>
              <StatusBadge status={delivery.status} />
            </div>
          </button>
        )) : <EmptyState text="No delivery history yet." />}
      </div>
    </section>
  );
}

function ProfilePage({ rider, onLogout }) {
  return (
    <section className="animate-page-enter min-h-[calc(100dvh-5.5rem)] bg-gradient-to-b from-[#eef6dc] to-[#f7f9f3]">
      <div className="relative min-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-none bg-white/40 lg:mx-auto lg:max-w-md lg:rounded-[2rem]">
        <div className="relative overflow-hidden bg-gradient-to-br from-ys-sage to-ys-dark px-6 pb-10 pt-12 text-center text-white">
          <div className="animated-orb absolute -right-20 -top-24 h-72 w-72 rounded-full bg-ys-lime/35 blur-sm" />
          <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-black/10 blur-md" />

          <button
            className="absolute right-6 top-8 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition active:scale-95"
            type="button"
          >
            ✎
          </button>

          <div className="relative z-10 mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-ys-lime/70 bg-white shadow-xl">
            <img
              src={riderPhoto}
              alt={rider.full_name}
              className="h-full w-full object-cover"
            />
          </div>

          <h2 className="relative z-10 mt-5 text-3xl font-black">
            {rider.full_name}
          </h2>

          <p className="relative z-10 mt-1 text-sm font-semibold text-white/80">
            Rider ID: YSR-{String(rider.rider_id || '0001').padStart(4, '0')}
          </p>

          <span className="relative z-10 mt-5 inline-flex rounded-full bg-white/20 px-5 py-2 text-xs font-black uppercase tracking-[0.22em] text-ys-lime backdrop-blur">
            Active Rider
          </span>
        </div>

        <div className="-mt-4 space-y-3 rounded-t-[2rem] bg-white px-4 pb-8 pt-6 shadow-2xl">
          <ProfileMenuItem
            icon="👤"
            title="Personal Information"
            subtitle={rider.email}
          />

          <ProfileMenuItem
            icon="📞"
            title="Contact Number"
            subtitle={rider.contact_number}
          />

          <ProfileMenuItem
            icon="🛵"
            title="Vehicle Information"
            subtitle={`${rider.vehicle_type} / ${rider.plate_number}`}
          />

          <ProfileMenuItem
            icon="✅"
            title="Account Status"
            subtitle="Authorized delivery rider"
          />

          <button
            onClick={onLogout}
            className="flex w-full items-center justify-between rounded-[1.5rem] bg-red-50 px-4 py-4 text-left text-red-600 transition duration-200 hover:bg-red-100 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-lg shadow-sm">
                ⎋
              </span>
              <div>
                <p className="font-black">Logout</p>
                <p className="text-xs text-red-400">Sign out from rider portal</p>
              </div>
            </div>
            <span className="text-xl">›</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfileMenuItem({ icon, title, subtitle }) {
  return (
    <div className="flex items-center justify-between rounded-[1.5rem] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ys-cream text-lg">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="font-black text-ys-dark">{title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <span className="text-xl text-slate-400">›</span>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return (
    <div className="animate-rise-in mb-5">
      <h2 className="text-3xl font-black text-ys-dark">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-[1.5rem] bg-ys-cream p-4 transition duration-200 hover:-translate-y-0.5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 font-bold text-ys-dark">{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-[2rem] bg-white/80 p-8 text-center text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
      {text}
    </div>
  );
}

function StatusBadge({ status, small = false }) {
  const style = {
    Pending: 'bg-amber-100 text-amber-700 ring-amber-200',
    'Out for Delivery': 'bg-blue-100 text-blue-700 ring-blue-200',
    Delivered: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    Failed: 'bg-red-100 text-red-700 ring-red-200'
  };

  return (
    <span className={`animate-badge-pop inline-flex shrink-0 items-center rounded-full font-black ring-1 transition duration-300 ${style[status] || style.Pending} ${small ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'}`}>
      {status}
    </span>
  );
}

function Avatar({ name, large = false }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl bg-ys-lime font-black text-ys-dark shadow-lg shadow-ys-lime/20 transition duration-200 hover:scale-105 ${large ? 'h-20 w-20 text-2xl' : 'h-12 w-12 text-sm'}`}>
      {initials}
    </div>
  );
}

function getCounts(deliveries) {
  return deliveries.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { Pending: 0, 'Out for Delivery': 0, Delivered: 0, Failed: 0 });
}

function formatDate(value) {
  if (!value) return 'Not yet completed';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z" />
    </svg>
  );
}

function BoxIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 8-9-5-9 5 9 5 9-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8v8l9 5 9-5V8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v8" />
    </svg>
  );
}

function ClockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  );
}

function UserIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export default App;
