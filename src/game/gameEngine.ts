import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  CustomDesign,
  GamePhase,
  ROLES,
  RoleDefinition,
  WeaponConfig,
  computeWeaponStats,
} from './config';
import { ARENA_HALF_EXTENT, DestroyedVoxelInfo } from './voxelGridLogic';
import { VoxelArenaRenderer } from './voxelWorld';
import { BlockyCharacterRig, EnemyDefenderManager } from './characterRig';
import { ModularWeaponRig } from './weaponSystem';
import { soundManager } from './audio';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

interface Projectile {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  explosive: boolean;
  blastRadius: number;
  damage: number;
  mesh: THREE.Mesh;
}

export interface EngineSnapshot {
  hp: number;
  maxHp: number;
  score: number;
  remainingBlocks: number;
  initialBlocks: number;
  enemiesDefeated: number;
  cameraMode: CameraMode;
  pointerLocked: boolean;
  isAiming: boolean;
}

export interface EngineCallbacks {
  onSnapshot: (snap: EngineSnapshot) => void;
  onBlocksDestroyed: (blocks: DestroyedVoxelInfo[], wasExplosion: boolean) => void;
  onEnemyHit: (defeated: boolean) => void;
  onPlayerDefeated: () => void;
  onPhaseHotkeyPause: () => void;
  onToggleCameraHotkey: () => void;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly maxAniso: number;

  private readonly arena: VoxelArenaRenderer;
  private readonly playerRig: BlockyCharacterRig;
  private readonly tpsWeaponRig: ModularWeaponRig;
  private readonly fpsWeaponRig: ModularWeaponRig;
  private readonly enemyManager: EnemyDefenderManager;

  private readonly projectiles: Projectile[] = [];
  private readonly projGeo: THREE.SphereGeometry;
  private readonly projStandardMat: THREE.MeshBasicMaterial;
  private readonly projExplosiveMat: THREE.MeshBasicMaterial;

  private phase: GamePhase = 'title';
  private cameraMode: CameraMode = 'tps';
  private role: RoleDefinition = ROLES.commander;
  private weaponConfig: WeaponConfig;

  // Player physics state
  private readonly playerPos = new THREE.Vector3(0, 0, -9.75);
  private readonly playerVel = new THREE.Vector3();
  private playerYaw = 0; // 0 = looking toward +Z (Red Castle)
  private playerPitch = 0.06;
  private isGrounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private hp = 140;
  private maxHp = 140;
  private score = 0;
  private enemiesDefeated = 0;
  private initialBlocks = 0;

  // Weapon / Juice state
  private fireCooldown = 0;
  private recoilKick = 0;
  private trauma = 0;
  private hitstopTimer = 0;
  private walkBobPhase = 0;
  private titleTourTime = 0;

  // Camera smoothing state
  private readonly smoothedCamPos = new THREE.Vector3(0, 5, -16);
  private readonly smoothedLookAt = new THREE.Vector3(0, 1.5, 4);

  // Input state
  private readonly keysHeld = new Set<string>();
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private frameId = 0;
  private lastTimeMs = performance.now();
  private snapshotAccum = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialWeapon: WeaponConfig,
    initialRole: RoleDefinition,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.weaponConfig = initialWeapon;
    this.role = initialRole;
    this.maxHp = initialRole.maxHp;
    this.hp = initialRole.maxHp;

    // Detect software WebGL (SwiftShader/llvmpipe) to pace loop safely without altering scene content
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // Scene + Sky/Horizon Fog
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x7dd3fc);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(0xbae6fd, 38, 125);

    // Mandatory studio environment reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Camera (must be in scene so FPS viewmodel child renders)
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 220);
    this.scene.add(this.camera);

    // Warm/Cool Studio Lighting Rig (1 shadow-casting key light + hemisphere + rim)
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.85);
    this.scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    sunLight.position.set(22, 34, -18);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 95;
      const d = 28;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rimLight.position.set(-20, 14, 24);
    this.scene.add(rimLight);

    // Arena & Castles
    this.arena = new VoxelArenaRenderer(this.maxAniso, !this.isSoftwareGl);
    this.initialBlocks = this.arena.grid.activeCount;
    this.scene.add(this.arena.group);

    // Player Blocky Character + TPS/FPS Weapon Rigs
    this.playerRig = new BlockyCharacterRig(!this.isSoftwareGl, false);
    this.playerRig.applyRoleVisuals(initialRole.id);
    this.playerRig.root.position.copy(this.playerPos);
    this.scene.add(this.playerRig.root);

    this.tpsWeaponRig = new ModularWeaponRig();
    this.playerRig.weaponMount.add(this.tpsWeaponRig.group);

    this.fpsWeaponRig = new ModularWeaponRig();
    this.fpsWeaponRig.group.position.set(0.28, -0.24, -0.74);
    this.fpsWeaponRig.group.scale.setScalar(0.86);
    this.fpsWeaponRig.group.rotation.y = Math.PI; // point +Z weapon barrel down -Z camera look
    this.fpsWeaponRig.group.visible = false;
    this.camera.add(this.fpsWeaponRig.group);

    // Enemy Defenders
    this.enemyManager = new EnemyDefenderManager(!this.isSoftwareGl);
    this.scene.add(this.enemyManager.group);

    // Projectile Pool
    this.projGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.projStandardMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.projExplosiveMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.projGeo, this.projExplosiveMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        explosive: false,
        blastRadius: 2,
        damage: 30,
        mesh,
      });
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.applyCameraVisibility();
    this.emitSnapshot();
    this.startLoop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('contextmenu', this.handleContextMenu);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleWindowBlur = (): void => {
    this.keysHeld.clear();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.isDraggingLook = false;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.handleWindowBlur();
    }
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitSnapshot();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.button === 0) {
      this.mouseDownLeft = true;
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      // Fire immediately on click
      this.tryFireWeapon(false);
    } else if (e.button === 2) {
      this.mouseDownRight = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      this.isDraggingLook = false;
    } else if (e.button === 2) {
      this.mouseDownRight = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * 0.0024;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - e.movementY * 0.002, -0.75, 0.85);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * 0.005;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.004, -0.75, 0.85);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore typing in input/text fields
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    this.keysHeld.add(e.code);

    if (this.phase !== 'playing') return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.jumpBufferTimer = 0.12;
    } else if (e.code === 'KeyV') {
      e.preventDefault();
      this.callbacks.onToggleCameraHotkey();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      this.tryFireWeapon(false);
    } else if (e.code === 'KeyG') {
      e.preventDefault();
      this.tryFireWeapon(true);
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      this.callbacks.onPhaseHotkeyPause();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
    // Variable jump cut when releasing Space early while ascending
    if (e.code === 'Space' && this.playerVel.y > 2) {
      this.playerVel.y *= 0.5;
    }
  };

  public setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    document.body.dataset.state = nextPhase;
    if (nextPhase !== 'playing') {
      this.keysHeld.clear();
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
      this.isDraggingLook = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } else {
      // Snap camera cleanly on entering playing so no lingering title angle remains
      this.snapGameplayCamera();
    }
    this.emitSnapshot();
  }

  public requestPointerLock(): void {
    if (this.phase === 'playing') {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.applyCameraVisibility();
    this.snapGameplayCamera();
    this.emitSnapshot();
  }

  private applyCameraVisibility(): void {
    const isFps = this.cameraMode === 'fps';
    this.playerRig.setBodyVisible(!isFps);
    this.tpsWeaponRig.group.visible = !isFps;
    this.fpsWeaponRig.group.visible = isFps;
  }

  public applyRole(role: RoleDefinition): void {
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.role = role;
    this.maxHp = role.maxHp;
    this.hp = Math.max(1, Math.round(role.maxHp * ratio));
    this.playerRig.applyRoleVisuals(role.id);
    this.emitSnapshot();
  }

  public applyCustomization(
    weapon: WeaponConfig,
    customWeaponDesign: CustomDesign | null,
    skinId: string,
    customSkinDesign: CustomDesign | null
  ): void {
    this.weaponConfig = weapon;
    this.tpsWeaponRig.applyConfig(weapon, customWeaponDesign, this.maxAniso);
    this.fpsWeaponRig.applyConfig(weapon, customWeaponDesign, this.maxAniso);
    this.playerRig.applySkin(skinId, customSkinDesign, this.maxAniso);
  }

  public resetRound(newRole?: RoleDefinition): void {
    if (newRole) {
      this.role = newRole;
      this.maxHp = newRole.maxHp;
    }
    this.hp = this.maxHp;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.playerPos.set(0, 0, -9.75);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.playerPitch = 0.05;
    this.isGrounded = true;
    this.playerRig.applyRoleVisuals(this.role.id);
    this.arena.resetArena();
    this.enemyManager.resetAll();
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.snapGameplayCamera();
    this.emitSnapshot();
  }

  public resetArenaOnly(): void {
    this.arena.resetArena();
    this.enemyManager.resetAll();
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.emitSnapshot();
  }

  /**
   * Fires a tactical test explosion at the aimed castle/cover block (or 11m ahead)
   * so the user can test voxel destruction, debris, and CP rewards with one click.
   */
  public triggerTestExplosion(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let hitPos = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);

    // Step along aim ray up to 24m to find first solid voxel; fallback to central cover/castle
    let foundHit = false;
    for (let d = 2; d <= 26; d += 0.6) {
      const sx = hitPos.x + dir.x * d;
      const sy = hitPos.y + dir.y * d;
      const sz = hitPos.z + dir.z * d;
      if (this.arena.grid.isPointSolid(sx, sy, sz)) {
        hitPos.set(sx, Math.max(0.6, sy), sz);
        foundHit = true;
        break;
      }
    }
    if (!foundHit) {
      hitPos.set(0, 1.5, 0.5); // central destructible cover cluster
      if (!this.arena.grid.isPointSolid(hitPos.x, hitPos.y, hitPos.z)) {
        hitPos.set(-3, 2.0, 14.5); // Red castle front wall fallback
      }
    }

    this.detonateAt(hitPos.x, hitPos.y, hitPos.z, 3.6, 55);
  }

  private tryFireWeapon(forceExplosive: boolean): void {
    if (this.fireCooldown > 0 || this.phase !== 'playing') return;
    const stats = computeWeaponStats(this.weaponConfig, this.role);
    this.fireCooldown = forceExplosive ? 0.42 : stats.cooldownSec;
    this.recoilKick = Math.min(1.0, this.recoilKick + 0.55 * stats.recoilAmount);

    const explosive = forceExplosive || stats.isExplosivePrimary;
    soundManager.playShoot(this.weaponConfig.barrel === 'suppressor', explosive);

    const proj = this.projectiles.find((p) => !p.active);
    if (!proj) return;

    const muzzlePos = new THREE.Vector3();
    if (this.cameraMode === 'fps') {
      this.fpsWeaponRig.muzzleAnchor.getWorldPosition(muzzlePos);
    } else {
      this.tpsWeaponRig.muzzleAnchor.getWorldPosition(muzzlePos);
    }

    const aimDir = new THREE.Vector3();
    this.camera.getWorldDirection(aimDir);

    // Project camera ray to find true convergence point so TPS crosshair matches shot trajectory
    let targetPoint = new THREE.Vector3().copy(this.camera.position).addScaledVector(aimDir, 45);
    for (let d = 2.5; d <= 45; d += 0.8) {
      const tx = this.camera.position.x + aimDir.x * d;
      const ty = this.camera.position.y + aimDir.y * d;
      const tz = this.camera.position.z + aimDir.z * d;
      if (this.arena.grid.isPointSolid(tx, ty, tz)) {
        targetPoint.set(tx, ty, tz);
        break;
      }
    }

    const projDir = targetPoint.sub(muzzlePos).normalize();

    proj.active = true;
    proj.life = 2.4;
    proj.pos.copy(muzzlePos);
    proj.vel.copy(projDir).multiplyScalar(forceExplosive ? 32 : stats.projectileSpeed);
    proj.explosive = explosive;
    proj.blastRadius = forceExplosive ? 3.5 : stats.blastRadius;
    proj.damage = stats.damagePerHit;
    proj.mesh.material = explosive ? this.projExplosiveMat : this.projStandardMat;
    proj.mesh.scale.setScalar(explosive ? 1.35 : 0.85);
    proj.mesh.position.copy(muzzlePos);
    proj.mesh.visible = true;
  }

  private detonateAt(wx: number, wy: number, wz: number, radius: number, damage: number): void {
    const destroyed = this.arena.triggerExplosion(wx, wy, wz, radius);
    soundManager.playExplosion();
    this.trauma = Math.min(1, this.trauma + 0.52);
    this.hitstopTimer = 0.035;

    if (destroyed.length > 0) {
      this.score += destroyed.length * 25;
    }

    // Blast damage to enemy defenders in radius
    for (const enemy of this.enemyManager.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.pos.x - wx;
      const dy = enemy.pos.y + 1 - wy;
      const dz = enemy.pos.z - wz;
      const dist = Math.hypot(dx, dy, dz);
      if (dist <= radius + 1.1) {
        const impulse = new THREE.Vector3(dx, 0, dz).normalize();
        const defeated = this.enemyManager.damageEnemy(enemy, damage, impulse);
        if (defeated) {
          this.enemiesDefeated++;
          this.score += 250;
        }
        soundManager.playHit();
        this.callbacks.onEnemyHit(defeated);
      }
    }

    this.callbacks.onBlocksDestroyed(destroyed, true);
    this.emitSnapshot();
  }

  private updatePlayerPhysics(dt: number): void {
    const stats = computeWeaponStats(this.weaponConfig, this.role);
    const moveSpeed = 8.4 * this.role.speedMultiplier;

    // Keyboard turn Q / E
    if (this.keysHeld.has('KeyQ')) this.playerYaw += 2.1 * dt;
    if (this.keysHeld.has('KeyE')) this.playerYaw -= 2.1 * dt;

    // Continuous held fire
    if (this.mouseDownLeft || this.keysHeld.has('KeyF')) {
      this.tryFireWeapon(false);
    }

    // Forward & screen-right basis vectors from playerYaw
    _forward.set(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
    _right.set(-Math.cos(this.playerYaw), 0, Math.sin(this.playerYaw));

    let wishForward = 0;
    let wishRight = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) wishForward += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) wishForward -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) wishRight += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) wishRight -= 1;

    _vecA.set(0, 0, 0);
    _vecA.addScaledVector(_forward, wishForward);
    _vecA.addScaledVector(_right, wishRight);
    if (_vecA.lengthSq() > 0.001) {
      _vecA.normalize().multiplyScalar(moveSpeed);
    }

    const accel = this.isGrounded ? 14 : 6;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _vecA.x, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _vecA.z, accel, dt);

    // Coyote time + buffered jump
    if (this.isGrounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.playerVel.y = 10.6 * this.role.jumpMultiplier;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.playerRig.triggerJumpSquash();
        soundManager.playJump();
      }
    }

    // Gravity
    this.playerVel.y -= 26 * dt;

    // Resolve X axis
    const halfW = 0.42;
    const height = 2.05;
    const nextX = THREE.MathUtils.clamp(
      this.playerPos.x + this.playerVel.x * dt,
      -ARENA_HALF_EXTENT + 0.5,
      ARENA_HALF_EXTENT - 0.5
    );
    if (!this.arena.grid.intersectsBox(nextX, this.playerPos.y, this.playerPos.z, halfW, height)) {
      this.playerPos.x = nextX;
    } else {
      this.playerVel.x = 0;
    }

    // Resolve Z axis
    const nextZ = THREE.MathUtils.clamp(
      this.playerPos.z + this.playerVel.z * dt,
      -ARENA_HALF_EXTENT + 0.5,
      ARENA_HALF_EXTENT - 0.5
    );
    if (!this.arena.grid.intersectsBox(this.playerPos.x, this.playerPos.y, nextZ, halfW, height)) {
      this.playerPos.z = nextZ;
    } else {
      this.playerVel.z = 0;
    }

    // Resolve Y axis
    const wasGrounded = this.isGrounded;
    const nextY = this.playerPos.y + this.playerVel.y * dt;
    if (nextY <= 0) {
      this.playerPos.y = 0;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else if (this.arena.grid.intersectsBox(this.playerPos.x, nextY, this.playerPos.z, halfW, height)) {
      if (this.playerVel.y < 0) {
        // Landed on top of a voxel block
        this.playerPos.y = Math.ceil(nextY / 1.5) * 1.5;
        this.isGrounded = true;
      }
      this.playerVel.y = 0;
    } else {
      this.playerPos.y = nextY;
      this.isGrounded = false;
    }

    if (!wasGrounded && this.isGrounded) {
      this.playerRig.triggerLandSquash();
    }

    // Update character visual rig
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.playerRig.updateAnimation(horizSpeed, this.isGrounded, dt, this.recoilKick, this.playerPitch);

    // Aim FOV zoom damping
    const targetFov = this.mouseDownRight ? stats.zoomFov : 68;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, dt);
      this.camera.updateProjectionMatrix();
    }

    // FPS weapon viewmodel sway & recoil
    if (this.cameraMode === 'fps') {
      if (horizSpeed > 0.3 && this.isGrounded) {
        this.walkBobPhase += horizSpeed * dt * 1.6;
      }
      const bobX = Math.cos(this.walkBobPhase * 0.5) * 0.015;
      const bobY = Math.abs(Math.sin(this.walkBobPhase)) * 0.02;
      const aimOffset = this.mouseDownRight ? -0.14 : 0;
      this.fpsWeaponRig.group.position.set(
        0.28 + aimOffset + bobX,
        -0.24 - bobY,
        -0.74 + this.recoilKick * 0.08
      );
      this.fpsWeaponRig.group.rotation.x = -this.recoilKick * 0.14;
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.explosive) {
        p.vel.y -= 5.2 * dt; // subtle arc on heavy shells
      }

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Check enemy hit
      let hitEnemy = false;
      for (const enemy of this.enemyManager.enemies) {
        if (!enemy.alive) continue;
        const dx = p.pos.x - enemy.pos.x;
        const dy = p.pos.y - (enemy.pos.y + 1.1);
        const dz = p.pos.z - enemy.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.85 * 0.85) {
          hitEnemy = true;
          if (p.explosive) {
            this.detonateAt(p.pos.x, p.pos.y, p.pos.z, p.blastRadius, p.damage);
          } else {
            const impulse = _vecB.copy(p.vel).setY(0).normalize();
            const defeated = this.enemyManager.damageEnemy(enemy, p.damage, impulse);
            if (defeated) {
              this.enemiesDefeated++;
              this.score += 250;
            }
            this.score += 40;
            soundManager.playHit();
            this.callbacks.onEnemyHit(defeated);
          }
          break;
        }
      }

      if (hitEnemy) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Check voxel or ground hit
      if (this.arena.grid.isPointSolid(p.pos.x, p.pos.y, p.pos.z)) {
        p.active = false;
        p.mesh.visible = false;
        if (p.explosive) {
          this.detonateAt(p.pos.x, Math.max(0.4, p.pos.y), p.pos.z, p.blastRadius, p.damage);
        } else {
          // Kinetic round chips single voxel block!
          const chipped = this.arena.triggerExplosion(p.pos.x, Math.max(0.4, p.pos.y), p.pos.z, 1.05);
          if (chipped.length > 0) {
            this.score += chipped.length * 20;
            this.callbacks.onBlocksDestroyed(chipped, false);
          }
        }
      }
    }
  }

  private snapGameplayCamera(): void {
    _forward.set(
      Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
      Math.sin(this.playerPitch),
      Math.cos(this.playerYaw) * Math.cos(this.playerPitch)
    );
    _right.set(-Math.cos(this.playerYaw), 0, Math.sin(this.playerYaw));

    if (this.cameraMode === 'fps') {
      this.smoothedCamPos.set(this.playerPos.x, this.playerPos.y + 1.68, this.playerPos.z);
      this.smoothedLookAt.copy(this.smoothedCamPos).addScaledVector(_forward, 10);
    } else {
      this.smoothedCamPos
        .set(this.playerPos.x, this.playerPos.y + 2.35, this.playerPos.z)
        .addScaledVector(_forward, -4.6)
        .addScaledVector(_right, 0.75);
      this.smoothedLookAt
        .set(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z)
        .addScaledVector(_forward, 6);
    }
    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedLookAt);
  }

  private updateGameplayCamera(dt: number): void {
    _forward.set(
      Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
      Math.sin(this.playerPitch),
      Math.cos(this.playerYaw) * Math.cos(this.playerPitch)
    );
    _right.set(-Math.cos(this.playerYaw), 0, Math.sin(this.playerYaw));

    if (this.cameraMode === 'fps') {
      _desiredCamPos.set(this.playerPos.x, this.playerPos.y + 1.68, this.playerPos.z);
      _lookTarget.copy(_desiredCamPos).addScaledVector(_forward, 12);
      this.smoothedCamPos.copy(_desiredCamPos);
      this.smoothedLookAt.copy(_lookTarget);
    } else {
      // TPS camera with wall pull-in check against solid voxel grid
      const anchorX = this.playerPos.x;
      const anchorY = this.playerPos.y + 1.85;
      const anchorZ = this.playerPos.z;
      const backDist = 4.6;
      const rightOffset = 0.75;

      let safeFactor = 1.0;
      const offsetX = -_forward.x * backDist + _right.x * rightOffset;
      const offsetY = 0.65 - _forward.y * 2.2;
      const offsetZ = -_forward.z * backDist + _right.z * rightOffset;

      for (let t = 0.25; t <= 1.0; t += 0.15) {
        const sx = anchorX + offsetX * t;
        const sy = Math.max(0.45, anchorY + offsetY * t);
        const sz = anchorZ + offsetZ * t;
        if (this.arena.grid.isPointSolid(sx, sy, sz)) {
          safeFactor = Math.max(0.22, t - 0.15);
          break;
        }
      }

      _desiredCamPos.set(
        anchorX + offsetX * safeFactor,
        Math.max(0.55, anchorY + offsetY * safeFactor),
        anchorZ + offsetZ * safeFactor
      );
      _lookTarget
        .set(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z)
        .addScaledVector(_forward, 7);

      const dampAlpha = 1 - Math.exp(-16 * dt);
      this.smoothedCamPos.lerp(_desiredCamPos, dampAlpha);
      this.smoothedLookAt.lerp(_lookTarget, dampAlpha);
    }

    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedLookAt);

    // Decaying trauma^2 camera shake
    if (this.trauma > 0.001) {
      const shake = this.trauma * this.trauma * 0.09;
      this.camera.rotation.z += (Math.random() - 0.5) * shake;
      this.camera.rotation.x += (Math.random() - 0.5) * shake * 0.7;
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      score: Math.round(this.score),
      remainingBlocks: this.arena.grid.activeCount,
      initialBlocks: this.initialBlocks,
      enemiesDefeated: this.enemiesDefeated,
      cameraMode: this.cameraMode,
      pointerLocked: this.pointerLocked,
      isAiming: this.mouseDownRight,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTimeMs) / 1000;
      this.lastTimeMs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (this.phase === 'title') {
        // Live World Camera Tour orbiting over both voxel castles
        this.titleTourTime += dt;
        const angle = this.titleTourTime * 0.22;
        const radius = 25;
        this.camera.position.set(
          Math.sin(angle) * radius,
          12 + Math.sin(this.titleTourTime * 0.45) * 2.5,
          Math.cos(angle) * radius
        );
        this.camera.lookAt(0, 2.2, 1.5);
        this.arena.updateEffects(dt);
      } else if (this.phase === 'playing') {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);
        this.recoilKick = THREE.MathUtils.damp(this.recoilKick, 0, 14, dt);

        if (this.hitstopTimer > 0) {
          this.hitstopTimer -= dt;
        } else {
          this.updatePlayerPhysics(dt);
          this.updateProjectiles(dt);
          this.enemyManager.update(dt, this.playerPos, this.arena.grid, (dmg) => {
            this.hp = Math.max(0, this.hp - dmg);
            this.trauma = Math.min(1, this.trauma + 0.32);
            this.emitSnapshot();
            if (this.hp <= 0) {
              this.callbacks.onPlayerDefeated();
            }
          });
        }

        this.arena.updateEffects(dt);
        this.updateGameplayCamera(dt);

        this.snapshotAccum += dt;
        if (this.snapshotAccum >= 0.12) {
          this.snapshotAccum = 0;
          this.emitSnapshot();
        }
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();

    this.arena.dispose();
    this.playerRig.dispose();
    this.tpsWeaponRig.dispose();
    this.fpsWeaponRig.dispose();
    this.enemyManager.dispose();
    this.projGeo.dispose();
    this.projStandardMat.dispose();
    this.projExplosiveMat.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
