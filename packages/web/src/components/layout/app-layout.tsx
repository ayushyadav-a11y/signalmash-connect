import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-sky-100/70 via-white/20 to-transparent dark:from-sky-950/30 dark:via-slate-950/0" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-slate-300/30 blur-3xl dark:bg-slate-700/20" />
      </div>

      <Sidebar />

      <main className="relative lg:pl-72">
        <div className="relative min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
