import * as THREE from 'three';
import {
  CustomDesign,
  PRESET_SKINS,
  ROLES,
  RoleId,
} from './config';
import { createTextureFromDataUrl } from './weaponSystem';
import { ARENA_HALF_EXTENT, VoxelGridData } from './voxelGridLogic';

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.55)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class BlockyCharacterRig {
  public readonly root = new THREE.Group();
  public readonly bodyGroup = new THREE.Group();
  public readonly headGroup = new THREE.Group();
  public readonly leftArmPivot = new THREE.Group();
  public readonly rightArmPivot = new THREE.Group();
  public readonly leftLegPivot = new THREE.Group();
  public readonly rightLegPivot = new THREE.Group();
  public readonly weaponMount = new THREE.Group();

  private readonly torsoMat: THREE.MeshStandardMaterial;
  private readonly limbMat: THREE.MeshStandardMaterial;
  private readonly headMat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshStandardMaterial;
  private readonly visorMat: THREE.MeshStandardMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly shadowTex: THREE.CanvasTexture;
  private readonly shadowMesh: THREE.Mesh;

  private readonly crownCrest: THREE.Group;
  private readonly generalHelmet: THREE.Group;
  private readonly soldierVisor: THREE.Group;

  private dynamicSkinTexture: THREE.Texture | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private gaitPhase = 0;
  private squashY = 1;
  private squashXZ = 1;

  constructor(enableShadows: boolean, isEnemy = false) {
    this.torsoMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xdc2626 : 0x2563eb,
      roughness: 0.52,
      metalness: 0.12,
    });
    this.limbMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0x18181b : 0x1e293b,
      roughness: 0.65,
      metalness: 0.1,
    });
    this.headMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xfca5a5 : 0xfbbf24,
      roughness: 0.48,
      metalness: 0.05,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xfef08a : 0xf59e0b,
      roughness: 0.25,
      metalness: 0.65,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.5,
    });

    this.root.add(this.bodyGroup);

    // Contact shadow disc grounded at y = 0.02
    this.shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.CircleGeometry(0.62, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    this.geometries.push(shadowGeo);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.shadowMesh.position.y = 0.02;
    this.root.add(this.shadowMesh);

    // --- LEGS (height 0.75, hip pivot at y = 0.75) ---
    const legGeo = new THREE.BoxGeometry(0.36, 0.75, 0.38);
    const bootGeo = new THREE.BoxGeometry(0.38, 0.18, 0.42);
    this.geometries.push(legGeo, bootGeo);

    const buildLeg = (pivot: THREE.Group, xOffset: number) => {
      pivot.position.set(xOffset, 0.75, 0);
      const leg = new THREE.Mesh(legGeo, this.limbMat);
      leg.position.y = -0.375;
      leg.castShadow = enableShadows;
      const boot = new THREE.Mesh(bootGeo, this.visorMat);
      boot.position.set(0, -0.66, 0.02);
      pivot.add(leg, boot);
      this.bodyGroup.add(pivot);
    };
    buildLeg(this.leftLegPivot, -0.2);
    buildLeg(this.rightLegPivot, 0.2);

    // --- TORSO (y = 0.75 to 1.60) ---
    const torsoGeo = new THREE.BoxGeometry(0.84, 0.85, 0.44);
    const chestPlateGeo = new THREE.BoxGeometry(0.68, 0.52, 0.08);
    const badgeGeo = new THREE.BoxGeometry(0.24, 0.24, 0.04);
    this.geometries.push(torsoGeo, chestPlateGeo, badgeGeo);

    const torsoMesh = new THREE.Mesh(torsoGeo, this.torsoMat);
    torsoMesh.position.y = 1.175;
    torsoMesh.castShadow = enableShadows;
    torsoMesh.receiveShadow = enableShadows;

    const chestPlate = new THREE.Mesh(chestPlateGeo, this.limbMat);
    chestPlate.position.set(0, 1.24, 0.24);

    const badge = new THREE.Mesh(badgeGeo, this.accentMat);
    badge.position.set(0, 1.3, 0.285);

    this.bodyGroup.add(torsoMesh, chestPlate, badge);

    // --- ARMS (shoulder pivot at y = 1.54) ---
    const armGeo = new THREE.BoxGeometry(0.32, 0.76, 0.34);
    const cuffGeo = new THREE.BoxGeometry(0.35, 0.16, 0.37);
    this.geometries.push(armGeo, cuffGeo);

    this.leftArmPivot.position.set(-0.6, 1.54, 0);
    const lArm = new THREE.Mesh(armGeo, this.limbMat);
    lArm.position.y = -0.34;
    lArm.castShadow = enableShadows;
    const lCuff = new THREE.Mesh(cuffGeo, this.accentMat);
    lCuff.position.y = -0.62;
    this.leftArmPivot.add(lArm, lCuff);

    this.rightArmPivot.position.set(0.6, 1.54, 0);
    const rArm = new THREE.Mesh(armGeo, this.limbMat);
    rArm.position.y = -0.34;
    rArm.castShadow = enableShadows;
    const rCuff = new THREE.Mesh(cuffGeo, this.accentMat);
    rCuff.position.y = -0.62;
    this.weaponMount.position.set(0, -0.68, 0.26);
    this.weaponMount.rotation.x = Math.PI / 2;
    this.rightArmPivot.add(rArm, rCuff, this.weaponMount);

    this.bodyGroup.add(this.leftArmPivot, this.rightArmPivot);

    // --- HEAD (neck at y = 1.62) ---
    this.headGroup.position.set(0, 1.62, 0);
    const headGeo = new THREE.BoxGeometry(0.58, 0.56, 0.56);
    const eyeGeo = new THREE.BoxGeometry(0.11, 0.11, 0.04);
    const mouthGeo = new THREE.BoxGeometry(0.22, 0.05, 0.04);
    this.geometries.push(headGeo, eyeGeo, mouthGeo);

    const headMesh = new THREE.Mesh(headGeo, this.headMat);
    headMesh.position.y = 0.28;
    headMesh.castShadow = enableShadows;

    const leftEye = new THREE.Mesh(eyeGeo, this.visorMat);
    leftEye.position.set(-0.13, 0.31, 0.285);
    const rightEye = new THREE.Mesh(eyeGeo, this.visorMat);
    rightEye.position.set(0.13, 0.31, 0.285);
    const mouth = new THREE.Mesh(mouthGeo, this.visorMat);
    mouth.position.set(0, 0.16, 0.285);

    this.headGroup.add(headMesh, leftEye, rightEye, mouth);

    // Role Headgear 1: Commander Crown Crest
    this.crownCrest = new THREE.Group();
    const crownBandGeo = new THREE.BoxGeometry(0.64, 0.12, 0.62);
    const crownSpikeGeo = new THREE.BoxGeometry(0.12, 0.18, 0.12);
    this.geometries.push(crownBandGeo, crownSpikeGeo);
    const crownBand = new THREE.Mesh(crownBandGeo, this.accentMat);
    crownBand.position.y = 0.56;
    this.crownCrest.add(crownBand);
    for (const sx of [-0.22, 0, 0.22]) {
      const spike = new THREE.Mesh(crownSpikeGeo, this.accentMat);
      spike.position.set(sx, 0.68, 0.24);
      this.crownCrest.add(spike);
    }
    this.headGroup.add(this.crownCrest);

    // Role Headgear 2: General Heavy Helmet
    this.generalHelmet = new THREE.Group();
    const helmTopGeo = new THREE.BoxGeometry(0.66, 0.22, 0.64);
    const helmSideGeo = new THREE.BoxGeometry(0.7, 0.34, 0.44);
    this.geometries.push(helmTopGeo, helmSideGeo);
    const helmTop = new THREE.Mesh(helmTopGeo, this.accentMat);
    helmTop.position.y = 0.54;
    const helmSide = new THREE.Mesh(helmSideGeo, this.limbMat);
    helmSide.position.set(0, 0.36, -0.06);
    this.generalHelmet.add(helmTop, helmSide);
    this.headGroup.add(this.generalHelmet);

    // Role Headgear 3: Soldier Tactical Cap & Goggles
    this.soldierVisor = new THREE.Group();
    const capGeo = new THREE.BoxGeometry(0.62, 0.14, 0.62);
    const brimGeo = new THREE.BoxGeometry(0.56, 0.06, 0.22);
    this.geometries.push(capGeo, brimGeo);
    const cap = new THREE.Mesh(capGeo, this.accentMat);
    cap.position.y = 0.54;
    const brim = new THREE.Mesh(brimGeo, this.visorMat);
    brim.position.set(0, 0.48, 0.34);
    this.soldierVisor.add(cap, brim);
    this.headGroup.add(this.soldierVisor);

    this.bodyGroup.add(this.headGroup);
    this.applyRoleVisuals('commander');
  }

  public applyRoleVisuals(roleId: RoleId): void {
    const role = ROLES[roleId];
    this.accentMat.color.setHex(role.badgeColor);
    this.crownCrest.visible = roleId === 'commander';
    this.generalHelmet.visible = roleId === 'general';
    this.soldierVisor.visible = roleId === 'soldier';
  }

  public setBodyVisible(visible: boolean): void {
    this.bodyGroup.visible = visible;
    this.shadowMesh.visible = visible;
  }

  public applySkin(
    skinId: string,
    customDesign: CustomDesign | null,
    maxAniso: number
  ): void {
    if (customDesign && customDesign.target === 'skin' && customDesign.canvasDataUrl) {
      createTextureFromDataUrl(customDesign.canvasDataUrl, maxAniso, (tex) => {
        if (this.dynamicSkinTexture) {
          this.dynamicSkinTexture.dispose();
        }
        this.dynamicSkinTexture = tex;
        this.torsoMat.map = tex;
        this.torsoMat.color.setHex(0xffffff);
        this.torsoMat.needsUpdate = true;
        this.limbMat.color.set(customDesign.accentColor || '#1e293b');
        this.headMat.color.set('#fde68a');
      });
    } else {
      if (this.dynamicSkinTexture) {
        this.dynamicSkinTexture.dispose();
        this.dynamicSkinTexture = null;
      }
      const preset = PRESET_SKINS.find((s) => s.id === skinId) || PRESET_SKINS[0];
      this.torsoMat.map = null;
      this.torsoMat.color.set(preset.torsoHex);
      this.torsoMat.needsUpdate = true;
      this.limbMat.color.set(preset.limbHex);
      this.headMat.color.set(preset.headHex);
    }
  }

  public triggerJumpSquash(): void {
    this.squashY = 1.18;
    this.squashXZ = 0.86;
  }

  public triggerLandSquash(): void {
    this.squashY = 0.78;
    this.squashXZ = 1.2;
  }

  public setHitFlash(flashing: boolean): void {
    this.torsoMat.emissive.setHex(flashing ? 0xffffff : 0x000000);
    this.torsoMat.emissiveIntensity = flashing ? 0.85 : 0;
  }

  public updateAnimation(
    horizontalSpeed: number,
    isGrounded: boolean,
    dt: number,
    recoilKick: number,
    aimPitch: number
  ): void {
    // Distance-synced walk cycle
    if (isGrounded && horizontalSpeed > 0.25) {
      this.gaitPhase += horizontalSpeed * dt * 1.45;
    } else {
      this.gaitPhase = THREE.MathUtils.damp(this.gaitPhase, Math.round(this.gaitPhase / Math.PI) * Math.PI, 8, dt);
    }

    const swing = isGrounded ? Math.sin(this.gaitPhase) * Math.min(1, horizontalSpeed / 7) * 0.65 : 0.32;
    this.leftLegPivot.rotation.x = swing;
    this.rightLegPivot.rotation.x = -swing;
    this.leftArmPivot.rotation.x = -swing * 0.7;

    // Right arm holds weapon aimed forward + recoil kick
    this.rightArmPivot.rotation.x = -Math.PI / 2 + aimPitch * 0.75 - recoilKick * 0.35;

    // Exponentially damped squash & stretch
    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 12, dt);
    this.squashXZ = THREE.MathUtils.damp(this.squashXZ, 1, 12, dt);
    this.bodyGroup.scale.set(this.squashXZ, this.squashY, this.squashXZ);
  }

  public dispose(): void {
    if (this.dynamicSkinTexture) {
      this.dynamicSkinTexture.dispose();
      this.dynamicSkinTexture = null;
    }
    this.torsoMat.dispose();
    this.limbMat.dispose();
    this.headMat.dispose();
    this.accentMat.dispose();
    this.visorMat.dispose();
    this.shadowMat.dispose();
    this.shadowTex.dispose();
    this.geometries.forEach((g) => g.dispose());
  }
}

export type EnemyPolicy = 'sentinel' | 'patrol' | 'charger';

export interface EnemyBolt {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  mesh: THREE.Mesh;
}

export interface EnemyUnit {
  id: number;
  policy: EnemyPolicy;
  labelAr: string;
  rig: BlockyCharacterRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spawnPos: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  koTimer: number;
  respawnTimer: number;
  hitFlashTimer: number;
  windupTimer: number;
  cooldownTimer: number;
  patrolPhase: number;
}

export class EnemyDefenderManager {
  public readonly group = new THREE.Group();
  public readonly enemies: EnemyUnit[] = [];
  public readonly bolts: EnemyBolt[] = [];

  private readonly boltGeo: THREE.SphereGeometry;
  private readonly boltMat: THREE.MeshBasicMaterial;

  constructor(enableShadows: boolean) {
    const configs: Array<{ policy: EnemyPolicy; labelAr: string; spawn: [number, number, number]; role: RoleId; maxHp: number }> = [
      { policy: 'sentinel', labelAr: 'حارس البوابة', spawn: [0, 0, 14.5], role: 'general', maxHp: 110 },
      { policy: 'patrol', labelAr: 'دورية القلعة', spawn: [-7.5, 0, 10.5], role: 'soldier', maxHp: 85 },
      { policy: 'charger', labelAr: 'مقتحم أحمر', spawn: [7.5, 0, 11.5], role: 'commander', maxHp: 95 },
    ];

    configs.forEach((cfg, idx) => {
      const rig = new BlockyCharacterRig(enableShadows, true);
      rig.applyRoleVisuals(cfg.role);
      rig.applySkin('crimson_titan', null, 1);
      rig.root.position.set(cfg.spawn[0], cfg.spawn[1], cfg.spawn[2]);
      this.group.add(rig.root);

      this.enemies.push({
        id: idx + 1,
        policy: cfg.policy,
        labelAr: cfg.labelAr,
        rig,
        pos: new THREE.Vector3(...cfg.spawn),
        vel: new THREE.Vector3(),
        spawnPos: new THREE.Vector3(...cfg.spawn),
        yaw: Math.PI,
        hp: cfg.maxHp,
        maxHp: cfg.maxHp,
        alive: true,
        koTimer: 0,
        respawnTimer: 0,
        hitFlashTimer: 0,
        windupTimer: 0,
        cooldownTimer: 1.5 + idx * 0.6,
        patrolPhase: idx * 2.1,
      });
    });

    this.boltGeo = new THREE.SphereGeometry(0.22, 8, 8);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.bolts.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        mesh,
      });
    }
  }

  public resetAll(): void {
    for (const e of this.enemies) {
      e.pos.copy(e.spawnPos);
      e.vel.set(0, 0, 0);
      e.hp = e.maxHp;
      e.alive = true;
      e.koTimer = 0;
      e.respawnTimer = 0;
      e.hitFlashTimer = 0;
      e.windupTimer = 0;
      e.cooldownTimer = 1.6;
      e.rig.root.position.copy(e.pos);
      e.rig.root.rotation.set(0, Math.PI, 0);
      e.rig.root.visible = true;
      e.rig.setHitFlash(false);
    }
    for (const b of this.bolts) {
      b.active = false;
      b.mesh.visible = false;
    }
  }

  public damageEnemy(enemy: EnemyUnit, amount: number, impulseDir?: THREE.Vector3): boolean {
    if (!enemy.alive) return false;
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlashTimer = 0.06;
    enemy.rig.setHitFlash(true);

    if (impulseDir) {
      enemy.vel.x += impulseDir.x * 6;
      enemy.vel.z += impulseDir.z * 6;
    }

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.koTimer = 0.35;
      enemy.respawnTimer = 5.0;
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    grid: VoxelGridData,
    onHitPlayer: (damage: number) => void
  ): void {
    // Update active enemy bolts
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);

      if (grid.isPointSolid(b.pos.x, b.pos.y, b.pos.z)) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }

      const dx = b.pos.x - playerPos.x;
      const dy = b.pos.y - (playerPos.y + 1.0);
      const dz = b.pos.z - playerPos.z;
      if (dx * dx + dy * dy + dz * dz < 0.72 * 0.72) {
        b.active = false;
        b.mesh.visible = false;
        onHitPlayer(10);
      }
    }

    // Update each enemy unit
    for (const e of this.enemies) {
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        if (e.hitFlashTimer <= 0) {
          e.rig.setHitFlash(false);
        }
      }

      if (!e.alive) {
        if (e.koTimer > 0) {
          e.koTimer -= dt;
          const progress = 1 - Math.max(0, e.koTimer) / 0.35;
          e.rig.root.rotation.x = progress * (Math.PI / 2);
        } else {
          e.rig.root.visible = false;
        }
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          e.pos.copy(e.spawnPos);
          e.vel.set(0, 0, 0);
          e.hp = e.maxHp;
          e.alive = true;
          e.rig.root.rotation.set(0, Math.PI, 0);
          e.rig.root.visible = true;
        }
        continue;
      }

      const toPlayerX = playerPos.x - e.pos.x;
      const toPlayerZ = playerPos.z - e.pos.z;
      const distSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
      const dist = Math.sqrt(distSq) || 0.001;
      e.yaw = Math.atan2(toPlayerX, toPlayerZ);

      let moveX = 0;
      let moveZ = 0;
      e.patrolPhase += dt;

      if (e.policy === 'sentinel') {
        // Guards Red Castle front: strafes laterally
        moveX = Math.cos(e.patrolPhase * 1.4) * 2.2;
      } else if (e.policy === 'patrol') {
        // Kiter/Patrol: keeps 10-15m range, backs off if player is too close
        if (dist < 8.5) {
          moveX = -(toPlayerX / dist) * 3.6;
          moveZ = -(toPlayerZ / dist) * 3.6;
        } else if (dist > 16) {
          moveX = (toPlayerX / dist) * 3.2;
          moveZ = (toPlayerZ / dist) * 3.2;
        } else {
          moveX = (-toPlayerZ / dist) * 2.8 * Math.sin(e.patrolPhase * 0.9);
          moveZ = (toPlayerX / dist) * 2.8 * Math.sin(e.patrolPhase * 0.9);
        }
      } else {
        // Charger: pushes forward aggressively when in line of sight
        if (dist > 4.5 && dist < 24) {
          moveX = (toPlayerX / dist) * 4.2;
          moveZ = (toPlayerZ / dist) * 4.2;
        }
      }

      e.vel.x = THREE.MathUtils.damp(e.vel.x, moveX, 6, dt);
      e.vel.z = THREE.MathUtils.damp(e.vel.z, moveZ, 6, dt);

      const nextX = THREE.MathUtils.clamp(e.pos.x + e.vel.x * dt, -ARENA_HALF_EXTENT + 1, ARENA_HALF_EXTENT - 1);
      if (!grid.intersectsBox(nextX, e.pos.y, e.pos.z, 0.48, 1.8)) {
        e.pos.x = nextX;
      }
      const nextZ = THREE.MathUtils.clamp(e.pos.z + e.vel.z * dt, -ARENA_HALF_EXTENT + 1, ARENA_HALF_EXTENT - 1);
      if (!grid.intersectsBox(e.pos.x, e.pos.y, nextZ, 0.48, 1.8)) {
        e.pos.z = nextZ;
      }

      // Telegraphed attack windup
      if (e.windupTimer > 0) {
        e.windupTimer -= dt;
        e.rig.setHitFlash(Math.floor(e.windupTimer * 18) % 2 === 0);
        if (e.windupTimer <= 0) {
          e.rig.setHitFlash(false);
          this.fireBolt(e.pos, playerPos);
          e.cooldownTimer = e.policy === 'sentinel' ? 2.4 : 2.9;
        }
      } else {
        e.cooldownTimer -= dt;
        if (e.cooldownTimer <= 0 && dist < 24) {
          e.windupTimer = 0.45; // visible windup telegraph before shot
        }
      }

      e.rig.root.position.copy(e.pos);
      e.rig.root.rotation.y = e.yaw;
      const horizSpeed = Math.hypot(e.vel.x, e.vel.z);
      e.rig.updateAnimation(horizSpeed, true, dt, 0, 0);
    }
  }

  private fireBolt(origin: THREE.Vector3, target: THREE.Vector3): void {
    const bolt = this.bolts.find((b) => !b.active);
    if (!bolt) return;
    bolt.active = true;
    bolt.life = 2.6;
    bolt.pos.set(origin.x, origin.y + 1.3, origin.z);
    bolt.vel.set(target.x - origin.x, (target.y + 1.0) - (origin.y + 1.3), target.z - origin.z).normalize().multiplyScalar(17);
    bolt.mesh.position.copy(bolt.pos);
    bolt.mesh.visible = true;
  }

  public dispose(): void {
    for (const e of this.enemies) {
      e.rig.dispose();
    }
    this.boltGeo.dispose();
    this.boltMat.dispose();
  }
}
