import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { ANIMATIONS, type AnimationName, type SpeciesId } from '@arena/shared-types';
import {
  ASSETS,
  BASE_ANIMATIONS,
  LOCOMOTION_SPRITES,
  POKEMON,
  SPRITE_FRAME_HEIGHT,
  isValidAnimationSpec,
  spriteFrameWidth,
  type AnimationOverrides,
  type AnimationSpec,
} from '@arena/game-data';
import { checkOrigin, requireUser } from './auth';

// Sheets are overwritten in place, so sharp's file cache would return stale metadata.
sharp.cache(false);

type SheetKind = 'battle' | 'directions';
const MAX_UPLOAD_FRAMES = 60;
const SPECIES = Object.keys(POKEMON) as SpeciesId[];

let cachedRoot: string | undefined;
/** The admin studio edits the checked-out repository, so locate it from the process cwd. */
function repoRoot() {
  if (cachedRoot) return cachedRoot;
  const candidates: (string | undefined)[] = [process.env.ARENA_REPO_ROOT];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(dir);
    dir = dirname(dir);
  }
  for (const candidate of candidates)
    if (
      candidate &&
      existsSync(join(candidate, 'apps/frontend/public/assets')) &&
      existsSync(join(candidate, 'packages/game-data/src'))
    )
      return (cachedRoot = resolve(candidate));
  throw new ServiceUnavailableException(
    'Không tìm thấy thư mục mã nguồn dự án. Đặt ARENA_REPO_ROOT để bật trình chỉnh sprite.',
  );
}
const overridesFile = () => join(repoRoot(), 'packages/game-data/src/animation-overrides.json');

/** Writes go straight into source files; keep them to local development unless opted in. */
export function adminFileWritesEnabled() {
  if (process.env.ADMIN_FILE_WRITES === '1') return true;
  if (process.env.ADMIN_FILE_WRITES === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

let queue: Promise<unknown> = Promise.resolve();
/** Serialise file writes so two requests never interleave edits of one sheet. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function writeAtomic(file: string, data: Buffer | string) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, data);
  await rename(temp, file);
}

function parseSpecies(value: string): SpeciesId {
  if (!SPECIES.includes(value as SpeciesId)) throw new NotFoundException('Không tìm thấy thú.');
  return value as SpeciesId;
}
function parseAnimation(value: unknown): AnimationName {
  if (!(ANIMATIONS as readonly unknown[]).includes(value))
    throw new BadRequestException('Animation không hợp lệ.');
  return value as AnimationName;
}
function sheetPath(species: SpeciesId, kind: SheetKind) {
  const url =
    kind === 'battle'
      ? (ASSETS.sprites as Record<string, string>)[species]
      : LOCOMOTION_SPRITES[species];
  if (!url) throw new NotFoundException('Thú này không có sprite sheet loại đã chọn.');
  if (!url.endsWith('.png')) throw new BadRequestException('Chỉ hỗ trợ sprite sheet PNG.');
  return { url, file: join(repoRoot(), 'apps/frontend/public', url) };
}

async function sheetInfo(species: SpeciesId, kind: SheetKind) {
  const { url, file } = sheetPath(species, kind);
  const [meta, info] = await Promise.all([sharp(file).metadata(), stat(file)]);
  const frameWidth = spriteFrameWidth(species);
  const columns = Math.floor((meta.width ?? 0) / frameWidth);
  const rows = Math.floor((meta.height ?? 0) / SPRITE_FRAME_HEIGHT);
  return {
    url,
    version: Math.round(info.mtimeMs),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    frameWidth,
    frameHeight: SPRITE_FRAME_HEIGHT,
    columns,
    rows,
    frames: columns * rows,
  };
}

async function readOverrides(): Promise<AnimationOverrides> {
  try {
    const parsed = JSON.parse(await readFile(overridesFile(), 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as AnimationOverrides) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new ServiceUnavailableException('File animation-overrides.json bị lỗi định dạng.');
  }
}
async function writeOverrides(overrides: AnimationOverrides) {
  // Stable ordering keeps Git diffs small and readable.
  const ordered: AnimationOverrides = {};
  for (const species of SPECIES) {
    const entry = overrides[species];
    if (!entry) continue;
    const animations: Partial<Record<AnimationName, AnimationSpec>> = {};
    for (const name of ANIMATIONS) {
      const spec = entry[name];
      if (spec)
        animations[name] = {
          start: spec.start,
          end: spec.end,
          frameRate: spec.frameRate,
          repeat: spec.repeat,
        };
    }
    if (Object.keys(animations).length) ordered[species] = animations;
  }
  await writeAtomic(overridesFile(), `${JSON.stringify(ordered, null, 2)}\n`);
}
const sameSpec = (a: AnimationSpec, b: AnimationSpec) =>
  a.start === b.start && a.end === b.end && a.frameRate === b.frameRate && a.repeat === b.repeat;

function setOverride(
  overrides: AnimationOverrides,
  species: SpeciesId,
  name: AnimationName,
  spec: AnimationSpec | null,
) {
  const entry = { ...(overrides[species] ?? {}) };
  if (!spec || sameSpec(spec, BASE_ANIMATIONS[species][name])) delete entry[name];
  else entry[name] = spec;
  overrides[species] = entry;
}

async function speciesPayload(species: SpeciesId, overrides: AnimationOverrides) {
  const definition = POKEMON[species];
  const battle = await sheetInfo(species, 'battle');
  const directions = LOCOMOTION_SPRITES[species] ? await sheetInfo(species, 'directions') : null;
  return {
    id: species,
    name: definition.name,
    number: definition.number,
    element: definition.element,
    color: definition.color,
    portrait: (ASSETS.portraits as Record<string, string>)[species],
    sheets: { battle, directions },
    animations: Object.fromEntries(
      ANIMATIONS.map((name) => {
        const base = BASE_ANIMATIONS[species][name];
        const override = overrides[species]?.[name];
        const valid = isValidAnimationSpec(override);
        return [name, { base, current: valid ? override : base, overridden: valid }];
      }),
    ),
    skills: definition.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      element: skill.element,
      behavior: skill.behavior,
      animation: skill.animation,
      description: skill.description,
    })),
  };
}

function parseSpec(body: unknown, frames: number): AnimationSpec {
  const input = body as Record<string, unknown> | null;
  const spec = {
    start: Number(input?.start),
    end: Number(input?.end),
    frameRate: Math.round(Number(input?.frameRate) * 100) / 100,
    repeat: Number(input?.repeat),
  };
  if (!isValidAnimationSpec(spec))
    throw new BadRequestException(
      'Thông số không hợp lệ: start/end là số nguyên, end ≥ start, FPS 1–60, repeat ≥ -1.',
    );
  if (spec.frameRate < 1) throw new BadRequestException('FPS phải từ 1 đến 60.');
  if (spec.repeat > 99) throw new BadRequestException('Số lần lặp tối đa là 99.');
  if (spec.end >= frames)
    throw new BadRequestException(`Frame kết thúc vượt quá sprite sheet (tối đa ${frames - 1}).`);
  return spec;
}

function decodeImage(value: unknown) {
  if (typeof value !== 'string' || !value) throw new BadRequestException('Thiếu dữ liệu ảnh.');
  const match = /^data:image\/(png|webp);base64,(.+)$/s.exec(value);
  const buffer = Buffer.from(match ? match[2] : value, 'base64');
  if (!buffer.length || buffer.length > 12 * 1024 * 1024)
    throw new BadRequestException('Ảnh rỗng hoặc lớn hơn 12 MB.');
  return buffer;
}

async function rawRgba(input: Buffer | string) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new BadRequestException('Ảnh phải có kênh alpha RGBA.');
  return { data, width: info.width, height: info.height };
}

/** Copy one frame cell, replacing (not blending) the destination pixels. */
function blitFrame(
  source: { data: Buffer; width: number },
  sourceX: number,
  target: { data: Buffer; width: number },
  targetX: number,
  targetY: number,
  frameWidth: number,
) {
  const rowBytes = frameWidth * 4;
  for (let y = 0; y < SPRITE_FRAME_HEIGHT; y++) {
    const from = (y * source.width + sourceX) * 4;
    const to = ((targetY + y) * target.width + targetX) * 4;
    source.data.copy(target.data, to, from, from + rowBytes);
  }
}

@Controller('auth/admin')
export class AdminController {
  private async admin(req: Request, res: Response, mutate = false) {
    res.setHeader('Cache-Control', 'no-store');
    if (mutate) checkOrigin(req);
    const { user } = await requireUser(req);
    if (user.role !== 'admin') throw new ForbiddenException('Bạn không có quyền quản trị.');
    if (mutate && !adminFileWritesEnabled())
      throw new ForbiddenException(
        'Chỉnh sửa file bị tắt trên môi trường này. Đặt ADMIN_FILE_WRITES=1 để bật.',
      );
    return user;
  }

  @Get('sprites') async sprites(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.admin(req, res);
    const overrides = await readOverrides();
    return {
      writable: adminFileWritesEnabled(),
      species: await Promise.all(SPECIES.map((id) => speciesPayload(id, overrides))),
    };
  }

  @Put('sprites/:species/animations/:name') async saveAnimation(
    @Param('species') speciesParam: string,
    @Param('name') nameParam: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.admin(req, res, true);
    const species = parseSpecies(speciesParam);
    const name = parseAnimation(nameParam);
    return exclusive(async () => {
      const { frames } = await sheetInfo(species, 'battle');
      const spec = parseSpec(body, frames);
      const overrides = await readOverrides();
      setOverride(overrides, species, name, spec);
      await writeOverrides(overrides);
      return speciesPayload(species, overrides);
    });
  }

  @Delete('sprites/:species/animations/:name') async resetAnimation(
    @Param('species') speciesParam: string,
    @Param('name') nameParam: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.admin(req, res, true);
    const species = parseSpecies(speciesParam);
    const name = parseAnimation(nameParam);
    return exclusive(async () => {
      const overrides = await readOverrides();
      setOverride(overrides, species, name, null);
      await writeOverrides(overrides);
      return speciesPayload(species, overrides);
    });
  }

  /**
   * Upload a horizontal strip of N frames (N × frameWidth by 160px).
   * `replace` overwrites frames from `startFrame`; `append` adds rows at the bottom of
   * the battle sheet and can point an animation at the new frames.
   */
  @Post('sprites/:species/frames') async uploadFrames(
    @Param('species') speciesParam: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.admin(req, res, true);
    const species = parseSpecies(speciesParam);
    const input = (body ?? {}) as Record<string, unknown>;
    const kind: SheetKind = input.sheet === 'directions' ? 'directions' : 'battle';
    const mode = input.mode === 'append' ? 'append' : 'replace';
    if (mode === 'append' && kind !== 'battle')
      throw new BadRequestException('Chỉ sprite sheet chiến đấu hỗ trợ thêm hàng mới.');
    const assignTo = input.assignTo === undefined ? undefined : parseAnimation(input.assignTo);
    const image = decodeImage(input.image);

    return exclusive(async () => {
      const frameWidth = spriteFrameWidth(species);
      const strip = await rawRgba(image).catch((error: unknown) => {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException('Không đọc được ảnh. Hãy dùng PNG hoặc WebP.');
      });
      if (strip.height !== SPRITE_FRAME_HEIGHT || strip.width % frameWidth !== 0)
        throw new BadRequestException(
          `Dải frame phải cao ${SPRITE_FRAME_HEIGHT}px và rộng bội số của ${frameWidth}px.`,
        );
      const count = strip.width / frameWidth;
      if (count < 1 || count > MAX_UPLOAD_FRAMES)
        throw new BadRequestException(`Mỗi lần tải lên từ 1 đến ${MAX_UPLOAD_FRAMES} frame.`);

      const { file } = sheetPath(species, kind);
      const sheet = await rawRgba(file);
      const columns = Math.floor(sheet.width / frameWidth);
      const rows = Math.floor(sheet.height / SPRITE_FRAME_HEIGHT);
      let target = sheet;
      let first: number;
      if (mode === 'replace') {
        first = Number(input.startFrame);
        if (!Number.isInteger(first) || first < 0 || first + count > columns * rows)
          throw new BadRequestException(
            `Vị trí frame không hợp lệ: sheet có ${columns * rows} frame (0–${columns * rows - 1}).`,
          );
      } else {
        const addedRows = Math.ceil(count / columns);
        const height = sheet.height + addedRows * SPRITE_FRAME_HEIGHT;
        target = { data: Buffer.alloc(sheet.width * height * 4), width: sheet.width, height };
        sheet.data.copy(target.data, 0, 0, sheet.width * sheet.height * 4);
        first = columns * rows;
      }
      for (let i = 0; i < count; i++) {
        const frame = first + i;
        blitFrame(
          strip,
          i * frameWidth,
          target,
          (frame % columns) * frameWidth,
          Math.floor(frame / columns) * SPRITE_FRAME_HEIGHT,
          frameWidth,
        );
      }
      const png = await sharp(target.data, {
        raw: { width: target.width, height: target.height, channels: 4 },
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeAtomic(file, png);

      const overrides = await readOverrides();
      if (assignTo && kind === 'battle') {
        const current = overrides[species]?.[assignTo] ?? BASE_ANIMATIONS[species][assignTo];
        setOverride(overrides, species, assignTo, {
          start: first,
          end: first + count - 1,
          frameRate: current.frameRate,
          repeat: current.repeat,
        });
        await writeOverrides(overrides);
      }
      return speciesPayload(species, overrides);
    });
  }
}
