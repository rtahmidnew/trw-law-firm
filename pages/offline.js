export default function Offline() {
  return (
    <div className="min-h-screen bg-[#1a2744] flex flex-col items-center justify-center px-6 text-white">
      <div className="text-center max-w-sm">
        {/* TRW Logo text */}
        <div className="mb-8">
          <div className="text-4xl font-bold tracking-widest text-white mb-1">TRW</div>
          <div className="text-xs tracking-[0.3em] text-gray-400 uppercase">Tahmidur Remura Wahid</div>
        </div>

        {/* Offline icon */}
        <div className="mb-6 flex justify-center">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18M9.879 9.879A5 5 0 0012 9m-2.121 2.121A5 5 0 0012 15m0 0a5 5 0 002.121-2.121" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold mb-3">You are offline</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Please check your internet connection and try again. Some previously visited pages may still be available.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="bg-white text-[#1a2744] font-semibold px-8 py-3 rounded-lg text-sm hover:bg-gray-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
