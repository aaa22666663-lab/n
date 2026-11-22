/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarrelId,
  CameraMode,
  CustomDesign,
  GamePhase,
  MagazineId,
  PersistedProfile,
  RoleDefinition,
  SaveDesignInput,
  ScopeId,
  UnderbarrelId,
  advanceMissionProgress,
  loadProfileFromStorage,
  rollRandomRole,
  saveCustomDesignTransaction,
  saveProfileToStorage,
} from './game/config';
import { DestroyedVoxelInfo } from './game/voxelGridLogic';
import { EngineSnapshot, GameEngine } from './game/gameEngine';
import { soundManager } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { CustomizeDrawer } from './components/CustomizeDrawer';
import { StudioModal } from './components/StudioModal';
import { PauseVictoryModal } from './components/PauseVictoryModal';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [profile, setProfile] = useState<PersistedProfile>(() => loadProfileFromStorage());
  const [role, setRole] = useState<RoleDefinition>(() => rollRandomRole());
  const [phase, setPhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1') {
      return 'playing';
    }
    return 'title';
  });

  const [snapshot, setSnapshot] = useState<EngineSnapshot>({
    hp: 140,
    maxHp: 140,
    score: 0,
    remainingBlocks: 0,
    initialBlocks: 0,
    enemiesDefeated: 0,
    cameraMode: 'tps',
    pointerLocked: false,
    isAiming: false,
  });

  const [muted, setMuted] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const roleRef = useRef(role);
  roleRef.current = role;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const cameraModeRef = useRef<CameraMode>('tps');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const updateProfile = useCallback((updater: (prev: PersistedProfile) => PersistedProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      saveProfileToStorage(next);
      return next;
    });
  }, []);

  const handleBlocksDestroyed = useCallback(
    (blocks: DestroyedVoxelInfo[], wasExplosion: boolean) => {
      if (blocks.length === 0 && !wasExplosion) return;

      const blockCp = blocks.reduce((acc, b) => acc + (b.kind === 7 ? 350 : 60), 0);
      const cpMult = roleRef.current.cpBonusMultiplier;

      let missionPopup: string | null = null;
      updateProfile((prev) => {
        let next = {
          ...prev,
          cp: prev.cp + Math.round(blockCp * cpMult),
          totalBlocksDestroyed: prev.totalBlocksDestroyed + blocks.length,
        };

        if (blocks.length > 0) {
          const mBlocks = advanceMissionProgress(next, 'destroy_blocks', blocks.length, cpMult);
          next = mBlocks.profile;
          if (mBlocks.completedMissionTitles.length > 0) {
            missionPopup = `مهمة مكتملة: ${mBlocks.completedMissionTitles[0]}`;
          }
        }

        if (wasExplosion) {
          const mExp = advanceMissionProgress(next, 'explosions', 1, cpMult);
          next = mExp.profile;
          if (!missionPopup && mExp.completedMissionTitles.length > 0) {
            missionPopup = `مهمة مكتملة: ${mExp.completedMissionTitles[0]}`;
          }
        }

        return next;
      });

      if (missionPopup) {
        soundManager.playMissionComplete();
        showToast(missionPopup);
      }
    },
    [showToast, updateProfile]
  );

  const handleEnemyHit = useCallback(
    (defeated: boolean) => {
      const cpMult = roleRef.current.cpBonusMultiplier;
      const hitCp = Math.round((defeated ? 650 : 120) * cpMult);
      let missionPopup: string | null = null;

      updateProfile((prev) => {
        const nextBase: PersistedProfile = {
          ...prev,
          cp: prev.cp + hitCp,
          totalHits: prev.totalHits + 1,
        };
        const mHit = advanceMissionProgress(nextBase, 'hit_targets', 1, cpMult);
        if (mHit.completedMissionTitles.length > 0) {
          missionPopup = `مهمة مكتملة: ${mHit.completedMissionTitles[0]}`;
        }
        return mHit.profile;
      });

      if (missionPopup) {
        soundManager.playMissionComplete();
        showToast(missionPopup);
      }
    },
    [showToast, updateProfile]
  );

  const handleToggleCamera = useCallback(() => {
    const next: CameraMode = cameraModeRef.current === 'tps' ? 'fps' : 'tps';
    cameraModeRef.current = next;
    engineRef.current?.setCameraMode(next);
    showToast(next === 'fps' ? 'تم التبديل إلى منظور الشخص الأول' : 'تم التبديل إلى منظور الشخص الثالث');
  }, [showToast]);

  const handlePauseToggle = useCallback(() => {
    setPhase((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      engineRef.current?.setPhase(next);
      return next;
    });
  }, []);

  // Stable refs for engine callbacks
  const callbacksRef = useRef({
    handleBlocksDestroyed,
    handleEnemyHit,
    handleToggleCamera,
    handlePauseToggle,
  });
  callbacksRef.current = {
    handleBlocksDestroyed,
    handleEnemyHit,
    handleToggleCamera,
    handlePauseToggle,
  };

  // Mount Three.js GameEngine once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const initialProfile = profileRef.current;
    const initialRole = roleRef.current;

    const engine = new GameEngine(container, initialProfile.weapon, initialRole, {
      onSnapshot: (snap) => setSnapshot(snap),
      onBlocksDestroyed: (blocks, wasExp) => callbacksRef.current.handleBlocksDestroyed(blocks, wasExp),
      onEnemyHit: (defeated) => callbacksRef.current.handleEnemyHit(defeated),
      onPlayerDefeated: () => {
        setPhase('gameover');
        engineRef.current?.setPhase('gameover');
      },
      onPhaseHotkeyPause: () => callbacksRef.current.handlePauseToggle(),
      onToggleCameraHotkey: () => callbacksRef.current.handleToggleCamera(),
    });

    engineRef.current = engine;

    const customSkin =
      initialProfile.selectedCustomSkinId
        ? initialProfile.customDesigns.find((d) => d.id === initialProfile.selectedCustomSkinId) || null
        : null;
    const customWeapon =
      initialProfile.weapon.customWeaponDesignId
        ? initialProfile.customDesigns.find((d) => d.id === initialProfile.weapon.customWeaponDesignId) || null
        : null;

    engine.applyCustomization(initialProfile.weapon, customWeapon, initialProfile.selectedSkinId, customSkin);
    engine.setPhase(phaseRef.current);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync customization changes to running 3D engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const customSkin = profile.selectedCustomSkinId
      ? profile.customDesigns.find((d) => d.id === profile.selectedCustomSkinId) || null
      : null;
    const customWeapon = profile.weapon.customWeaponDesignId
      ? profile.customDesigns.find((d) => d.id === profile.weapon.customWeaponDesignId) || null
      : null;
    engine.applyCustomization(profile.weapon, customWeapon, profile.selectedSkinId, customSkin);
  }, [profile.weapon, profile.selectedSkinId, profile.selectedCustomSkinId, profile.customDesigns]);

  const startGame = useCallback(() => {
    const assigned = rollRandomRole();
    setRole(assigned);
    setCustomizeOpen(false);
    setStudioOpen(false);
    setPhase('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.resetRound(assigned);
    engineRef.current?.setPhase('playing');
    showToast(`تم تعيين دورك العشوائي: ${assigned.nameAr}`);
  }, [showToast]);

  const handleRestartRound = useCallback(() => {
    const nextRole = rollRandomRole(role.id);
    setRole(nextRole);
    setPhase('playing');
    engineRef.current?.resetRound(nextRole);
    engineRef.current?.setPhase('playing');
    showToast(`جولة جديدة! دورك: ${nextRole.nameAr}`);
  }, [role.id, showToast]);

  const handleRerollRole = useCallback(() => {
    const nextRole = rollRandomRole(role.id);
    setRole(nextRole);
    engineRef.current?.applyRole(nextRole);
    showToast(`تم التبديل العشوائي إلى دور: ${nextRole.nameAr}`);
  }, [role.id, showToast]);

  const handleSelectAttachment = (
    slot: 'barrel' | 'magazine' | 'scope' | 'underbarrel',
    id: BarrelId | MagazineId | ScopeId | UnderbarrelId,
    cost: number
  ) => {
    if (cost > 0 && profile.cp < cost) {
      showToast(`تحتاج إلى ${cost.toLocaleString('en-US')} CP لفتح هذا الملحق`);
      return;
    }
    updateProfile((prev) => ({
      ...prev,
      cp: prev.cp - cost,
      unlockedAttachments: cost > 0 ? Array.from(new Set([...prev.unlockedAttachments, id])) : prev.unlockedAttachments,
      weapon: {
        ...prev.weapon,
        [slot]: id,
      },
    }));
  };

  const handleSelectColor = (colorId: string, cost: number) => {
    if (cost > 0 && profile.cp < cost) {
      showToast(`تحتاج إلى ${cost.toLocaleString('en-US')} CP لفتح هذا اللون`);
      return;
    }
    updateProfile((prev) => ({
      ...prev,
      cp: prev.cp - cost,
      unlockedColors: cost > 0 ? Array.from(new Set([...prev.unlockedColors, colorId])) : prev.unlockedColors,
      weapon: {
        ...prev.weapon,
        colorId,
        customWeaponDesignId: null,
      },
    }));
  };

  const handleSelectSkin = (skinId: string, cost: number) => {
    if (cost > 0 && profile.cp < cost) {
      showToast(`تحتاج إلى ${cost.toLocaleString('en-US')} CP لفتح هذا المظهر`);
      return;
    }
    updateProfile((prev) => ({
      ...prev,
      cp: prev.cp - cost,
      unlockedSkins: cost > 0 ? Array.from(new Set([...prev.unlockedSkins, skinId])) : prev.unlockedSkins,
      selectedSkinId: skinId,
      selectedCustomSkinId: null,
    }));
  };

  const handleSelectCustomDesign = (design: CustomDesign) => {
    updateProfile((prev) => ({
      ...prev,
      selectedCustomSkinId: design.target === 'skin' ? design.id : prev.selectedCustomSkinId,
      weapon:
        design.target === 'weapon'
          ? { ...prev.weapon, customWeaponDesignId: design.id }
          : prev.weapon,
    }));
    showToast(`تم تطبيق "${design.nameAr}"`);
  };

  const handleSaveStudioDesign = (input: SaveDesignInput) => {
    const res = saveCustomDesignTransaction(profileRef.current, input);
    if (res.ok) {
      setProfile(res.profile);
      saveProfileToStorage(res.profile);
      showToast(
        res.costPaid > 0
          ? `تم إنشاء "${res.design?.nameAr}" (-20,000 CP)`
          : `تم تحديث "${res.design?.nameAr}" مجاناً`
      );
    }
    return { ok: res.ok, errorAr: res.errorAr, costPaid: res.costPaid, design: res.design };
  };

  const handleGrantTestCp = (amount: number) => {
    updateProfile((prev) => ({ ...prev, cp: prev.cp + amount }));
    showToast(`تمت إضافة +${amount.toLocaleString('en-US')} CP للتجربة`);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950" dir="rtl">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-canvas-container"
        className="absolute inset-0 h-full w-full"
      />

      {phase === 'title' && !studioOpen && (
        <TitleScreen
          cp={profile.cp}
          onStart={startGame}
          onOpenStudio={() => setStudioOpen(true)}
        />
      )}

      {phase === 'playing' && (
        <GameHud
          hp={snapshot.hp}
          maxHp={snapshot.maxHp}
          score={snapshot.score}
          cp={profile.cp}
          remainingBlocks={snapshot.remainingBlocks}
          initialBlocks={snapshot.initialBlocks}
          role={role}
          cameraMode={snapshot.cameraMode}
          missions={profile.missions}
          muted={muted}
          customizeOpen={customizeOpen}
          toastMessage={toastMessage}
          onToggleCamera={handleToggleCamera}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            soundManager.setMuted(next);
          }}
          onPause={handlePauseToggle}
          onTestExplosion={() => engineRef.current?.triggerTestExplosion()}
          onResetArena={() => {
            engineRef.current?.resetArenaOnly();
            showToast('تمت إعادة بناء الساحة والقلعتين بالكامل');
          }}
          onToggleCustomize={() => setCustomizeOpen((v) => !v)}
          onOpenStudio={() => {
            setCustomizeOpen(false);
            setStudioOpen(true);
          }}
        />
      )}

      {phase === 'playing' && customizeOpen && !studioOpen && (
        <CustomizeDrawer
          profile={profile}
          role={role}
          onClose={() => setCustomizeOpen(false)}
          onSelectAttachment={handleSelectAttachment}
          onSelectColor={handleSelectColor}
          onSelectSkin={handleSelectSkin}
          onSelectCustomDesign={handleSelectCustomDesign}
          onRerollRole={handleRerollRole}
          onGrantTestCp={() => handleGrantTestCp(10000)}
        />
      )}

      {studioOpen && (
        <StudioModal
          cp={profile.cp}
          ownedDesigns={profile.customDesigns}
          onClose={() => setStudioOpen(false)}
          onSaveDesign={handleSaveStudioDesign}
          onGrantTestCp={() => handleGrantTestCp(20000)}
        />
      )}

      {(phase === 'paused' || phase === 'gameover') && !studioOpen && (
        <PauseVictoryModal
          phase={phase}
          score={snapshot.score}
          cp={profile.cp}
          enemiesDefeated={snapshot.enemiesDefeated}
          role={role}
          onResume={() => {
            setPhase('playing');
            engineRef.current?.setPhase('playing');
          }}
          onRestartRound={handleRestartRound}
          onBackToTitle={() => {
            setCustomizeOpen(false);
            setPhase('title');
            engineRef.current?.setPhase('title');
          }}
        />
      )}
    </div>
  );
}
