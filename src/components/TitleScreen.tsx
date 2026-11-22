import React, { useEffect } from 'react';

interface TitleScreenProps {
  cp: number;
  onStart: () => void;
  onOpenStudio: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ cp, onStart, onOpenStudio }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none"
      style={{
        background:
          'linear-gradient(255deg, rgba(15, 23, 42, 0.90) 0%, rgba(15, 23, 42, 0.58) 42%, rgba(15, 23, 42, 0.12) 100%)',
      }}
    >
      {/* Top Status Strip */}
      <div className="flex items-center justify-between">
        <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-lg border border-amber-400/35 bg-slate-900/95 px-4 py-2 shadow-lg">
          <span className="text-xs font-semibold text-slate-300">الرصيد الحالي</span>
          <span className="text-base font-extrabold text-amber-400 tabular-nums">
            {cp.toLocaleString('en-US')} CP
          </span>
        </div>
      </div>

      {/* Main Focal Title Lockup on Calm Negative Space (Right Side in RTL) */}
      <div className="my-auto max-w-xl space-y-6 pointer-events-auto">
        <svg
          style={{ direction: 'ltr' }}
          viewBox="0 0 540 136"
          className="w-full max-w-lg drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
          role="img"
          aria-label="قلعتا الفوكسل - حرب المكعبات"
        >
          {/* Voxel Castle Crest on Right */}
          <g transform="translate(436, 16)">
            <rect x="0" y="34" width="88" height="62" rx="4" fill="#1e293b" stroke="#f59e0b" strokeWidth="3" />
            <rect x="6" y="14" width="22" height="74" rx="2" fill="#2563eb" />
            <rect x="4" y="8" width="8" height="10" fill="#60a5fa" />
            <rect x="16" y="8" width="8" height="10" fill="#60a5fa" />
            <rect x="60" y="14" width="22" height="74" rx="2" fill="#dc2626" />
            <rect x="58" y="8" width="8" height="10" fill="#f87171" />
            <rect x="70" y="8" width="8" height="10" fill="#f87171" />
            <rect x="35" y="42" width="18" height="18" rx="2" fill="#facc15" />
            <rect x="32" y="66" width="24" height="30" rx="2" fill="#0f172a" />
          </g>

          {/* Arabic Display Lockup (LTR anchor=end aligns cleanly to x=418 extending left) */}
          <text
            x="418"
            y="64"
            textAnchor="end"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="8"
            paintOrder="stroke fill"
            fontSize="44"
            fontWeight="900"
          >
            قلعتا الفوكسل
          </text>
          <text
            x="418"
            y="102"
            textAnchor="end"
            fill="#fbbf24"
            stroke="#0f172a"
            strokeWidth="5"
            paintOrder="stroke fill"
            fontSize="20"
            fontWeight="700"
          >
            ساحة المكعبات القابلة للتدمير • أدوار عشوائية
          </text>
        </svg>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="cursor-pointer rounded-xl border-2 border-amber-300 bg-amber-500 px-8 py-3.5 text-lg font-black text-slate-950 shadow-xl transition-transform hover:scale-[1.03] hover:bg-amber-400 active:scale-[0.98]"
          >
            ابدأ المعركة الآن
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="cursor-pointer rounded-xl border border-slate-600 bg-slate-900/95 px-5 py-3.5 text-sm font-bold text-slate-100 shadow-lg transition-colors hover:border-sky-400 hover:bg-slate-800"
          >
            استوديو التصميم (CP)
          </button>
        </div>
      </div>

      {/* Single Flat Borderless Control Hint Line */}
      <div className="text-center text-xs md:text-sm font-semibold text-slate-200 hud-text-shadow">
        WASD حركة · Space قفز · F أو النقر إطلاق · G قنبلة · V تبديل المنظور (الأول / الثالث) · P إيقاف
      </div>
    </div>
  );
};
