import React, { useState } from 'react';
import {
  BARREL_OPTIONS,
  BarrelId,
  CustomDesign,
  MAGAZINE_OPTIONS,
  MagazineId,
  PRESET_COLORS,
  PRESET_SKINS,
  PersistedProfile,
  RoleDefinition,
  SCOPE_OPTIONS,
  ScopeId,
  UNDERBARREL_OPTIONS,
  UnderbarrelId,
} from '../game/config';

interface CustomizeDrawerProps {
  profile: PersistedProfile;
  role: RoleDefinition;
  onClose: () => void;
  onSelectAttachment: (
    slot: 'barrel' | 'magazine' | 'scope' | 'underbarrel',
    id: BarrelId | MagazineId | ScopeId | UnderbarrelId,
    cost: number
  ) => void;
  onSelectColor: (colorId: string, cost: number) => void;
  onSelectSkin: (skinId: string, cost: number) => void;
  onSelectCustomDesign: (design: CustomDesign) => void;
  onRerollRole: () => void;
  onGrantTestCp: () => void;
}

export const CustomizeDrawer: React.FC<CustomizeDrawerProps> = ({
  profile,
  role,
  onClose,
  onSelectAttachment,
  onSelectColor,
  onSelectSkin,
  onSelectCustomDesign,
  onRerollRole,
  onGrantTestCp,
}) => {
  const [tab, setTab] = useState<'attachments' | 'skins' | 'role'>('attachments');

  const renderAttachmentRow = <T extends string>(
    label: string,
    slot: 'barrel' | 'magazine' | 'scope' | 'underbarrel',
    current: T,
    options: Array<{ id: T; nameAr: string; effectAr: string; cost: number }>
  ) => (
    <div className="space-y-1.5">
      <div className="text-xs font-extrabold text-slate-300">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const unlocked = opt.cost === 0 || profile.unlockedAttachments.includes(opt.id);
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectAttachment(slot, opt.id as never, unlocked ? 0 : opt.cost)}
              className={`cursor-pointer rounded-lg border p-2.5 text-right transition-colors ${
                active
                  ? 'border-sky-400 bg-sky-500/20 text-white'
                  : 'border-slate-700 bg-slate-800/90 text-slate-200 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold">{opt.nameAr}</span>
                {!unlocked && (
                  <span className="text-[10px] font-extrabold text-amber-400 tabular-nums">
                    {opt.cost.toLocaleString('en-US')} CP
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">{opt.effectAr}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      data-testid="customize-drawer"
      className="fixed bottom-16 left-1/2 z-30 w-[min(780px,94vw)] -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('attachments')}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold ${
              tab === 'attachments' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ملحقات السلاح
          </button>
          <button
            type="button"
            onClick={() => setTab('skins')}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold ${
              tab === 'skins' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            الألوان والمظاهر
          </button>
          <button
            type="button"
            onClick={() => setTab('role')}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold ${
              tab === 'role' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            الدور والمكافآت
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGrantTestCp}
            className="cursor-pointer rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30"
          >
            +10,000 CP (تجربة)
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة التخصيص"
            className="cursor-pointer rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            إغلاق
          </button>
        </div>
      </div>

      <div className="max-h-[42vh] overflow-y-auto studio-scroll pr-1 space-y-4">
        {tab === 'attachments' && (
          <div className="space-y-3">
            {renderAttachmentRow('السبطانة', 'barrel', profile.weapon.barrel, BARREL_OPTIONS)}
            {renderAttachmentRow('المخزن', 'magazine', profile.weapon.magazine, MAGAZINE_OPTIONS)}
            {renderAttachmentRow('المنظار', 'scope', profile.weapon.scope, SCOPE_OPTIONS)}
            {renderAttachmentRow('أسفل السبطانة', 'underbarrel', profile.weapon.underbarrel, UNDERBARREL_OPTIONS)}
          </div>
        )}

        {tab === 'skins' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-300">طلاء السلاح الجاهز</div>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => {
                  const unlocked = c.cost === 0 || profile.unlockedColors.includes(c.id);
                  const active = !profile.weapon.customWeaponDesignId && profile.weapon.colorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectColor(c.id, unlocked ? 0 : c.cost)}
                      className={`cursor-pointer flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        active ? 'border-sky-400 bg-sky-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-sm border border-white/30" style={{ backgroundColor: c.hex }} />
                      <span>{c.nameAr}</span>
                      {!unlocked && <span className="text-[10px] text-amber-400 tabular-nums">{c.cost} CP</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-300">مظاهر الشخصية الجاهزة</div>
              <div className="flex flex-wrap gap-2">
                {PRESET_SKINS.map((s) => {
                  const unlocked = s.cost === 0 || profile.unlockedSkins.includes(s.id);
                  const active = !profile.selectedCustomSkinId && profile.selectedSkinId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSkin(s.id, unlocked ? 0 : s.cost)}
                      className={`cursor-pointer flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        active ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-sm border border-white/30" style={{ backgroundColor: s.torsoHex }} />
                      <span>{s.nameAr}</span>
                      {!unlocked && <span className="text-[10px] text-amber-400 tabular-nums">{s.cost} CP</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {profile.customDesigns.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-amber-300">تصاميمك المخصصة</div>
                <div className="flex flex-wrap gap-2">
                  {profile.customDesigns.map((d) => {
                    const active =
                      (d.target === 'skin' && profile.selectedCustomSkinId === d.id) ||
                      (d.target === 'weapon' && profile.weapon.customWeaponDesignId === d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onSelectCustomDesign(d)}
                        className={`cursor-pointer flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                          active ? 'border-amber-400 bg-amber-500/25 text-amber-100' : 'border-slate-700 bg-slate-800 text-slate-200'
                        }`}
                      >
                        <span className="h-3.5 w-3.5 rounded-sm border border-white/30" style={{ backgroundColor: d.baseColor }} />
                        <span>{d.nameAr}</span>
                        <span className="text-[10px] text-slate-400">({d.target === 'skin' ? 'شخصية' : 'سلاح'})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'role' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/80 p-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">{role.nameAr}</span>
                <span className="text-xs font-bold text-amber-300">— {role.badgeAr}</span>
              </div>
              <p className="text-xs text-slate-300">{role.descriptionAr}</p>
              <div className="text-[11px] text-slate-400 tabular-nums">
                الصحة القصوى: {role.maxHp} • السرعة: {Math.round(role.speedMultiplier * 100)}% • نطاق التفجير:{' '}
                {Math.round(role.blastMultiplier * 100)}%
              </div>
            </div>

            <button
              type="button"
              onClick={onRerollRole}
              className="cursor-pointer shrink-0 rounded-xl border border-amber-400 bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400"
            >
              تبديل عشوائي للدور
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
