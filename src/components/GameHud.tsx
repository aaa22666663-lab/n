import React from 'react';
import {
  CameraMode,
  MissionProgress,
  RoleDefinition,
} from '../game/config';

interface GameHudProps {
  hp: number;
  maxHp: number;
  score: number;
  cp: number;
  remainingBlocks: number;
  initialBlocks: number;
  role: RoleDefinition;
  cameraMode: CameraMode;
  missions: MissionProgress[];
  muted: boolean;
  customizeOpen: boolean;
  toastMessage: string | null;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onTestExplosion: () => void;
  onResetArena: () => void;
  onToggleCustomize: () => void;
  onOpenStudio: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hp,
  maxHp,
  score,
  cp,
  remainingBlocks,
  initialBlocks,
  role,
  cameraMode,
  missions,
  muted,
  customizeOpen,
  toastMessage,
  onToggleCamera,
  onToggleMute,
  onPause,
  onTestExplosion,
  onResetArena,
  onToggleCustomize,
  onOpenStudio,
}) => {
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Right (RTL): Role Badge, Health Bar, CP Balance */}
        <div className="pointer-events-auto flex flex-col gap-2 min-w-[220px] max-w-[270px] rounded-xl border border-slate-700/90 bg-slate-900/90 px-3.5 py-2.5 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-950/60 shadow-inner"
                style={{ backgroundColor: role.accentHex }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-slate-950">
                  <path d="M12 2l2.9 6.1L22 9l-5 4.8L18.2 21 12 17.6 5.8 21 7 13.8 2 9l7.1-.9L12 2z" />
                </svg>
              </span>
              <div>
                <div className="text-[11px] font-semibold text-slate-400">الدور الحالي</div>
                <div className="text-sm font-black text-white leading-tight">{role.nameAr}</div>
              </div>
            </div>

            <div className="text-left">
              <div className="text-[10px] font-semibold text-slate-400">الرصيد</div>
              <div data-testid="hud-cp" className="text-sm font-black text-amber-400 tabular-nums">
                {cp.toLocaleString('en-US')} CP
              </div>
            </div>
          </div>

          {/* Health Bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-300">الصحة</span>
              <span className="text-emerald-300 tabular-nums">
                {hp} / {maxHp}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-md bg-slate-800 border border-slate-700">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${hpPct}%`,
                  backgroundColor: hpPct > 45 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        </div>

        {/* Top-Center: Compact Mission Tracker */}
        <div className="hidden lg:flex pointer-events-auto items-center gap-3 rounded-xl border border-slate-700/90 bg-slate-900/90 px-3.5 py-2 shadow-xl">
          {missions.map((m) => {
            const pct = Math.min(100, Math.round((m.currentCount / m.targetCount) * 100));
            return (
              <div key={m.id} className="w-40 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate font-bold text-slate-100">{m.titleAr}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 tabular-nums">
                    {m.currentCount}/{m.targetCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top-Left (RTL end): Arena Blocks, Score, Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-xl border border-slate-700/90 bg-slate-900/90 px-3 py-2 text-center shadow-xl">
            <div className="text-[10px] font-semibold text-slate-400">كتل الساحة</div>
            <div data-testid="hud-blocks" className="text-sm font-black text-sky-300 tabular-nums">
              {remainingBlocks} / {initialBlocks}
            </div>
          </div>

          <div className="hidden sm:block rounded-xl border border-slate-700/90 bg-slate-900/90 px-3 py-2 text-center shadow-xl">
            <div className="text-[10px] font-semibold text-slate-400">النقاط</div>
            <div data-testid="hud-score" className="text-sm font-black text-white tabular-nums">
              {score}
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-lg hover:border-sky-400"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-rose-400 stroke-2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-emerald-400 stroke-2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="إيقاف مؤقت"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-lg hover:border-amber-400"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Exact Center Crosshair (pointer-events: none) */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 28 28" className="h-7 w-7 opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          <circle cx="14" cy="14" r="2.2" fill="#fbbf24" />
          <path d="M14 2v6M14 20v6M2 14h6M20 14h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Transient Mission / CP Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 rounded-lg border border-amber-400/60 bg-slate-900/95 px-4 py-2 text-xs md:text-sm font-extrabold text-amber-300 shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Compact Bottom Action Dock */}
      <div className="flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-2xl">
          <button
            type="button"
            tabIndex={-1}
            data-testid="toggle-camera-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCamera();
            }}
            className="cursor-pointer rounded-lg border border-sky-500/60 bg-sky-600/25 px-3.5 py-2 text-xs md:text-sm font-bold text-sky-200 transition-colors hover:bg-sky-600/45"
          >
            {cameraMode === 'fps' ? 'منظور الشخص الأول' : 'منظور الشخص الثالث'} (V)
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="test-explosion-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onTestExplosion();
            }}
            className="cursor-pointer rounded-lg border border-orange-500/60 bg-orange-600/25 px-3.5 py-2 text-xs md:text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/45"
          >
            تفجير تجريبي
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="reset-arena-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onResetArena();
            }}
            className="cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs md:text-sm font-bold text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-700"
          >
            إعادة تعيين الساحة
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="toggle-customize-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCustomize();
            }}
            className={`cursor-pointer rounded-lg border px-3.5 py-2 text-xs md:text-sm font-bold transition-colors ${
              customizeOpen
                ? 'border-emerald-400 bg-emerald-600/35 text-emerald-100'
                : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-emerald-400'
            }`}
          >
            السلاح والمظهر
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="open-studio-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenStudio();
            }}
            className="cursor-pointer rounded-lg border border-amber-400/70 bg-amber-500/20 px-3.5 py-2 text-xs md:text-sm font-extrabold text-amber-300 transition-colors hover:bg-amber-500/35"
          >
            استوديو التصميم
          </button>
        </div>
      </div>
    </div>
  );
};
