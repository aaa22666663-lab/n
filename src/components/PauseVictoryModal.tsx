import React from 'react';
import { GamePhase, RoleDefinition } from '../game/config';

interface PauseVictoryModalProps {
  phase: Extract<GamePhase, 'paused' | 'gameover'>;
  score: number;
  cp: number;
  enemiesDefeated: number;
  role: RoleDefinition;
  onResume: () => void;
  onRestartRound: () => void;
  onBackToTitle: () => void;
}

export const PauseVictoryModal: React.FC<PauseVictoryModalProps> = ({
  phase,
  score,
  cp,
  enemiesDefeated,
  role,
  onResume,
  onRestartRound,
  onBackToTitle,
}) => {
  const isGameOver = phase === 'gameover';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isGameOver ? 'انتهت الجولة' : 'إيقاف مؤقت'}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white">
            {isGameOver ? 'سقط المقاتل في الساحة!' : 'اللعبة متوقفة مؤقتاً'}
          </h2>
          <p className="text-xs font-semibold text-slate-400">
            الدور الحالي: <span className="text-amber-300 font-bold">{role.nameAr}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400">النقاط</div>
            <div className="text-lg font-black text-white tabular-nums">{score}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400">إسقاطات</div>
            <div className="text-lg font-black text-sky-300 tabular-nums">{enemiesDefeated}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400">الرصيد</div>
            <div className="text-base font-black text-amber-400 tabular-nums">
              {cp.toLocaleString('en-US')}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {!isGameOver && (
            <button
              type="button"
              onClick={onResume}
              className="cursor-pointer w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 hover:bg-amber-400"
            >
              متابعة القتال
            </button>
          )}

          <button
            type="button"
            data-start={isGameOver ? 'true' : undefined}
            onClick={onRestartRound}
            className={`cursor-pointer w-full rounded-xl py-3 text-sm font-black ${
              isGameOver
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'border border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            جولة جديدة (تعيين دور عشوائي)
          </button>

          <button
            type="button"
            onClick={onBackToTitle}
            className="cursor-pointer w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            العودة إلى القائمة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
};
