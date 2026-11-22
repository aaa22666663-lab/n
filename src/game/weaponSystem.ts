import * as THREE from 'three';
import {
  CustomDesign,
  PRESET_COLORS,
  PatternType,
  WeaponConfig,
} from './config';

/**
 * Renders a lightweight 128x128 custom design texture onto an HTML5 Canvas.
 * Used both in the Custom Creator Studio preview and as a live Three.js CanvasTexture.
 */
export function renderPatternToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: string,
  accentColor: string,
  pattern: PatternType,
  emblemText: string
): void {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = accentColor;
  ctx.strokeStyle = accentColor;

  if (pattern === 'stripes') {
    ctx.save();
    for (let x = -height; x < width + height; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x + 12 - height * 0.5, height);
      ctx.lineTo(x - height * 0.5, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (pattern === 'checker') {
    const step = Math.max(16, Math.floor(width / 8));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (((x / step) + (y / step)) % 2 === 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  } else if (pattern === 'camo') {
    const blobs = [
      [0.2, 0.25, 0.18],
      [0.7, 0.2, 0.22],
      [0.45, 0.55, 0.24],
      [0.15, 0.78, 0.2],
      [0.82, 0.75, 0.19],
    ];
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.ellipse(
        bx * width,
        by * height,
        br * width,
        br * height * 0.72,
        0.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (pattern === 'stars') {
    const coords = [
      [0.22, 0.22],
      [0.78, 0.22],
      [0.22, 0.78],
      [0.78, 0.78],
      [0.5, 0.5],
    ];
    for (const [sx, sy] of coords) {
      const cx = sx * width;
      const cy = sy * height;
      const r = width * 0.08;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.42;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // Border frame for crisp Roblox blocky edge
  ctx.lineWidth = Math.max(2, width * 0.03);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.strokeRect(0, 0, width, height);

  // Optional Emblem Text
  const label = emblemText.trim();
  if (label) {
    ctx.save();
    ctx.font = `bold ${Math.round(width * 0.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, width * 0.04);
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(label, width / 2, height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, width / 2, height / 2);
    ctx.restore();
  }
}

export function createTextureFromDataUrl(
  dataUrl: string,
  maxAniso: number,
  onReady: (tex: THREE.CanvasTexture) => void
): void {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    onReady(tex);
  };
  img.src = dataUrl;
}

/**
 * Multi-part procedural blocky modular weapon rig.
 * Used for both TPS character-held weapon and FPS viewmodel!
 */
export class ModularWeaponRig {
  public readonly group = new THREE.Group();
  public readonly muzzleAnchor = new THREE.Object3D();

  private readonly receiverMesh: THREE.Mesh;
  private readonly primaryMat: THREE.MeshStandardMaterial;
  private readonly darkMetalMat: THREE.MeshStandardMaterial;
  private readonly glowAccentMat: THREE.MeshStandardMaterial;
  private readonly lensMat: THREE.MeshStandardMaterial;

  // Swappable attachment groups
  private readonly barrelStandard: THREE.Group;
  private readonly barrelLong: THREE.Group;
  private readonly barrelSuppressor: THREE.Group;

  private readonly magStandard: THREE.Mesh;
  private readonly magExtended: THREE.Mesh;
  private readonly magHeavy: THREE.Group;

  private readonly scopeIron: THREE.Group;
  private readonly scopeRedDot: THREE.Group;
  private readonly scopeSniper: THREE.Group;

  private readonly underGrip: THREE.Group;
  private readonly underLauncher: THREE.Group;

  private dynamicTexture: THREE.Texture | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor() {
    this.primaryMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.36,
      metalness: 0.35,
    });
    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.72,
    });
    this.glowAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.2,
    });
    this.lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.85,
    });

    // Core Receiver + Grip + Stock
    const recGeo = new THREE.BoxGeometry(0.16, 0.18, 0.56);
    this.geometries.push(recGeo);
    this.receiverMesh = new THREE.Mesh(recGeo, this.primaryMat);
    this.receiverMesh.position.set(0, 0, 0);
    this.group.add(this.receiverMesh);

    const railGeo = new THREE.BoxGeometry(0.1, 0.04, 0.46);
    const gripGeo = new THREE.BoxGeometry(0.11, 0.22, 0.12);
    const stockGeo = new THREE.BoxGeometry(0.12, 0.16, 0.22);
    this.geometries.push(railGeo, gripGeo, stockGeo);

    const topRail = new THREE.Mesh(railGeo, this.darkMetalMat);
    topRail.position.set(0, 0.11, 0);
    this.group.add(topRail);

    const grip = new THREE.Mesh(gripGeo, this.darkMetalMat);
    grip.position.set(0, -0.17, -0.14);
    grip.rotation.x = 0.22;
    this.group.add(grip);

    const stock = new THREE.Mesh(stockGeo, this.darkMetalMat);
    stock.position.set(0, -0.02, -0.36);
    this.group.add(stock);

    // --- BARRELS (pointing +Z) ---
    this.barrelStandard = new THREE.Group();
    const bStdGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8);
    bStdGeo.rotateX(Math.PI / 2);
    this.geometries.push(bStdGeo);
    const bStdMesh = new THREE.Mesh(bStdGeo, this.darkMetalMat);
    bStdMesh.position.set(0, 0.02, 0.4);
    this.barrelStandard.add(bStdMesh);
    this.group.add(this.barrelStandard);

    this.barrelLong = new THREE.Group();
    const bLongGeo = new THREE.CylinderGeometry(0.036, 0.042, 0.52, 8);
    bLongGeo.rotateX(Math.PI / 2);
    const shroudGeo = new THREE.BoxGeometry(0.12, 0.11, 0.24);
    this.geometries.push(bLongGeo, shroudGeo);
    const bLongMesh = new THREE.Mesh(bLongGeo, this.darkMetalMat);
    bLongMesh.position.set(0, 0.02, 0.52);
    const shroudMesh = new THREE.Mesh(shroudGeo, this.primaryMat);
    shroudMesh.position.set(0, 0.02, 0.36);
    this.barrelLong.add(bLongMesh, shroudMesh);
    this.group.add(this.barrelLong);

    this.barrelSuppressor = new THREE.Group();
    const suppGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.36, 10);
    suppGeo.rotateX(Math.PI / 2);
    const suppTipGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10);
    suppTipGeo.rotateX(Math.PI / 2);
    this.geometries.push(suppGeo, suppTipGeo);
    const suppMesh = new THREE.Mesh(suppGeo, this.darkMetalMat);
    suppMesh.position.set(0, 0.02, 0.44);
    const suppBand = new THREE.Mesh(suppTipGeo, this.glowAccentMat);
    suppBand.position.set(0, 0.02, 0.59);
    this.barrelSuppressor.add(suppMesh, suppBand);
    this.group.add(this.barrelSuppressor);

    // --- MAGAZINES ---
    const magStdGeo = new THREE.BoxGeometry(0.09, 0.22, 0.11);
    this.geometries.push(magStdGeo);
    this.magStandard = new THREE.Mesh(magStdGeo, this.darkMetalMat);
    this.magStandard.position.set(0, -0.17, 0.06);
    this.group.add(this.magStandard);

    const magExtGeo = new THREE.BoxGeometry(0.09, 0.36, 0.12);
    this.geometries.push(magExtGeo);
    this.magExtended = new THREE.Mesh(magExtGeo, this.primaryMat);
    this.magExtended.position.set(0, -0.23, 0.07);
    this.magExtended.rotation.x = -0.18;
    this.group.add(this.magExtended);

    this.magHeavy = new THREE.Group();
    const drumGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 10);
    drumGeo.rotateX(Math.PI / 2);
    const coreStripGeo = new THREE.BoxGeometry(0.11, 0.05, 0.15);
    this.geometries.push(drumGeo, coreStripGeo);
    const drumMesh = new THREE.Mesh(drumGeo, this.darkMetalMat);
    drumMesh.position.set(0, -0.17, 0.07);
    const coreStrip = new THREE.Mesh(coreStripGeo, this.glowAccentMat);
    coreStrip.position.set(0, -0.17, 0.07);
    this.magHeavy.add(drumMesh, coreStrip);
    this.group.add(this.magHeavy);

    // --- SCOPES ---
    this.scopeIron = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.03, 0.07, 0.03);
    this.geometries.push(postGeo);
    const frontPost = new THREE.Mesh(postGeo, this.darkMetalMat);
    frontPost.position.set(0, 0.16, 0.2);
    const rearPost = new THREE.Mesh(postGeo, this.darkMetalMat);
    rearPost.position.set(0, 0.16, -0.18);
    this.scopeIron.add(frontPost, rearPost);
    this.group.add(this.scopeIron);

    this.scopeRedDot = new THREE.Group();
    const rdFrameGeo = new THREE.BoxGeometry(0.1, 0.09, 0.14);
    const rdDotGeo = new THREE.SphereGeometry(0.018, 8, 8);
    this.geometries.push(rdFrameGeo, rdDotGeo);
    const rdFrame = new THREE.Mesh(rdFrameGeo, this.darkMetalMat);
    rdFrame.position.set(0, 0.17, 0.02);
    const rdDot = new THREE.Mesh(rdDotGeo, this.glowAccentMat);
    rdDot.position.set(0, 0.17, 0.02);
    this.scopeRedDot.add(rdFrame, rdDot);
    this.group.add(this.scopeRedDot);

    this.scopeSniper = new THREE.Group();
    const snTubeGeo = new THREE.CylinderGeometry(0.048, 0.042, 0.34, 10);
    snTubeGeo.rotateX(Math.PI / 2);
    const snLensGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.02, 10);
    snLensGeo.rotateX(Math.PI / 2);
    this.geometries.push(snTubeGeo, snLensGeo);
    const snTube = new THREE.Mesh(snTubeGeo, this.darkMetalMat);
    snTube.position.set(0, 0.19, 0.02);
    const snLens = new THREE.Mesh(snLensGeo, this.lensMat);
    snLens.position.set(0, 0.19, 0.19);
    this.scopeSniper.add(snTube, snLens);
    this.group.add(this.scopeSniper);

    // --- UNDERBARRELS ---
    this.underGrip = new THREE.Group();
    const fgGeo = new THREE.BoxGeometry(0.07, 0.14, 0.08);
    this.geometries.push(fgGeo);
    const fgMesh = new THREE.Mesh(fgGeo, this.darkMetalMat);
    fgMesh.position.set(0, -0.14, 0.22);
    fgMesh.rotation.x = 0.28;
    this.underGrip.add(fgMesh);
    this.group.add(this.underGrip);

    this.underLauncher = new THREE.Group();
    const tubeGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.34, 10);
    tubeGeo.rotateX(Math.PI / 2);
    const ringGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.05, 10);
    ringGeo.rotateX(Math.PI / 2);
    this.geometries.push(tubeGeo, ringGeo);
    const launcherTube = new THREE.Mesh(tubeGeo, this.darkMetalMat);
    launcherTube.position.set(0, -0.12, 0.26);
    const warningBand = new THREE.Mesh(ringGeo, this.glowAccentMat);
    warningBand.position.set(0, -0.12, 0.39);
    this.underLauncher.add(launcherTube, warningBand);
    this.group.add(this.underLauncher);

    // Muzzle anchor
    this.muzzleAnchor.position.set(0, 0.02, 0.65);
    this.group.add(this.muzzleAnchor);
  }

  public applyConfig(
    weapon: WeaponConfig,
    customDesign: CustomDesign | null,
    maxAniso: number
  ): void {
    // Attachments visibility
    this.barrelStandard.visible = weapon.barrel === 'standard';
    this.barrelLong.visible = weapon.barrel === 'long';
    this.barrelSuppressor.visible = weapon.barrel === 'suppressor';

    this.magStandard.visible = weapon.magazine === 'standard';
    this.magExtended.visible = weapon.magazine === 'extended';
    this.magHeavy.visible = weapon.magazine === 'heavy';

    this.scopeIron.visible = weapon.scope === 'iron';
    this.scopeRedDot.visible = weapon.scope === 'red_dot';
    this.scopeSniper.visible = weapon.scope === 'sniper';

    this.underGrip.visible = weapon.underbarrel === 'grip';
    this.underLauncher.visible = weapon.underbarrel === 'launcher';

    this.muzzleAnchor.position.z = weapon.barrel === 'long' ? 0.8 : weapon.barrel === 'suppressor' ? 0.66 : 0.56;

    // Color or Custom Canvas Texture
    if (customDesign && customDesign.target === 'weapon' && customDesign.canvasDataUrl) {
      createTextureFromDataUrl(customDesign.canvasDataUrl, maxAniso, (tex) => {
        if (this.dynamicTexture) {
          this.dynamicTexture.dispose();
        }
        this.dynamicTexture = tex;
        this.primaryMat.map = tex;
        this.primaryMat.color.setHex(0xffffff);
        this.primaryMat.roughness = 0.42;
        this.primaryMat.metalness = 0.25;
        this.primaryMat.needsUpdate = true;
      });
    } else {
      if (this.dynamicTexture) {
        this.dynamicTexture.dispose();
        this.dynamicTexture = null;
      }
      const preset = PRESET_COLORS.find((c) => c.id === weapon.colorId) || PRESET_COLORS[0];
      this.primaryMat.map = null;
      this.primaryMat.color.set(preset.hex);
      this.primaryMat.roughness = preset.roughness;
      this.primaryMat.metalness = preset.metalness;
      this.primaryMat.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.dynamicTexture) {
      this.dynamicTexture.dispose();
      this.dynamicTexture = null;
    }
    this.primaryMat.dispose();
    this.darkMetalMat.dispose();
    this.glowAccentMat.dispose();
    this.lensMat.dispose();
    this.geometries.forEach((g) => g.dispose());
  }
}
