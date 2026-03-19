// src/pages/Sandbox.tsx 
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function Sandbox() {
  return (
    <div className="min-h-screen bg-slate-50 p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            UI Sandbox 🧪
          </h1>
          <p className="mt-2 text-slate-500">
            A hidden playground for testing isolated components without breaking the main application.
          </p>
        </header>

        <div className="space-y-12">
          
          {/* ─── TEST: Loading Spinner ─── */}
          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-700">Loading Spinner</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm flex justify-center">
              {/* Note: if you haven't added an imageSrc, this will just use the CSS fallback */}
              <LoadingSpinner text="Syncing live availability..." />
            </div>
          </section>

          {/* ─── TEST: Error Message ─── */}
          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-700">Error Message</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <ErrorMessage 
                message="Cannot connect to the property management database. Please verify your connection." 
                onRetry={() => alert('Retry function triggered!')} 
              />
            </div>
          </section>

          {/* ─── ADD NEW COMPONENTS BELOW ─── */}
          {/* <section>
            <h2 className="mb-4 text-lg font-bold text-slate-700">New Button Test</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
               <MyNewButton />
            </div>
          </section>
          */}

        </div>
      </div>
    </div>
  );
}