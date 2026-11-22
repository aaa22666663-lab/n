import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_DESIGN_COST,
  ROLES,
  STARTER_CP,
  advanceMissionProgress,
  computeWeaponStats,
  createDefaultProfile,
  parsePersistedProfile,
  rollRandomRole,
  saveCustomDesignTransaction,
} from './config';
import { VoxelGridData, gridToWorldCenter } from './voxelGridLogic';

test('parsePersistedProfile safely recovers from null, empty, or corrupted JSON', () => {
  const fromNull = parsePersistedProfile(null);
  assert.equal(fromNull.cp, STARTER_CP);
  assert.equal(fromNull.customDesigns.length, 0);

  const fromCorrupt = parsePersistedProfile('{not valid json!!!');
  assert.equal(fromCorrupt.cp, STARTER_CP);
  assert.equal(fromCorrupt.missions.length, 3);

  const fromPartial = parsePersistedProfile(JSON.stringify({ cp: -500, customDesigns: 'bad' }));
  assert.equal(fromPartial.cp, STARTER_CP);
  assert.deepEqual(fromPartial.customDesigns, []);
});

test('20,000 CP Studio charges 20,000 CP for a new design and is FREE on re-edit', () => {
  let profile = createDefaultProfile();
  assert.equal(profile.cp, 25000);

  // Create first new custom design -> deducts 20,000 CP
  const createRes = saveCustomDesignTransaction(profile, {
    existingDesignId: null,
    nameAr: 'درع التنين',
    target: 'skin',
    baseColor: '#2563eb',
    accentColor: '#facc15',
    pattern: 'stripes',
    emblemText: 'قائد',
    canvasDataUrl: 'data:image/png;base64,AAA',
  });
  assert.equal(createRes.ok, true);
  assert.equal(createRes.costPaid, CUSTOM_DESIGN_COST);
  assert.equal(createRes.profile.cp, 5000);
  assert.equal(createRes.profile.customDesigns.length, 1);
  const ownedId = createRes.design!.id;
  profile = createRes.profile;

  // Re-edit the owned design -> FREE (0 CP), even though balance is only 5,000 CP!
  const editRes = saveCustomDesignTransaction(profile, {
    existingDesignId: ownedId,
    nameAr: 'درع التنين المطور',
    target: 'skin',
    baseColor: '#dc2626',
    accentColor: '#ffffff',
    pattern: 'stars',
    emblemText: 'نصر',
    canvasDataUrl: 'data:image/png;base64,BBB',
  });
  assert.equal(editRes.ok, true);
  assert.equal(editRes.costPaid, 0);
  assert.equal(editRes.profile.cp, 5000);
  assert.equal(editRes.profile.customDesigns[0].nameAr, 'درع التنين المطور');

  // Trying to create a SECOND new custom design with only 5,000 CP fails cleanly
  const failRes = saveCustomDesignTransaction(editRes.profile, {
    existingDesignId: null,
    nameAr: 'تصميم ثانٍ',
    target: 'weapon',
    baseColor: '#10b981',
    accentColor: '#0f172a',
    pattern: 'camo',
    emblemText: '',
    canvasDataUrl: 'data:image/png;base64,CCC',
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.profile.cp, 5000);
});

test('Mission progression awards CP and scales target cleanly', () => {
  const profile = createDefaultProfile();
  const res = advanceMissionProgress(profile, 'destroy_blocks', 12, ROLES.commander.cpBonusMultiplier);
  assert.equal(res.cpEarned, Math.round(5000 * 1.25));
  assert.equal(res.profile.cp, STARTER_CP + Math.round(5000 * 1.25));
  assert.equal(res.completedMissionTitles.length, 1);
  assert.equal(res.profile.missions[0].completedCount, 1);
});

test('VoxelGridData builds two castles, destroys blocks on explosion, and resets cleanly', () => {
  const grid = new VoxelGridData();
  const initialCount = grid.activeCount;
  assert.ok(initialCount > 150, 'Arena should contain castle and cover blocks');

  // Spawn lane at center-blue side (gx=13, gy=0, gz=7) must be open
  assert.equal(grid.getCell(13, 0, 7), 0);
  assert.equal(grid.getCell(13, 1, 7), 0);

  // Target red castle gate header / front wall at (11, 1, 22)
  assert.equal(grid.getCell(11, 1, 22), 3);
  const targetWorld = gridToWorldCenter(11, 1, 22);
  const destroyed = grid.applyExplosion(targetWorld.x, targetWorld.y, targetWorld.z, 3.2);
  assert.ok(destroyed.length >= 4, 'Explosion should destroy nearby castle blocks');
  assert.equal(grid.getCell(11, 1, 22), 0);
  assert.equal(grid.activeCount, initialCount - destroyed.length);

  // Reset restores exact initial count and blocks
  grid.resetArena();
  assert.equal(grid.activeCount, initialCount);
  assert.equal(grid.getCell(11, 1, 22), 3);
});

test('Weapon stats and random roles compute accurately', () => {
  const profile = createDefaultProfile();
  const stats = computeWeaponStats(
    { ...profile.weapon, barrel: 'long', magazine: 'heavy', underbarrel: 'launcher', scope: 'sniper' },
    ROLES.general
  );
  assert.equal(stats.projectileSpeed, 48);
  assert.equal(stats.zoomFov, 38);
  assert.ok(stats.blastRadius > 3.5);

  const nextRole = rollRandomRole('commander');
  assert.ok(nextRole.id === 'general' || nextRole.id === 'soldier');
});
