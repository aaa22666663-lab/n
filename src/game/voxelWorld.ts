import * as THREE from 'three';
import { ARENA_GRID_X, ARENA_GRID_Y, ARENA_GRID_Z, VOXEL_SIZE } from './config';
import {
  DestroyedVoxelInfo,
  VOXEL_COLOR_MAP,
  VoxelGridData,
  VoxelKind,
  gridToWorldCenter,
} from './voxelGridLogic';

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

interface DebrisPiece {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

interface ExplosionRing {
  active: boolean;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

/**
 * Generates a crisp procedural Roblox-stud + stone micro-detail texture on Canvas.
 */
function createVoxelStudTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 128, 128);

  // Subtle border bevel
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);

  // 2x2 subtle Roblox-style circular studs
  const centers = [36, 92];
  for (const cx of centers) {
    for (const cy of centers) {
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tileable arena ground grid texture.
 */
function createGroundGridTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle concrete noise speckles
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 4, 4);
  }

  // Tile grid lines aligned to VOXEL_SIZE
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 253);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ARENA_GRID_X / 2, ARENA_GRID_Z / 2);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export class VoxelArenaRenderer {
  public readonly group = new THREE.Group();
  public readonly grid = new VoxelGridData();

  private readonly voxelGeometry: THREE.BoxGeometry;
  private readonly voxelMaterial: THREE.MeshStandardMaterial;
  private readonly voxelTexture: THREE.CanvasTexture;
  private readonly voxelInstanced: THREE.InstancedMesh;

  private readonly debrisGeometry: THREE.BoxGeometry;
  private readonly debrisMaterial: THREE.MeshStandardMaterial;
  private readonly debrisInstanced: THREE.InstancedMesh;
  private readonly debrisPool: DebrisPiece[] = [];
  private debrisCursor = 0;

  private readonly explosionPool: ExplosionRing[] = [];
  private readonly explosionGeometry: THREE.SphereGeometry;
  private readonly explosionFlashLight: THREE.PointLight;
  private flashTimer = 0;

  private readonly environmentGroup = new THREE.Group();
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];

  constructor(maxAniso: number, enableShadows: boolean) {
    const maxVoxels = ARENA_GRID_X * ARENA_GRID_Y * ARENA_GRID_Z;

    // 1. Voxel Blocks InstancedMesh
    this.voxelTexture = createVoxelStudTexture(maxAniso);
    this.voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE * 0.985, VOXEL_SIZE * 0.985, VOXEL_SIZE * 0.985);
    this.voxelMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.voxelTexture,
      roughness: 0.6,
      metalness: 0.08,
    });
    this.voxelInstanced = new THREE.InstancedMesh(this.voxelGeometry, this.voxelMaterial, maxVoxels);
    this.voxelInstanced.castShadow = enableShadows;
    this.voxelInstanced.receiveShadow = enableShadows;
    this.voxelInstanced.frustumCulled = false;
    this.group.add(this.voxelInstanced);

    // 2. Pooled Debris InstancedMesh (140 falling rubble cubes)
    const maxDebris = 140;
    this.debrisGeometry = new THREE.BoxGeometry(VOXEL_SIZE * 0.36, VOXEL_SIZE * 0.36, VOXEL_SIZE * 0.36);
    this.debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.1,
    });
    this.debrisInstanced = new THREE.InstancedMesh(this.debrisGeometry, this.debrisMaterial, maxDebris);
    this.debrisInstanced.count = 0;
    this.debrisInstanced.frustumCulled = false;
    this.group.add(this.debrisInstanced);

    for (let i = 0; i < maxDebris; i++) {
      this.debrisPool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        scale: 1,
        life: 0,
        maxLife: 1.4,
        colorHex: 0xffffff,
      });
    }

    // 3. Pooled Explosion Shockwave Rings + Flash Light
    this.explosionGeometry = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0,
        wireframe: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.explosionGeometry, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.disposableMaterials.push(mat);
      this.explosionPool.push({
        active: false,
        mesh,
        life: 0,
        maxLife: 0.42,
        maxRadius: 3.5,
      });
    }

    this.explosionFlashLight = new THREE.PointLight(0xfb923c, 0, 24, 2);
    this.group.add(this.explosionFlashLight);

    // 4. Ground & Natural Surrounding Blocky Canyon Terrain (never floating in void!)
    this.buildArenaTerrain(maxAniso, enableShadows);

    // Initial sync of castle voxels
    this.syncVoxelInstances();
  }

  private buildArenaTerrain(maxAniso: number, enableShadows: boolean): void {
    const arenaSpan = ARENA_GRID_X * VOXEL_SIZE;

    // Main playable arena floor
    const gridTex = createGroundGridTexture(maxAniso);
    this.disposableTextures.push(gridTex);

    const floorGeo = new THREE.BoxGeometry(arenaSpan, 1, arenaSpan);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: gridTex,
      roughness: 0.78,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.5, 0);
    floorMesh.receiveShadow = enableShadows;
    this.environmentGroup.add(floorMesh);
    this.disposableGeometries.push(floorGeo);
    this.disposableMaterials.push(floorMat);

    // Blue & Red Base Zone Floor Strips (offset +0.02 on Y to prevent Z-fighting)
    const zoneGeo = new THREE.BoxGeometry(arenaSpan * 0.62, 0.04, 8 * VOXEL_SIZE);
    const blueZoneMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.7 });
    const blueZone = new THREE.Mesh(zoneGeo, blueZoneMat);
    blueZone.position.set(0, 0.02, -(ARENA_GRID_Z / 2 - 4) * VOXEL_SIZE);
    blueZone.receiveShadow = enableShadows;
    this.environmentGroup.add(blueZone);

    const redZoneMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });
    const redZone = new THREE.Mesh(zoneGeo, redZoneMat);
    redZone.position.set(0, 0.02, (ARENA_GRID_Z / 2 - 4) * VOXEL_SIZE);
    redZone.receiveShadow = enableShadows;
    this.environmentGroup.add(redZone);

    this.disposableGeometries.push(zoneGeo);
    this.disposableMaterials.push(blueZoneMat, redZoneMat);

    // Extended surrounding grass/earth plateau (220x220) so world extends cleanly to fog
    const outerGeo = new THREE.PlaneGeometry(240, 240);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.92,
      metalness: 0.0,
    });
    const outerGround = new THREE.Mesh(outerGeo, outerMat);
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.15;
    outerGround.receiveShadow = enableShadows;
    this.environmentGroup.add(outerGround);
    this.disposableGeometries.push(outerGeo);
    this.disposableMaterials.push(outerMat);

    // Low perimeter curb & natural blocky rock outcrops / trees around the arena edge
    const rockGeo = new THREE.BoxGeometry(1, 1, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.05 });
    const treeTrunkGeo = new THREE.BoxGeometry(0.9, 2.8, 0.9);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
    const treeLeafGeo = new THREE.BoxGeometry(2.8, 2.5, 2.8);
    const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    this.disposableGeometries.push(rockGeo, treeTrunkGeo, treeLeafGeo);
    this.disposableMaterials.push(rockMat, treeTrunkMat, treeLeafMat);

    const borderDist = arenaSpan / 2 + 2.5;
    // Instanced outer perimeter cliffs & mesas
    const rockPositions: Array<[number, number, number, number, number, number]> = [];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const dist = borderDist + 8 + ((i * 7) % 18);
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;
      const w = 4 + (i % 4) * 2.2;
      const h = 3 + (i % 5) * 2.4;
      const d = 4 + ((i + 2) % 4) * 2;
      rockPositions.push([rx, h / 2 - 0.15, rz, w, h, d]);
    }

    const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
    rockPositions.forEach((p, idx) => {
      _pos.set(p[0], p[1], p[2]);
      _scale.set(p[3], p[4], p[5]);
      _quat.identity();
      _mat4.compose(_pos, _quat, _scale);
      rockInstanced.setMatrixAt(idx, _mat4);
      _color.setHex(idx % 2 === 0 ? 0x475569 : 0x64748b);
      rockInstanced.setColorAt(idx, _color);
    });
    rockInstanced.instanceMatrix.needsUpdate = true;
    if (rockInstanced.instanceColor) rockInstanced.instanceColor.needsUpdate = true;
    rockInstanced.computeBoundingSphere();
    this.environmentGroup.add(rockInstanced);

    // Blocky perimeter trees (3-part composite: trunk + lower canopy + top crown)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.2;
      const dist = borderDist + 3.5 + (i % 3) * 3;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, -0.15, tz);

      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 1.4;
      trunk.castShadow = enableShadows;
      treeGroup.add(trunk);

      const crown1 = new THREE.Mesh(treeLeafGeo, treeLeafMat);
      crown1.position.y = 3.5;
      crown1.castShadow = enableShadows;
      treeGroup.add(crown1);

      const crown2 = new THREE.Mesh(treeLeafGeo, treeLeafMat);
      crown2.scale.set(0.68, 0.72, 0.68);
      crown2.position.y = 5.1;
      treeGroup.add(crown2);

      this.environmentGroup.add(treeGroup);
    }

    this.group.add(this.environmentGroup);
  }

  public syncVoxelInstances(): void {
    let instanceIdx = 0;
    const cells = this.grid.cells;
    for (let gy = 0; gy < ARENA_GRID_Y; gy++) {
      for (let gz = 0; gz < ARENA_GRID_Z; gz++) {
        for (let gx = 0; gx < ARENA_GRID_X; gx++) {
          const arrIdx = (gy * ARENA_GRID_Z + gz) * ARENA_GRID_X + gx;
          const kind = cells[arrIdx] as VoxelKind;
          if (kind === 0) continue;

          const worldPos = gridToWorldCenter(gx, gy, gz);
          _pos.set(worldPos.x, worldPos.y, worldPos.z);
          _quat.identity();
          _scale.set(1, 1, 1);
          _mat4.compose(_pos, _quat, _scale);
          this.voxelInstanced.setMatrixAt(instanceIdx, _mat4);

          _color.setHex(VOXEL_COLOR_MAP[kind]);
          this.voxelInstanced.setColorAt(instanceIdx, _color);
          instanceIdx++;
        }
      }
    }

    this.voxelInstanced.count = instanceIdx;
    this.voxelInstanced.instanceMatrix.needsUpdate = true;
    if (this.voxelInstanced.instanceColor) {
      this.voxelInstanced.instanceColor.needsUpdate = true;
    }
    this.voxelInstanced.computeBoundingSphere();
  }

  /**
   * Triggers a blast at world (wx, wy, wz), removes destroyed voxels,
   * spawns falling debris cubes, and activates shockwave ring + flash.
   */
  public triggerExplosion(wx: number, wy: number, wz: number, radius: number): DestroyedVoxelInfo[] {
    const destroyed = this.grid.applyExplosion(wx, wy, wz, radius);
    if (destroyed.length > 0) {
      this.syncVoxelInstances();
    }

    // Spawn falling debris (up to 3 debris cubes per destroyed voxel, capped smoothly by ring buffer)
    const debrisPerBlock = destroyed.length > 10 ? 2 : 3;
    for (const block of destroyed) {
      for (let k = 0; k < debrisPerBlock; k++) {
        this.spawnDebrisPiece(block.wx, block.wy, block.wz, block.colorHex, wx, wy, wz);
      }
    }

    // Always spawn at least 8 spark debris if explosion hit ground/air without voxels
    if (destroyed.length === 0) {
      for (let k = 0; k < 10; k++) {
        this.spawnDebrisPiece(wx, Math.max(0.4, wy), wz, k % 2 === 0 ? 0xf97316 : 0xfacc15, wx, wy - 0.5, wz);
      }
    }

    // Trigger shockwave sphere
    const ring = this.explosionPool.find((r) => !r.active) || this.explosionPool[0];
    ring.active = true;
    ring.life = 0;
    ring.maxLife = 0.38;
    ring.maxRadius = radius * 1.15;
    ring.mesh.position.set(wx, Math.max(0.2, wy), wz);
    ring.mesh.scale.setScalar(0.35);
    ring.mesh.visible = true;
    (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;

    // Flash light
    this.explosionFlashLight.position.set(wx, Math.max(0.8, wy + 0.5), wz);
    this.explosionFlashLight.intensity = 14;
    this.flashTimer = 0.16;

    return destroyed;
  }

  private spawnDebrisPiece(
    bx: number,
    by: number,
    bz: number,
    colorHex: number,
    originX: number,
    originY: number,
    originZ: number
  ): void {
    const piece = this.debrisPool[this.debrisCursor];
    this.debrisCursor = (this.debrisCursor + 1) % this.debrisPool.length;

    piece.active = true;
    piece.life = 0;
    piece.maxLife = 0.85 + Math.random() * 0.7;
    piece.scale = 0.65 + Math.random() * 0.65;
    piece.colorHex = colorHex;
    piece.pos.set(
      bx + (Math.random() - 0.5) * 0.6,
      by + (Math.random() - 0.5) * 0.4,
      bz + (Math.random() - 0.5) * 0.6
    );

    const dx = piece.pos.x - originX + (Math.random() - 0.5) * 1.2;
    const dy = piece.pos.y - originY + 1.4;
    const dz = piece.pos.z - originZ + (Math.random() - 0.5) * 1.2;
    const len = Math.hypot(dx, dy, dz) || 1;
    const speed = 6 + Math.random() * 9;

    piece.vel.set((dx / len) * speed, Math.max(3.5, (dy / len) * speed + 3), (dz / len) * speed);
    piece.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    piece.rotVel.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  }

  public updateEffects(dt: number): void {
    // Update falling debris with gravity, bounce, and automatic cleanup
    let activeDebrisCount = 0;
    for (let i = 0; i < this.debrisPool.length; i++) {
      const d = this.debrisPool[i];
      if (!d.active) continue;

      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        continue;
      }

      d.vel.y -= 24 * dt;
      d.pos.addScaledVector(d.vel, dt);

      if (d.pos.y < 0.2) {
        d.pos.y = 0.2;
        d.vel.y = Math.abs(d.vel.y) * 0.35;
        d.vel.x *= 0.75;
        d.vel.z *= 0.75;
      }

      d.rot.x += d.rotVel.x * dt;
      d.rot.y += d.rotVel.y * dt;
      d.rot.z += d.rotVel.z * dt;

      const fade = 1 - Math.pow(d.life / d.maxLife, 2);
      const s = Math.max(0.01, d.scale * fade);

      _quat.setFromEuler(d.rot);
      _scale.set(s, s, s);
      _mat4.compose(d.pos, _quat, _scale);
      this.debrisInstanced.setMatrixAt(activeDebrisCount, _mat4);
      _color.setHex(d.colorHex);
      this.debrisInstanced.setColorAt(activeDebrisCount, _color);
      activeDebrisCount++;
    }

    this.debrisInstanced.count = activeDebrisCount;
    if (activeDebrisCount > 0) {
      this.debrisInstanced.instanceMatrix.needsUpdate = true;
      if (this.debrisInstanced.instanceColor) {
        this.debrisInstanced.instanceColor.needsUpdate = true;
      }
    }

    // Update shockwave rings
    for (const ring of this.explosionPool) {
      if (!ring.active) continue;
      ring.life += dt;
      const t = ring.life / ring.maxLife;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const rad = THREE.MathUtils.lerp(0.4, ring.maxRadius, 1 - Math.pow(1 - t, 2));
      ring.mesh.scale.setScalar(rad);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72;
    }

    // Update explosion flash light
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.explosionFlashLight.intensity = Math.max(0, (this.flashTimer / 0.16) * 14);
    } else {
      this.explosionFlashLight.intensity = 0;
    }
  }

  public resetArena(): void {
    this.grid.resetArena();
    this.syncVoxelInstances();
    for (const d of this.debrisPool) d.active = false;
    this.debrisInstanced.count = 0;
    for (const r of this.explosionPool) {
      r.active = false;
      r.mesh.visible = false;
    }
    this.explosionFlashLight.intensity = 0;
  }

  public dispose(): void {
    this.voxelGeometry.dispose();
    this.voxelMaterial.dispose();
    this.voxelTexture.dispose();
    this.debrisGeometry.dispose();
    this.debrisMaterial.dispose();
    this.explosionGeometry.dispose();
    this.disposableGeometries.forEach((g) => g.dispose());
    this.disposableMaterials.forEach((m) => m.dispose());
    this.disposableTextures.forEach((t) => t.dispose());
  }
}
