import { useState, useCallback, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Login from './components/Login';
import CameraLocation from './components/CameraLocation';
import MeetingForm from './components/MeetingForm';
import Dashboard from './components/Dashboard';
import MeetingTable from './components/MeetingTable';
import Inventory from './components/Inventory';
import MeetingEntryLanding from './components/MeetingEntryLanding';
import { Page, Meeting, AppUser, MeetingProof } from './types';
import { getSession, clearSession, signOut, getMeetings } from './utils/supabaseDb';

type AppState = 'login' | 'app' | 'verify' | 'form';

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [appState, setAppState]   = useState<AppState>(() => getSession() ? 'app' : 'login');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getSession());

  // ── Proof (photo + location) ─────────────────────────────────────────────────
  const [currentProof, setCurrentProof] = useState<MeetingProof | null>(null);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [page, setPage]           = useState<Page>('dashboard');
  const [meetings, setMeetings]   = useState<Meeting[]>([]);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Load meetings from Supabase when app is ready
  const refresh = useCallback(async () => {
    if (!getSession()) return;
    setLoadingMeetings(true);
    const data = await getMeetings();
    setMeetings(data);
    setLoadingMeetings(false);
  }, []);

  useEffect(() => {
    if (appState === 'app' || appState === 'form') {
      refresh();
    }
  }, [appState, refresh]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleLogin = (user: AppUser) => {
    setCurrentUser(user);
    setPage('dashboard');
    setAppState('app');
  };

  const handleLogout = async () => {
    await signOut();
    clearSession();
    setCurrentUser(null);
    setCurrentProof(null);
    setEditMeeting(null);
    setMeetings([]);
    setPage('dashboard');
    setAppState('login');
  };

  // User clicks "New Meeting" → verify photo + location first
  const handleStartNewMeeting = () => {
    setEditMeeting(null);
    setCurrentProof(null);
    setAppState('verify');
  };

  // Edit existing meeting — skip re-verify
  const handleEdit = (m: Meeting) => {
    setEditMeeting(m);
    setPage('entry');
    setAppState('form');
  };

  // Proof captured → go to meeting form
  const handleProofCaptured = (proof: MeetingProof) => {
    setCurrentProof(proof);
    setPage('entry');
    setAppState('form');
  };

  // Meeting saved/updated
  const handleSaved = async () => {
    await refresh();
    setCurrentProof(null);
    setEditMeeting(null);
    setPage('entry');
    setAppState('app');
  };

  // Navbar navigation — never triggers verify
  const handlePageChange = (p: Page) => {
    setPage(p);
    setEditMeeting(null);
    if (appState === 'verify' || appState === 'form') {
      setAppState('app');
      setCurrentProof(null);
    }
  };

  // ── Toaster ──────────────────────────────────────────────────────────────────
  const toaster = (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'text-sm font-medium',
        duration: 3500,
        style: { borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
      }}
    />
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  // 1. Not logged in
  if (appState === 'login' || !currentUser) {
    return <>{toaster}<Login onLogin={handleLogin} /></>;
  }

  // 2. Verify visit — capture photo + GPS
  if (appState === 'verify') {
    return (
      <>
        {toaster}
        <CameraLocation
          userName={currentUser.name}
          onProofCaptured={handleProofCaptured}
          onCancel={() => setAppState('app')}
        />
      </>
    );
  }

  // 3. Main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50">
      {toaster}
      <Navbar
        current={page}
        onChange={handlePageChange}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Meeting Entry */}
        {page === 'entry' && appState !== 'form' && (
          <MeetingEntryLanding
            onNewMeeting={handleStartNewMeeting}
            meetings={meetings}
            onEdit={handleEdit}
          />
        )}
        {page === 'entry' && appState === 'form' && (
          <MeetingForm
            editMeeting={editMeeting}
            onSaved={handleSaved}
            user={currentUser}
            proof={currentProof}
            onCancel={() => setAppState('app')}
          />
        )}

        {page === 'dashboard' && (
          <Dashboard meetings={meetings} loading={loadingMeetings} />
        )}
        {page === 'table' && (
          <MeetingTable
            meetings={meetings}
            onEdit={handleEdit}
            onRefresh={refresh}
          />
        )}
        {page === 'inventory' && <Inventory />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 mt-4 border-t border-gray-200/60">
        SalesCRM &copy; {new Date().getFullYear()} — Field Sales Management
        {currentUser && (
          <span className="ml-2 text-gray-300">
            · Logged in as{' '}
            <span className="text-indigo-400 font-medium">{currentUser.name}</span>
            <span className="ml-1 text-green-400 font-medium">· Supabase Secured 🔒</span>
          </span>
        )}
      </footer>
    </div>
  );
}
