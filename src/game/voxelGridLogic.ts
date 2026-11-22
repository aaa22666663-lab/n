import { ARENA_GRID_X, ARENA_GRID_Y, ARENA_GRID_Z, VOXEL_SIZE } from './config';

export type VoxelKind =
  | 0 // empty
  | 1 // blue castle stone
  | 2 // blue castle trim
  | 3 // red castle stone
  | 4 // red castle trim
  | 5 // central cover / stone brick
  | 6 // wooden crate / destructible cover
  | 7; // castle core crystal (high CP bonus!)

export interface DestroyedVoxelInfo {
  index: number;
  gx: number;
  gy: number;
  gz: number;
  wx: number;
  wy: number;
  wz: number;
  kind: VoxelKind;
  colorHex: number;
}

export const VOXEL_COLOR_MAP: Record<Exclude<VoxelKind, 0>, number> = {
  1: 0x3b82f6, // blue castle stone
  2: 0x1d4ed8, // blue castle dark trim
  3: 0xef4444, // red castle stone
  4: 0x991b1b, // red castle dark trim
  5: 0x94a3b8, // neutral slate cover
  6: 0xd97706, // wooden crate cover
  7: 0xfacc15, // golden core crystal
};

export function gridIndex(gx: number, gy: number, gz: number): number {
  return (gy * ARENA_GRID_Z + gz) * ARENA_GRID_X + gx;
}

export function inGridBounds(gx: number, gy: number, gz: number): boolean {
  return (
    gx >= 0 &&
    gx < ARENA_GRID_X &&
    gy >= 0 &&
    gy < ARENA_GRID_Y &&
    gz >= 0 &&
    gz < ARENA_GRID_Z
  );
}

export function gridToWorldCenter(gx: number, gy: number, gz: number): { x: number; y: number; z: number } {
  return {
    x: (gx - ARENA_GRID_X / 2 + 0.5) * VOXEL_SIZE,
    y: gy * VOXEL_SIZE + VOXEL_SIZE * 0.5,
    z: (gz - ARENA_GRID_Z / 2 + 0.5) * VOXEL_SIZE,
  };
}

export function worldToGrid(wx: number, wy: number, wz: number): { gx: number; gy: number; gz: number } {
  return {
    gx: Math.floor(wx / VOXEL_SIZE + ARENA_GRID_X / 2),
    gy: Math.floor(wy / VOXEL_SIZE),
    gz: Math.floor(wz / VOXEL_SIZE + ARENA_GRID_Z / 2),
  };
}

export class VoxelGridData {
  public readonly cells: Uint8Array;
  public activeCount = 0;

  constructor() {
    this.cells = new Uint8Array(ARENA_GRID_X * ARENA_GRID_Y * ARENA_GRID_Z);
    this.resetArena();
  }

  public setCell(gx: number, gy: number, gz: number, kind: VoxelKind): void {
    if (!inGridBounds(gx, gy, gz)) return;
    const idx = gridIndex(gx, gy, gz);
    const prev = this.cells[idx];
    if (prev === 0 && kind !== 0) this.activeCount++;
    else if (prev !== 0 && kind === 0) this.activeCount--;
    this.cells[idx] = kind;
  }

  public getCell(gx: number, gy: number, gz: number): VoxelKind {
    if (!inGridBounds(gx, gy, gz)) return 0;
    return this.cells[gridIndex(gx, gy, gz)] as VoxelKind;
  }

  private fillBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    kind: VoxelKind
  ): void {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          this.setCell(x, y, z, kind);
        }
      }
    }
  }

  private buildCastle(zFront: number, zBack: number, stone: VoxelKind, trim: VoxelKind, facingPositiveZ: boolean): void {
    const zMin = Math.min(zFront, zBack);
    const zMax = Math.max(zFront, zBack);

    // Front wall (x = 7..20, height 0..2) with wide 4-tile central gate (x = 12..15)
    this.fillBox(7, 0, zFront, 11, 2, zFront, stone);
    this.fillBox(16, 0, zFront, 20, 2, zFront, stone);
    // Arch header above gate
    this.fillBox(12, 3, zFront, 15, 3, zFront, trim);
    // Crenellations along front wall
    for (let x = 7; x <= 20; x += 2) {
      this.setCell(x, 3, zFront, trim);
    }

    // Back wall
    this.fillBox(7, 0, zBack, 20, 2, zBack, stone);
    for (let x = 7; x <= 20; x += 2) {
      this.setCell(x, 3, zBack, trim);
    }

    // Side walls
    this.fillBox(7, 0, zMin, 7, 2, zMax, stone);
    this.fillBox(20, 0, zMin, 20, 2, zMax, stone);

    // Left & Right Corner Towers (5 voxels tall)
    this.fillBox(6, 0, zMin, 8, 4, zMin + 2, stone);
    this.fillBox(19, 0, zMin, 21, 4, zMin + 2, stone);
    this.fillBox(6, 0, zMax - 2, 8, 4, zMax, stone);
    this.fillBox(19, 0, zMax - 2, 21, 4, zMax, stone);

    // Tower crenellation caps
    for (const tx of [6, 8, 19, 21]) {
      for (const tz of [zMin, zMin + 2, zMax - 2, zMax]) {
        this.setCell(tx, 5, tz, trim);
      }
    }

    // Inner Keep Pillar / Core Crystal
    const coreZ = facingPositiveZ ? zMin + 1 : zMax - 1;
    this.setCell(13, 0, coreZ, trim);
    this.setCell(14, 0, coreZ, trim);
    this.setCell(13, 1, coreZ, 7);
    this.setCell(14, 1, coreZ, 7);
  }

  public resetArena(): void {
    this.cells.fill(0);
    this.activeCount = 0;

    // Blue Castle (Player side, negative Z: gz = 1..5)
    this.buildCastle(5, 1, 1, 2, true);

    // Red Castle (Enemy side, positive Z: gz = 22..26)
    this.buildCastle(22, 26, 3, 4, false);

    // Central Arena Cover & Destructible Bunkers (leave wide center & side lanes)
    // Mid-field cover walls (x = 7..9 and x = 18..20 at z = 13..14)
    this.fillBox(7, 0, 13, 9, 1, 14, 5);
    this.setCell(8, 2, 13, 6);
    this.fillBox(18, 0, 13, 20, 1, 14, 5);
    this.setCell(19, 2, 14, 6);

    // Central low bridge blocks (jumpable step-ups)
    this.fillBox(12, 0, 13, 12, 0, 14, 5);
    this.fillBox(15, 0, 13, 15, 0, 14, 5);
    this.setCell(12, 1, 13, 6);
    this.setCell(15, 1, 14, 6);

    // Forward crate clusters near each side for tactical cover
    this.fillBox(9, 0, 9, 10, 1, 9, 6);
    this.fillBox(17, 0, 9, 18, 1, 9, 6);
    this.fillBox(9, 0, 18, 10, 1, 18, 6);
    this.fillBox(17, 0, 18, 18, 1, 18, 6);

    // Flanking stone pillars
    this.fillBox(4, 0, 12, 4, 3, 12, 5);
    this.fillBox(4, 0, 15, 4, 3, 15, 5);
    this.fillBox(23, 0, 12, 23, 3, 12, 5);
    this.fillBox(23, 0, 15, 23, 3, 15, 5);
  }

  /**
   * Destroys all voxels within world-space spherical radius and returns their metadata.
   */
  public applyExplosion(wx: number, wy: number, wz: number, radiusWorld: number): DestroyedVoxelInfo[] {
    const destroyed: DestroyedVoxelInfo[] = [];
    const rSq = radiusWorld * radiusWorld;

    const minG = worldToGrid(wx - radiusWorld, wy - radiusWorld, wz - radiusWorld);
    const maxG = worldToGrid(wx + radiusWorld, wy + radiusWorld, wz + radiusWorld);

    const gx0 = Math.max(0, minG.gx);
    const gx1 = Math.min(ARENA_GRID_X - 1, maxG.gx);
    const gy0 = Math.max(0, minG.gy);
    const gy1 = Math.min(ARENA_GRID_Y - 1, maxG.gy);
    const gz0 = Math.max(0, minG.gz);
    const gz1 = Math.min(ARENA_GRID_Z - 1, maxG.gz);

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const kind = this.getCell(gx, gy, gz);
          if (kind === 0) continue;
          const center = gridToWorldCenter(gx, gy, gz);
          const dx = center.x - wx;
          const dy = center.y - wy;
          const dz = center.z - wz;
          if (dx * dx + dy * dy + dz * dz <= rSq) {
            const idx = gridIndex(gx, gy, gz);
            this.setCell(gx, gy, gz, 0);
            destroyed.push({
              index: idx,
              gx,
              gy,
              gz,
              wx: center.x,
              wy: center.y,
              wz: center.z,
              kind,
              colorHex: VOXEL_COLOR_MAP[kind],
            });
          }
        }
      }
    }

    return destroyed;
  }

  /**
   * Checks if an AABB (bottom-center at x, y, z with halfWidth & height) overlaps any solid voxel.
   */
  public intersectsBox(x: number, y: number, z: number, halfWidth: number, height: number): boolean {
    const minG = worldToGrid(x - halfWidth, y + 0.05, z - halfWidth);
    const maxG = worldToGrid(x + halfWidth, y + height - 0.05, z + halfWidth);

    for (let gy = minG.gy; gy <= maxG.gy; gy++) {
      for (let gz = minG.gz; gz <= maxG.gz; gz++) {
        for (let gx = minG.gx; gx <= maxG.gx; gx++) {
          if (this.getCell(gx, gy, gz) !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Checks if a world-space point hits any solid voxel or the arena ground floor (y <= 0).
   */
  public isPointSolid(wx: number, wy: number, wz: number): boolean {
    if (wy <= 0) return true;
    const { gx, gy, gz } = worldToGrid(wx, wy, wz);
    return this.getCell(gx, gy, gz) !== 0;
  }
}

export const ARENA_HALF_EXTENT = (ARENA_GRID_X * VOXEL_SIZE) / 2 - 0.6;
