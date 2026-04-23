import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);

function FatalStartupError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-slate-50">
      <div className="w-full max-w-2xl rounded-3xl border border-red-500/30 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Startup Error</p>
        <h1 className="mt-4 text-2xl font-semibold">The app failed before it could render.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          The frontend threw during startup. The message below is the actual browser error captured at boot.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-slate-800 bg-black/40 p-4 text-sm text-amber-200">
          {message}
        </pre>
      </div>
    </div>
  );
}

function renderFatalError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error, null, 2);

  root.render(
    <React.StrictMode>
      <FatalStartupError message={message} />
    </React.StrictMode>
  );
}

window.addEventListener('error', (event) => {
  renderFatalError(event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError(event.reason);
});

async function bootstrap() {
  try {
    const [{ default: App }, { Toaster }] = await Promise.all([
      import('./App'),
      import('./components/ui/toaster'),
    ]);

    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (error) {
    renderFatalError(error);
  }
}

void bootstrap();
