/**
 * Config & State Module
 * Holds constants, role definitions, modular weapon attachments,
 * missions, CP economy rules, and safe localStorage persistence.
 */

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type CameraMode = 'tps' | 'fps';
export type RoleId = 'commander' | 'general' | 'soldier';

export type BarrelId = 'standard' | 'long' | 'suppressor';
export type MagazineId = 'standard' | 'extended' | 'heavy';
export type ScopeId = 'iron' | 'red_dot' | 'sniper';
export type UnderbarrelId = 'grip' | 'launcher';

export type DesignTarget = 'skin' | 'weapon';
export type PatternType = 'none' | 'stripes' | 'camo' | 'checker' | 'stars';

export interface RoleDefinition {
  id: RoleId;
  nameAr: string;
  badgeAr: string;
  descriptionAr: string;
  maxHp: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  blastMultiplier: number;
  cpBonusMultiplier: number;
  accentHex: string;
  helmetColor: number;
  badgeColor: number;
}

export interface AttachmentOption<T extends string> {
  id: T;
  nameAr: string;
  effectAr: string;
  cost: number;
}

export interface WeaponConfig {
  barrel: BarrelId;
  magazine: MagazineId;
  scope: ScopeId;
  underbarrel: UnderbarrelId;
  colorId: string;
  customWeaponDesignId: string | null;
}

export interface PresetColor {
  id: string;
  nameAr: string;
  hex: string;
  metalness: number;
  roughness: number;
  cost: number;
}

export interface PresetSkin {
  id: string;
  nameAr: string;
  torsoHex: string;
  limbHex: string;
  headHex: string;
  cost: number;
}

export interface CustomDesign {
  id: string;
  nameAr: string;
  target: DesignTarget;
  baseColor: string;
  accentColor: string;
  pattern: PatternType;
  emblemText: string;
  /** Serialized 128x128 canvas dataURL for restoring & re-editing freehand strokes */
  canvasDataUrl: string;
  updatedAt: number;
}

export interface MissionProgress {
  id: string;
  titleAr: string;
  type: 'destroy_blocks' | 'hit_targets' | 'explosions';
  targetCount: number;
  currentCount: number;
  rewardCp: number;
  completedCount: number;
}

export interface PersistedProfile {
  version: number;
  cp: number;
  unlockedColors: string[];
  unlockedSkins: string[];
  unlockedAttachments: string[];
  customDesigns: CustomDesign[];
  selectedSkinId: string;
  selectedCustomSkinId: string | null;
  weapon: WeaponConfig;
  missions: MissionProgress[];
  totalBlocksDestroyed: number;
  totalHits: number;
}

export const STORAGE_KEY = 'voxel_castles_ar_profile_v1';
export const CUSTOM_DESIGN_COST = 20000;
export const STARTER_CP = 25000;

export const VOXEL_SIZE = 1.5;
export const ARENA_GRID_X = 28;
export const ARENA_GRID_Y = 12;
export const ARENA_GRID_Z = 28;

export const ROLES: Record<RoleId, RoleDefinition> = {
  commander: {
    id: 'commander',
    nameAr: 'قائد',
    badgeAr: 'تاج القيادة',
    descriptionAr: 'سرعة متوازنة ومكافأة CP إضافية +25%',
    maxHp: 140,
    speedMultiplier: 1.08,
    jumpMultiplier: 1.05,
    blastMultiplier: 1.05,
    cpBonusMultiplier: 1.25,
    accentHex: '#f59e0b',
    helmetColor: 0xf59e0b,
    badgeColor: 0xfbbf24,
  },
  general: {
    id: 'general',
    nameAr: 'لواء',
    badgeAr: 'درع المدفعية',
    descriptionAr: 'درع ثقيل 180 HP ونطاق تفجير أوسع +20%',
    maxHp: 180,
    speedMultiplier: 0.96,
    jumpMultiplier: 0.98,
    blastMultiplier: 1.2,
    cpBonusMultiplier: 1.1,
    accentHex: '#ef4444',
    helmetColor: 0xdc2626,
    badgeColor: 0xe2e8f0,
  },
  soldier: {
    id: 'soldier',
    nameAr: 'جندي',
    badgeAr: 'نخبة الاقتحام',
    descriptionAr: 'أسرع حركة +16% وقفزة أعلى لاقتحام القلعة',
    maxHp: 115,
    speedMultiplier: 1.16,
    jumpMultiplier: 1.14,
    blastMultiplier: 1.0,
    cpBonusMultiplier: 1.0,
    accentHex: '#38bdf8',
    helmetColor: 0x0284c7,
    badgeColor: 0x7dd3fc,
  },
};

export const ROLE_ORDER: RoleId[] = ['commander', 'general', 'soldier'];

export const BARREL_OPTIONS: AttachmentOption<BarrelId>[] = [
  { id: 'standard', nameAr: 'سبطانة قياسية', effectAr: 'أداء متوازن وسرعة إطلاق قياسية', cost: 0 },
  { id: 'long', nameAr: 'سبطانة طويلة', effectAr: 'سرعة مقذوف أعلى +35% ومدى بعيد', cost: 0 },
  { id: 'suppressor', nameAr: 'كاتم تكتيكي', effectAr: 'ارتداد أقل وصوت مكتوم دقيق', cost: 1500 },
];

export const MAGAZINE_OPTIONS: AttachmentOption<MagazineId>[] = [
  { id: 'standard', nameAr: 'مخزن قياسي', effectAr: 'معدل إطلاق ثابت', cost: 0 },
  { id: 'extended', nameAr: 'مخزن موسّع', effectAr: 'إطلاق أسرع +30%', cost: 0 },
  { id: 'heavy', nameAr: 'مخزن خارق', effectAr: 'قوة تفجير إضافية +25%', cost: 2000 },
];

export const SCOPE_OPTIONS: AttachmentOption<ScopeId>[] = [
  { id: 'iron', nameAr: 'تصويب حديدي', effectAr: 'رؤية واسعة سريعة', cost: 0 },
  { id: 'red_dot', nameAr: 'منظار نقطة حمراء', effectAr: 'تقريب متوسط ودقة عالية', cost: 0 },
  { id: 'sniper', nameAr: 'منظار قنص بعيد', effectAr: 'تقريب بعيد المدى عند التصويب', cost: 2500 },
];

export const UNDERBARREL_OPTIONS: AttachmentOption<UnderbarrelId>[] = [
  { id: 'grip', nameAr: 'قبضة تكتيكية', effectAr: 'ثبات فائق وارتداد منخفض', cost: 0 },
  { id: 'launcher', nameAr: 'قاذف متفجرات', effectAr: 'طلقات متفجرة تدمر كتل القلعة', cost: 0 },
];

export const PRESET_COLORS: PresetColor[] = [
  { id: 'cobalt', nameAr: 'أزرق كوبالت', hex: '#2563eb', metalness: 0.35, roughness: 0.35, cost: 0 },
  { id: 'crimson', nameAr: 'قرمزي ناري', hex: '#dc2626', metalness: 0.35, roughness: 0.38, cost: 0 },
  { id: 'gold', nameAr: 'ذهبي ملكي', hex: '#eab308', metalness: 0.78, roughness: 0.22, cost: 3000 },
  { id: 'emerald', nameAr: 'زمردي مشع', hex: '#10b981', metalness: 0.45, roughness: 0.3, cost: 2000 },
  { id: 'obsidian', nameAr: 'أوبسيديان داكن', hex: '#1e293b', metalness: 0.65, roughness: 0.28, cost: 0 },
];

export const PRESET_SKINS: PresetSkin[] = [
  {
    id: 'rookie_blue',
    nameAr: 'محارب القلعة الزرقاء',
    torsoHex: '#2563eb',
    limbHex: '#1e293b',
    headHex: '#fbbf24',
    cost: 0,
  },
  {
    id: 'desert_ops',
    nameAr: 'قوات الصحراء',
    torsoHex: '#d97706',
    limbHex: '#78350f',
    headHex: '#fde68a',
    cost: 0,
  },
  {
    id: 'royal_guard',
    nameAr: 'الحرس الملكي',
    torsoHex: '#7c3aed',
    limbHex: '#0f172a',
    headHex: '#f8fafc',
    cost: 3500,
  },
  {
    id: 'crimson_titan',
    nameAr: 'عملاق القلعة الحمراء',
    torsoHex: '#b91c1c',
    limbHex: '#27272a',
    headHex: '#fca5a5',
    cost: 2500,
  },
];

export interface WeaponComputedStats {
  projectileSpeed: number;
  cooldownSec: number;
  blastRadius: number;
  isExplosivePrimary: boolean;
  recoilAmount: number;
  zoomFov: number;
  damagePerHit: number;
}

export function computeWeaponStats(
  weapon: WeaponConfig,
  role: RoleDefinition
): WeaponComputedStats {
  const barrelSpeed = weapon.barrel === 'long' ? 48 : weapon.barrel === 'suppressor' ? 38 : 36;
  const magCooldown = weapon.magazine === 'extended' ? 0.2 : weapon.magazine === 'heavy' ? 0.34 : 0.28;
  const magBlast = weapon.magazine === 'heavy' ? 1.25 : 1.0;
  const underbarrelBlast = weapon.underbarrel === 'launcher' ? 2.85 : 1.45;
  const recoil =
    (weapon.underbarrel === 'grip' ? 0.45 : 0.95) *
    (weapon.barrel === 'suppressor' ? 0.72 : 1.0);
  const zoomFov = weapon.scope === 'sniper' ? 38 : weapon.scope === 'red_dot' ? 54 : 68;
  const damagePerHit =
    (weapon.magazine === 'heavy' ? 42 : 30) *
    (weapon.underbarrel === 'launcher' ? 1.35 : 1.0);

  return {
    projectileSpeed: barrelSpeed,
    cooldownSec: magCooldown,
    blastRadius: underbarrelBlast * magBlast * role.blastMultiplier,
    isExplosivePrimary: weapon.underbarrel === 'launcher',
    recoilAmount: recoil,
    zoomFov,
    damagePerHit: Math.round(damagePerHit),
  };
}

export function createDefaultMissions(): MissionProgress[] {
  return [
    {
      id: 'm_blocks',
      titleAr: 'دمر 12 كتلة من ساحة العدو',
      type: 'destroy_blocks',
      targetCount: 12,
      currentCount: 0,
      rewardCp: 5000,
      completedCount: 0,
    },
    {
      id: 'm_hits',
      titleAr: 'أصِب 3 من حراس القلعة',
      type: 'hit_targets',
      targetCount: 3,
      currentCount: 0,
      rewardCp: 6500,
      completedCount: 0,
    },
    {
      id: 'm_explosions',
      titleAr: 'نفّذ 3 تفجيرات تكتيكية',
      type: 'explosions',
      targetCount: 3,
      currentCount: 0,
      rewardCp: 4000,
      completedCount: 0,
    },
  ];
}

export function createDefaultProfile(): PersistedProfile {
  return {
    version: 1,
    cp: STARTER_CP,
    unlockedColors: ['cobalt', 'crimson', 'obsidian'],
    unlockedSkins: ['rookie_blue', 'desert_ops'],
    unlockedAttachments: ['standard', 'long', 'extended', 'iron', 'red_dot', 'grip', 'launcher'],
    customDesigns: [],
    selectedSkinId: 'rookie_blue',
    selectedCustomSkinId: null,
    weapon: {
      barrel: 'standard',
      magazine: 'standard',
      scope: 'red_dot',
      underbarrel: 'launcher',
      colorId: 'cobalt',
      customWeaponDesignId: null,
    },
    missions: createDefaultMissions(),
    totalBlocksDestroyed: 0,
    totalHits: 0,
  };
}

/**
 * Safely parses stored profile JSON, falling back cleanly if empty or corrupted.
 */
export function parsePersistedProfile(raw: string | null): PersistedProfile {
  const fallback = createDefaultProfile();
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedProfile> | null;
    if (!parsed || typeof parsed !== 'object') return fallback;

    const cp =
      typeof parsed.cp === 'number' && Number.isFinite(parsed.cp) && parsed.cp >= 0
        ? Math.floor(parsed.cp)
        : fallback.cp;

    const unlockedColors = Array.isArray(parsed.unlockedColors)
      ? Array.from(new Set([...fallback.unlockedColors, ...parsed.unlockedColors.filter((x) => typeof x === 'string')]))
      : fallback.unlockedColors;

    const unlockedSkins = Array.isArray(parsed.unlockedSkins)
      ? Array.from(new Set([...fallback.unlockedSkins, ...parsed.unlockedSkins.filter((x) => typeof x === 'string')]))
      : fallback.unlockedSkins;

    const unlockedAttachments = Array.isArray(parsed.unlockedAttachments)
      ? Array.from(
          new Set([...fallback.unlockedAttachments, ...parsed.unlockedAttachments.filter((x) => typeof x === 'string')])
        )
      : fallback.unlockedAttachments;

    const customDesigns = Array.isArray(parsed.customDesigns)
      ? parsed.customDesigns.filter(
          (d): d is CustomDesign =>
            Boolean(d) &&
            typeof d.id === 'string' &&
            typeof d.nameAr === 'string' &&
            (d.target === 'skin' || d.target === 'weapon') &&
            typeof d.baseColor === 'string' &&
            typeof d.canvasDataUrl === 'string'
        )
      : [];

    const weaponObj = parsed.weapon && typeof parsed.weapon === 'object' ? parsed.weapon : fallback.weapon;
    const weapon: WeaponConfig = {
      barrel: weaponObj.barrel === 'long' || weaponObj.barrel === 'suppressor' ? weaponObj.barrel : 'standard',
      magazine: weaponObj.magazine === 'extended' || weaponObj.magazine === 'heavy' ? weaponObj.magazine : 'standard',
      scope: weaponObj.scope === 'iron' || weaponObj.scope === 'sniper' ? weaponObj.scope : 'red_dot',
      underbarrel: weaponObj.underbarrel === 'grip' ? 'grip' : 'launcher',
      colorId: typeof weaponObj.colorId === 'string' ? weaponObj.colorId : 'cobalt',
      customWeaponDesignId: typeof weaponObj.customWeaponDesignId === 'string' ? weaponObj.customWeaponDesignId : null,
    };

    const missions =
      Array.isArray(parsed.missions) && parsed.missions.length === 3
        ? parsed.missions.map((m, i) => {
            const def = fallback.missions[i];
            if (!m || typeof m !== 'object') return def;
            return {
              ...def,
              currentCount: typeof m.currentCount === 'number' && Number.isFinite(m.currentCount) ? Math.max(0, m.currentCount) : 0,
              completedCount:
                typeof m.completedCount === 'number' && Number.isFinite(m.completedCount) ? Math.max(0, m.completedCount) : 0,
              targetCount: typeof m.targetCount === 'number' && m.targetCount > 0 ? m.targetCount : def.targetCount,
              rewardCp: typeof m.rewardCp === 'number' && m.rewardCp > 0 ? m.rewardCp : def.rewardCp,
            };
          })
        : fallback.missions;

    return {
      version: 1,
      cp,
      unlockedColors,
      unlockedSkins,
      unlockedAttachments,
      customDesigns,
      selectedSkinId: typeof parsed.selectedSkinId === 'string' ? parsed.selectedSkinId : fallback.selectedSkinId,
      selectedCustomSkinId: typeof parsed.selectedCustomSkinId === 'string' ? parsed.selectedCustomSkinId : null,
      weapon,
      missions,
      totalBlocksDestroyed:
        typeof parsed.totalBlocksDestroyed === 'number' && Number.isFinite(parsed.totalBlocksDestroyed)
          ? Math.max(0, parsed.totalBlocksDestroyed)
          : 0,
      totalHits:
        typeof parsed.totalHits === 'number' && Number.isFinite(parsed.totalHits)
          ? Math.max(0, parsed.totalHits)
          : 0,
    };
  } catch {
    return fallback;
  }
}

export function loadProfileFromStorage(): PersistedProfile {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultProfile();
    }
    return parsePersistedProfile(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfileToStorage(profile: PersistedProfile): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota/storage errors in restricted environments
  }
}

/**
 * Pure CP Studio transaction:
 * - Creating a brand new custom design costs CUSTOM_DESIGN_COST (20,000 CP).
 * - Re-editing an already owned custom design is FREE (0 CP, unlimited edits).
 */
export interface SaveDesignInput {
  existingDesignId: string | null;
  nameAr: string;
  target: DesignTarget;
  baseColor: string;
  accentColor: string;
  pattern: PatternType;
  emblemText: string;
  canvasDataUrl: string;
}

export interface SaveDesignResult {
  ok: boolean;
  errorAr?: string;
  costPaid: number;
  design?: CustomDesign;
  profile: PersistedProfile;
}

export function saveCustomDesignTransaction(
  profile: PersistedProfile,
  input: SaveDesignInput
): SaveDesignResult {
  const trimmedName = input.nameAr.trim() || (input.target === 'skin' ? 'مظهر مخصص' : 'طلاء سلاح مخصص');

  if (input.existingDesignId) {
    const idx = profile.customDesigns.findIndex((d) => d.id === input.existingDesignId);
    if (idx !== -1) {
      // Free unlimited re-edit of owned design
      const updated: CustomDesign = {
        ...profile.customDesigns[idx],
        nameAr: trimmedName,
        target: input.target,
        baseColor: input.baseColor,
        accentColor: input.accentColor,
        pattern: input.pattern,
        emblemText: input.emblemText.trim().slice(0, 10),
        canvasDataUrl: input.canvasDataUrl,
        updatedAt: Date.now(),
      };
      const nextDesigns = [...profile.customDesigns];
      nextDesigns[idx] = updated;
      const nextProfile: PersistedProfile = {
        ...profile,
        customDesigns: nextDesigns,
        selectedCustomSkinId: updated.target === 'skin' ? updated.id : profile.selectedCustomSkinId,
        weapon:
          updated.target === 'weapon'
            ? { ...profile.weapon, customWeaponDesignId: updated.id }
            : profile.weapon,
      };
      return { ok: true, costPaid: 0, design: updated, profile: nextProfile };
    }
  }

  // Creating a new custom design requires 20,000 CP
  if (profile.cp < CUSTOM_DESIGN_COST) {
    return {
      ok: false,
      errorAr: `تحتاج إلى ${CUSTOM_DESIGN_COST.toLocaleString('en-US')} CP لإنشاء تصميم مخصص جديد!`,
      costPaid: 0,
      profile,
    };
  }

  const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created: CustomDesign = {
    id: newId,
    nameAr: trimmedName,
    target: input.target,
    baseColor: input.baseColor,
    accentColor: input.accentColor,
    pattern: input.pattern,
    emblemText: input.emblemText.trim().slice(0, 10),
    canvasDataUrl: input.canvasDataUrl,
    updatedAt: Date.now(),
  };

  const nextProfile: PersistedProfile = {
    ...profile,
    cp: profile.cp - CUSTOM_DESIGN_COST,
    customDesigns: [created, ...profile.customDesigns],
    selectedCustomSkinId: created.target === 'skin' ? created.id : profile.selectedCustomSkinId,
    weapon:
      created.target === 'weapon'
        ? { ...profile.weapon, customWeaponDesignId: created.id }
        : profile.weapon,
  };

  return { ok: true, costPaid: CUSTOM_DESIGN_COST, design: created, profile: nextProfile };
}

export function advanceMissionProgress(
  profile: PersistedProfile,
  eventType: MissionProgress['type'],
  amount: number,
  cpMultiplier = 1
): { profile: PersistedProfile; completedMissionTitles: string[]; cpEarned: number } {
  if (amount <= 0) {
    return { profile, completedMissionTitles: [], cpEarned: 0 };
  }

  let cpEarned = 0;
  const completedMissionTitles: string[] = [];

  const nextMissions = profile.missions.map((m) => {
    if (m.type !== eventType) return m;
    let current = m.currentCount + amount;
    let completed = m.completedCount;
    let target = m.targetCount;
    let reward = m.rewardCp;

    while (current >= target) {
      current -= target;
      completed += 1;
      const earned = Math.round(reward * cpMultiplier);
      cpEarned += earned;
      completedMissionTitles.push(`${m.titleAr} (+${earned.toLocaleString('en-US')} CP)`);
      // Scale next tier mildly so player always has fresh missions
      target = Math.round(target * 1.4);
      reward = Math.round(reward * 1.25);
    }

    return {
      ...m,
      currentCount: current,
      completedCount: completed,
      targetCount: target,
      rewardCp: reward,
    };
  });

  return {
    profile: {
      ...profile,
      cp: profile.cp + cpEarned,
      missions: nextMissions,
    },
    completedMissionTitles,
    cpEarned,
  };
}

export function rollRandomRole(prevRole?: RoleId): RoleDefinition {
  const candidates = prevRole && ROLE_ORDER.length > 1
    ? ROLE_ORDER.filter((r) => r !== prevRole)
    : ROLE_ORDER;
  const picked = candidates[Math.floor(Math.random() * candidates.length)] || 'commander';
  return ROLES[picked];
}
