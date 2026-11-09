'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationName, SpeciesId } from '@arena/shared-types';
import {
  adminApi,
  sheetUrl,
  ANIMATION_LABELS,
  DIRECTION_ROWS,
  type AdminSpecies,
  type AdminUser,
  type AnimationSpec,
  type SheetInfo,
} from './admin-api';
import {
  SpritePlayer,
  SpriteThumb,
  FrameCell,
  useSheetImage,
  downloadFrameAsPng,
  downloadRangeAsPng,
  type StageBackground,
} from './sprite-canvas';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Save,
  Upload,
  Download,
  CornerDownRight,
  CornerDownLeft,
  ArrowLeft,
  LogOut,
  Layers,
  Sparkles,
  Info,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  Grid,
} from 'lucide-react';

export function SpriteStudio() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Studio data
  const [speciesList, setSpeciesList] = useState<AdminSpecies[]>([]);
  const [writable, setWritable] = useState(true);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<SpeciesId>('pikachu');
  const [activeSheetKind, setActiveSheetKind] = useState<'battle' | 'directions'>('battle');
  const [selectedAnim, setSelectedAnim] = useState<AnimationName>('idle');
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Playback & stage controls
  const [playing, setPlaying] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [flip, setFlip] = useState(false);
  const [onion, setOnion] = useState(false);
  const [guides, setGuides] = useState(true);
  const [loopPreview, setLoopPreview] = useState(true);
  const [background, setBackground] = useState<StageBackground>('night');

  // Animation edit form
  const [formStart, setFormStart] = useState<number>(0);
  const [formEnd, setFormEnd] = useState<number>(5);
  const [formFps, setFormFps] = useState<number>(10);
  const [formRepeat, setFormRepeat] = useState<number>(-1);
  const [savingAnim, setSavingAnim] = useState(false);
  const [selectedTimelineFrame, setSelectedTimelineFrame] = useState<number>(0);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [uploadStartFrame, setUploadStartFrame] = useState(0);
  const [uploadAssignAnim, setUploadAssignAnim] = useState<AnimationName | ''>('');
  const [uploadImageData, setUploadImageData] = useState<string | null>(null);
  const [uploadFrameCount, setUploadFrameCount] = useState<number>(0);
  const [uploading, setUploading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@arena.local');
  const [loginPassword, setLoginPassword] = useState('admin12345');
  const [loginBusy, setLoginBusy] = useState(false);

  // Initial auth & catalog load
  useEffect(() => {
    let active = true;
    void adminApi
      .me()
      .then(async ({ user }) => {
        if (!active) return;
        setUser(user);
        if (user?.role === 'admin') {
          const catalog = await adminApi.sprites();
          if (active) {
            setSpeciesList(catalog.species);
            setWritable(catalog.writable);
            if (catalog.species.length > 0) {
              setSelectedSpeciesId(catalog.species[0].id);
            }
          }
        }
      })
      .catch((err) => {
        if (active) setAuthError(err.message || 'Lỗi khi kiểm tra phiên đăng nhập.');
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeSpecies = useMemo(
    () => speciesList.find((s) => s.id === selectedSpeciesId) ?? speciesList[0],
    [speciesList, selectedSpeciesId],
  );

  const activeSheet: SheetInfo | null = useMemo(() => {
    if (!activeSpecies) return null;
    return activeSheetKind === 'battle'
      ? activeSpecies.sheets.battle
      : activeSpecies.sheets.directions;
  }, [activeSpecies, activeSheetKind]);

  // Load current sheet texture
  const sheetImageUrl = activeSheet ? sheetUrl(activeSheet) : null;
  const sheetImage = useSheetImage(sheetImageUrl);

  // Current animation spec
  const currentAnimSpec: AnimationSpec = useMemo(() => {
    if (!activeSpecies) return { start: 0, end: 5, frameRate: 10, repeat: -1 };
    return (
      activeSpecies.animations[selectedAnim]?.current ?? {
        start: 0,
        end: 5,
        frameRate: 10,
        repeat: -1,
      }
    );
  }, [activeSpecies, selectedAnim]);

  // Sync form when active animation changes
  useEffect(() => {
    setFormStart(currentAnimSpec.start);
    setFormEnd(currentAnimSpec.end);
    setFormFps(currentAnimSpec.frameRate);
    setFormRepeat(currentAnimSpec.repeat);
    setCursor(0);
  }, [currentAnimSpec, selectedAnim, selectedSpeciesId]);

  // Calculate sequence of frame indices for active preview
  const previewFrames = useMemo(() => {
    if (activeSheetKind === 'directions') {
      // In directions preview, show the 6 frames of the selected row
      return [0, 1, 2, 3, 4, 5];
    }
    const frames: number[] = [];
    const s = Math.max(0, formStart);
    const e = Math.max(s, formEnd);
    for (let i = s; i <= e; i++) frames.push(i);
    return frames.length > 0 ? frames : [0];
  }, [activeSheetKind, formStart, formEnd]);

  // Skills using the selected animation
  const skillsUsingAnim = useMemo(() => {
    if (!activeSpecies) return [];
    return activeSpecies.skills.filter((s) => s.animation === selectedAnim);
  }, [activeSpecies, selectedAnim]);

  // Auth Handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setAuthError(null);
    try {
      const { user } = await adminApi.login(loginEmail, loginPassword);
      if (!user || user.role !== 'admin') {
        throw new Error('Tài khoản này không có quyền Quản trị viên (admin).');
      }
      setUser(user);
      const catalog = await adminApi.sprites();
      setSpeciesList(catalog.species);
      setWritable(catalog.writable);
      if (catalog.species.length > 0) setSelectedSpeciesId(catalog.species[0].id);
    } catch (err: any) {
      setAuthError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await adminApi.logout();
    setUser(null);
    window.location.assign('/');
  }

  // Save animation form
  async function handleSaveAnimation(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSpecies) return;
    setSavingAnim(true);
    setStatusMessage(null);
    try {
      const updated = await adminApi.saveAnimation(activeSpecies.id, selectedAnim, {
        start: formStart,
        end: formEnd,
        frameRate: formFps,
        repeat: formRepeat,
      });
      setSpeciesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setStatusMessage({
        text: `Đã lưu animation "${ANIMATION_LABELS[selectedAnim]?.vi ?? selectedAnim}" thành công!`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Lỗi khi lưu animation.', type: 'error' });
    } finally {
      setSavingAnim(false);
    }
  }

  // Reset animation to base
  async function handleResetAnimation() {
    if (!activeSpecies) return;
    if (
      !confirm(
        `Khôi phục animation "${ANIMATION_LABELS[selectedAnim]?.vi ?? selectedAnim}" về cấu hình ban đầu?`,
      )
    )
      return;
    setSavingAnim(true);
    setStatusMessage(null);
    try {
      const updated = await adminApi.resetAnimation(activeSpecies.id, selectedAnim);
      setSpeciesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setStatusMessage({ text: 'Đã khôi phục về mặc định.', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Lỗi khi khôi phục.', type: 'error' });
    } finally {
      setSavingAnim(false);
    }
  }

  // Sync selectedTimelineFrame when animation changes
  useEffect(() => {
    setSelectedTimelineFrame(formStart);
  }, [formStart, selectedAnim]);

  function handleDownloadSingleFrame(frameIndex: number) {
    if (!sheetImage || !activeSheet || !activeSpecies) return;
    const filename = `${activeSpecies.id}-${activeSheetKind}-frame-${frameIndex}.png`;
    downloadFrameAsPng(sheetImage, activeSheet, frameIndex, filename);
    setStatusMessage({
      text: `Đã tải xuống frame #${frameIndex} (${filename})`,
      type: 'success',
    });
  }

  function handleDownloadRange(start: number, end: number) {
    if (!sheetImage || !activeSheet || !activeSpecies) return;
    const filename = `${activeSpecies.id}-${selectedAnim}-frames-${start}-to-${end}.png`;
    downloadRangeAsPng(sheetImage, activeSheet, start, end, filename);
    setStatusMessage({
      text: `Đã tải xuống dải frame #${start}..#${end} (${filename})`,
      type: 'success',
    });
  }

  function handleOpenUploadForFrame(frameIndex: number) {
    setUploadMode('replace');
    setUploadStartFrame(frameIndex);
    setUploadAssignAnim('');
    setUploadImageData(null);
    setUploadFrameCount(0);
    setUploadOpen(true);
  }

  function handleSetAsStart(frameIndex: number) {
    setFormStart(frameIndex);
    if (frameIndex > formEnd) setFormEnd(frameIndex);
    setStatusMessage({
      text: `Đã đặt Frame Bắt Đầu là #${frameIndex}. Nhớ bấm "Lưu Thay Đổi" để áp dụng.`,
      type: 'success',
    });
  }

  function handleSetAsEnd(frameIndex: number) {
    setFormEnd(frameIndex);
    if (frameIndex < formStart) setFormStart(frameIndex);
    setStatusMessage({
      text: `Đã đặt Frame Kết Thúc là #${frameIndex}. Nhớ bấm "Lưu Thay Đổi" để áp dụng.`,
      type: 'success',
    });
  }

  // Upload handler
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadImageData(result);
      // Determine frame count
      const img = new Image();
      img.onload = () => {
        const frameW = activeSpecies?.sheets.battle.frameWidth ?? 160;
        const count = Math.floor(img.width / frameW);
        setUploadFrameCount(count);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSpecies || !uploadImageData) return;
    setUploading(true);
    setStatusMessage(null);
    try {
      const updated = await adminApi.uploadFrames(activeSpecies.id, {
        sheet: activeSheetKind,
        mode: uploadMode,
        image: uploadImageData,
        startFrame: uploadMode === 'replace' ? uploadStartFrame : undefined,
        assignTo: uploadAssignAnim || undefined,
      });
      setSpeciesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setUploadOpen(false);
      setUploadImageData(null);
      setStatusMessage({
        text: `Đã tải lên và cập nhật ${uploadFrameCount} frames thành công!`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Lỗi khi tải lên frame strip.', type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  // If loading session
  if (authLoading) {
    return (
      <div className="admin-shell">
        <div className="admin-auth-wrapper">
          <div className="admin-auth-card" style={{ textAlign: 'center' }}>
            <h2>Đang tải Trình Quản Trị Sprite...</h2>
            <p className="subtitle">Vui lòng đợi giây lát</p>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in or not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand">
            <span className="admin-logo-badge">Admin</span>
            <h1 className="admin-title">Triệu Hồi Sư — Quản Trị Hệ Thống</h1>
          </div>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => window.location.assign('/')}
          >
            <ArrowLeft size={16} /> Quay lại Game
          </button>
        </header>

        <div className="admin-auth-wrapper">
          <div className="admin-auth-card">
            <h2>Đăng Nhập Quản Trị Viên</h2>
            <p className="subtitle">Quản lý và chỉnh sửa sprite animation của các thú triệu hồi</p>

            <div className="admin-auth-preset">
              <div>
                Tài khoản mặc định: <code>admin@arena.local</code> / <code>admin12345</code>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() => {
                  setLoginEmail('admin@arena.local');
                  setLoginPassword('admin12345');
                }}
              >
                Tự điền
              </button>
            </div>

            {authError && <div className="admin-error-box">{authError}</div>}

            <form onSubmit={handleLogin} className="admin-auth-form">
              <div className="admin-field">
                <label>Email Admin</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="admin-field">
                <label>Mật Khẩu</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={loginBusy}
                style={{ marginTop: 8 }}
              >
                {loginBusy ? 'Đang xác thực...' : 'Đăng Nhập Admin'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main Studio View
  return (
    <div className="admin-shell">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo-badge">Studio</span>
          <h1 className="admin-title">Trình Chỉnh Sửa Sprite & Animation Thú Triệu Hồi</h1>
        </div>

        <div className="admin-header-actions">
          <div className="admin-user-pill">
            <span>
              Quản trị viên: <strong>{user.name}</strong>
            </span>
            <span className="admin-user-badge">Admin</span>
          </div>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => window.location.assign('/')}
            title="Trở về giao diện trò chơi"
          >
            <ArrowLeft size={15} /> Về Game
          </button>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Species Selector Bar */}
      <div className="species-bar">
        {speciesList.map((species) => {
          const isActive = species.id === selectedSpeciesId;
          const overriddenCount = Object.values(species.animations).filter(
            (a) => a.overridden,
          ).length;
          return (
            <button
              key={species.id}
              className={`species-tab ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedSpeciesId(species.id)}
            >
              <img src={species.portrait} alt={species.name} />
              <span>{species.name}</span>
              <span className="badge">#{species.number}</span>
              {overriddenCount > 0 && (
                <span
                  className="anim-tag-mod"
                  title={`${overriddenCount} animation đã được chỉnh sửa`}
                >
                  {overriddenCount} mod
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status toast notification */}
      {statusMessage && (
        <div
          style={{
            margin: '12px 24px 0 24px',
            padding: '10px 16px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background:
              statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${statusMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: statusMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: 13,
          }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="studio-main">
        {/* Left: Animation List */}
        <aside className="studio-left-panel">
          <div>
            <div className="panel-section-title">
              <span>Loại Sprite Sheet</span>
            </div>
            <div className="sheet-toggle-group">
              <button
                className={`sheet-toggle-btn ${activeSheetKind === 'battle' ? 'active' : ''}`}
                onClick={() => setActiveSheetKind('battle')}
              >
                Chiến Đấu (Toàn bộ chiêu)
              </button>
              {activeSpecies?.sheets.directions && (
                <button
                  className={`sheet-toggle-btn ${activeSheetKind === 'directions' ? 'active' : ''}`}
                  onClick={() => setActiveSheetKind('directions')}
                >
                  Hướng Đi (8 hướng)
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="panel-section-title">
              <span>Danh Sách Animation ({Object.keys(ANIMATION_LABELS).length})</span>
            </div>

            <div className="anim-list">
              {(Object.keys(ANIMATION_LABELS) as AnimationName[]).map((animKey) => {
                const label = ANIMATION_LABELS[animKey];
                const animState = activeSpecies?.animations[animKey];
                const isSelected = selectedAnim === animKey;
                const spec = animState?.current ?? { start: 0, end: 5, frameRate: 10, repeat: -1 };
                const frames = [];
                for (let i = spec.start; i <= spec.end; i++) frames.push(i);

                return (
                  <div
                    key={animKey}
                    className={`anim-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedAnim(animKey)}
                  >
                    <div className="anim-info">
                      <strong>{label.vi}</strong>
                      <span>
                        {animKey} ({label.hint})
                      </span>
                    </div>

                    <div className="anim-meta">
                      {animState?.overridden && <span className="anim-tag-mod">Mod</span>}
                      <div className="anim-preview-thumb">
                        {sheetImage && activeSheet && (
                          <SpriteThumb
                            image={sheetImage}
                            sheet={activeSheet}
                            frames={frames.length ? frames : [0]}
                            fps={spec.frameRate}
                            size={40}
                            active={isSelected}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center: Stage Player & Timeline Scrubber */}
        <main className="studio-center-panel">
          <div className="stage-wrapper">
            <div className="stage-toolbar">
              <div className="stage-toolbar-group">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                  {ANIMATION_LABELS[selectedAnim]?.vi}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>({selectedAnim})</span>
              </div>

              <div className="stage-toolbar-group">
                {/* Stage Background picker */}
                {(['checker', 'night', 'meadow', 'lava'] as StageBackground[]).map((bg) => (
                  <button
                    key={bg}
                    className={`stage-tool-btn ${background === bg ? 'active' : ''}`}
                    onClick={() => setBackground(bg)}
                    title={`Nền: ${bg}`}
                  >
                    {bg === 'checker'
                      ? 'Ô cờ'
                      : bg === 'night'
                        ? 'Đêm'
                        : bg === 'meadow'
                          ? 'Đồng cỏ'
                          : 'Núi lửa'}
                  </button>
                ))}

                {/* Scale buttons */}
                {[1, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    className={`stage-tool-btn ${scale === s ? 'active' : ''}`}
                    onClick={() => setScale(s)}
                  >
                    {s}x
                  </button>
                ))}

                {/* Flip toggle */}
                <button
                  className={`stage-tool-btn ${flip ? 'active' : ''}`}
                  onClick={() => setFlip((v) => !v)}
                  title="Lật gương ngang"
                >
                  Lật ảnh
                </button>

                {/* Onion skin */}
                <button
                  className={`stage-tool-btn ${onion ? 'active' : ''}`}
                  onClick={() => setOnion((v) => !v)}
                  title="Hiện bóng mờ frame trước"
                >
                  Onion
                </button>

                {/* Baseline Guide */}
                <button
                  className={`stage-tool-btn ${guides ? 'active' : ''}`}
                  onClick={() => setGuides((v) => !v)}
                  title="Hiện đường căn tâm và mặt đất (y=149)"
                >
                  Đường căn
                </button>
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="stage-canvas-container">
              {activeSheet && (
                <SpritePlayer
                  image={sheetImage}
                  sheet={activeSheet}
                  frames={previewFrames}
                  fps={formFps}
                  repeat={formRepeat}
                  loopPreview={loopPreview}
                  playing={playing}
                  speed={speed}
                  scale={scale}
                  flip={flip}
                  onion={onion}
                  guides={guides}
                  background={background}
                  cursor={cursor}
                  onCursor={setCursor}
                />
              )}
            </div>

            {/* Playback Controls & Scrubber */}
            <div className="playback-bar">
              <div className="playback-buttons">
                <button
                  className="play-main-btn"
                  onClick={() => setPlaying((v) => !v)}
                  title={playing ? 'Tạm dừng (Space)' : 'Phát'}
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                  className="stage-tool-btn"
                  onClick={() => {
                    setPlaying(false);
                    setCursor((c) => Math.max(0, c - 1));
                  }}
                  title="Frame trước"
                >
                  <SkipBack size={14} />
                </button>

                <button
                  className="stage-tool-btn"
                  onClick={() => {
                    setPlaying(false);
                    setCursor((c) => (c + 1) % previewFrames.length);
                  }}
                  title="Frame sau"
                >
                  <SkipForward size={14} />
                </button>

                {/* Speed buttons */}
                {[0.5, 1, 1.5].map((sp) => (
                  <button
                    key={sp}
                    className={`stage-tool-btn ${speed === sp ? 'active' : ''}`}
                    onClick={() => setSpeed(sp)}
                  >
                    {sp}x
                  </button>
                ))}
              </div>

              {/* Scrubber slider */}
              <input
                type="range"
                className="scrubber-slider"
                min={0}
                max={Math.max(0, previewFrames.length - 1)}
                value={cursor}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
              />

              <div className="frame-counter-pill">
                Frame: <strong>{previewFrames[cursor] ?? 0}</strong> ({cursor + 1}/
                {previewFrames.length})
              </div>
            </div>
          </div>

          {/* Visual Sheet Timeline Strip */}
          <div className="timeline-strip-wrapper">
            <div className="timeline-strip-header">
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                  Dải Frame Trong Sprite Sheet (Tổng: {activeSheet?.frames ?? 0} frames)
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 10 }}>
                  Ô: {activeSheet?.frameWidth}×160px • Bấm ô để xem & thao tác nhanh
                </span>
              </div>

              {activeSheet && (
                <button
                  type="button"
                  className="stage-tool-btn"
                  onClick={() => handleDownloadRange(formStart, formEnd)}
                  title={`Tải dải ${formEnd - formStart + 1} frames của chiêu này về máy`}
                >
                  <Download size={13} /> Tải dải chiêu #{formStart}..#{formEnd} (PNG)
                </button>
              )}
            </div>

            {/* Contextual Frame Inspector Bar */}
            {selectedTimelineFrame !== null && activeSheet && (
              <div className="frame-inspector-bar">
                <div className="frame-inspector-info">
                  <div className="frame-inspector-thumb">
                    {sheetImage && (
                      <FrameCell
                        image={sheetImage}
                        sheet={activeSheet}
                        frame={selectedTimelineFrame}
                        size={52}
                      />
                    )}
                  </div>
                  <div>
                    <div className="frame-inspector-title">
                      <span>
                        Frame <strong>#{selectedTimelineFrame}</strong>
                      </span>
                      {selectedTimelineFrame >= formStart && selectedTimelineFrame <= formEnd && (
                        <span className="badge-active-range">
                          Đang trong chiêu ({selectedTimelineFrame - formStart + 1}/
                          {formEnd - formStart + 1})
                        </span>
                      )}
                    </div>
                    <div className="frame-inspector-sub">
                      Hàng {Math.floor(selectedTimelineFrame / activeSheet.columns) + 1}, Cột{' '}
                      {(selectedTimelineFrame % activeSheet.columns) + 1} • {activeSheet.frameWidth}
                      ×160px
                    </div>
                  </div>
                </div>

                <div className="frame-inspector-actions">
                  <button
                    type="button"
                    className="stage-tool-btn"
                    onClick={() => handleSetAsStart(selectedTimelineFrame)}
                    title="Đặt frame này làm điểm bắt đầu chiêu"
                  >
                    <CornerDownRight size={13} /> Đặt làm Start
                  </button>
                  <button
                    type="button"
                    className="stage-tool-btn"
                    onClick={() => handleSetAsEnd(selectedTimelineFrame)}
                    title="Đặt frame này làm điểm kết thúc chiêu"
                  >
                    <CornerDownLeft size={13} /> Đặt làm End
                  </button>
                  <button
                    type="button"
                    className="stage-tool-btn active"
                    onClick={() => handleOpenUploadForFrame(selectedTimelineFrame)}
                    title="Tải ảnh đè riêng frame này"
                  >
                    <Upload size={13} /> Thay thế riêng frame #{selectedTimelineFrame}
                  </button>
                  <button
                    type="button"
                    className="stage-tool-btn"
                    onClick={() => handleDownloadSingleFrame(selectedTimelineFrame)}
                    title="Tải riêng file ảnh của frame này về máy tính"
                  >
                    <Download size={13} /> Tải frame về máy (PNG)
                  </button>
                </div>
              </div>
            )}

            <div className="timeline-cells">
              {activeSheet &&
                Array.from({ length: Math.min(120, activeSheet.frames) }, (_, i) => {
                  const isInRange = i >= formStart && i <= formEnd;
                  const isCurrent = previewFrames[cursor] === i;
                  const isSelected = selectedTimelineFrame === i;
                  return (
                    <div
                      key={i}
                      className={`timeline-cell ${isInRange ? 'in-range' : ''} ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedTimelineFrame(i);
                        const idx = previewFrames.indexOf(i);
                        if (idx !== -1) setCursor(idx);
                      }}
                      title={`Frame #${i}${isInRange ? ' (Đang trong chiêu)' : ''}${isSelected ? ' (Đang xem)' : ''}`}
                    >
                      {sheetImage && (
                        <FrameCell image={sheetImage} sheet={activeSheet} frame={i} size={56} />
                      )}
                      <span className="timeline-cell-label">#{i}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </main>

        {/* Right: Settings, Save, Upload */}
        <aside className="studio-right-panel">
          {/* Animation Config Card */}
          <div className="editor-card">
            <h3>
              <Sliders size={16} /> Thông Số Animation
            </h3>

            <form
              onSubmit={handleSaveAnimation}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="form-grid-2">
                <div className="admin-field">
                  <label>Frame Bắt Đầu</label>
                  <input
                    type="number"
                    min={0}
                    max={formEnd}
                    value={formStart}
                    onChange={(e) => setFormStart(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label>Frame Kết Thúc</label>
                  <input
                    type="number"
                    min={formStart}
                    max={(activeSheet?.frames ?? 60) - 1}
                    value={formEnd}
                    onChange={(e) => setFormEnd(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="admin-field">
                  <label>Tốc Độ (FPS)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={formFps}
                    onChange={(e) => setFormFps(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label>Kiểu Lặp (Repeat)</label>
                  <select
                    value={formRepeat}
                    onChange={(e) => setFormRepeat(Number(e.target.value))}
                  >
                    <option value={-1}>Lặp vô hạn (Loop)</option>
                    <option value={0}>Chạy 1 lần (Đứng lại)</option>
                    <option value={1}>Lặp 2 lần</option>
                    <option value={2}>Lặp 3 lần</option>
                  </select>
                </div>
              </div>

              <div className="btn-row">
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  style={{ flex: 1 }}
                  disabled={savingAnim}
                >
                  <Save size={15} /> {savingAnim ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={handleResetAnimation}
                  disabled={savingAnim || !activeSpecies?.animations[selectedAnim]?.overridden}
                  title="Khôi phục thông số gốc của mã nguồn"
                >
                  <RotateCcw size={15} /> Gốc
                </button>
              </div>
            </form>
          </div>

          {/* Upload New Sprite Frames */}
          <div className="editor-card">
            <h3>
              <Upload size={16} /> Tải Lên & Thêm Frame
            </h3>

            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Thay thế hoặc nối thêm frame vào file sprite sheet PNG của {activeSpecies?.name}.
            </p>

            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                setUploadOpen(true);
                setUploadStartFrame(formStart);
                setUploadAssignAnim(selectedAnim);
              }}
            >
              <Upload size={15} /> Mở Công Cụ Tải Lên Frame
            </button>
          </div>

          {/* Associated Skills */}
          <div className="editor-card">
            <h3>
              <Sparkles size={16} /> Kỹ Năng Dùng Chiêu Này
            </h3>

            {skillsUsingAnim.length === 0 ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Không có kỹ năng chiến đấu nào dùng animation "{selectedAnim}" (chủ yếu là đòn đánh
                thường hoặc hành động cơ bản).
              </span>
            ) : (
              <div className="skill-chip-list">
                {skillsUsingAnim.map((skill) => (
                  <div key={skill.id} className="skill-chip">
                    <strong>{skill.name}</strong>
                    <span>{skill.description || 'Kỹ năng nguyên tố'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Upload Modal Dialog */}
      {uploadOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="admin-auth-card" style={{ maxWidth: 540 }}>
            <h2>Tải Lên Frame Sprite Mới</h2>
            <p className="subtitle">
              Chọn ảnh PNG dải ngang chứa các frame (chiều cao 160px, chiều rộng bội số của{' '}
              {activeSpecies?.sheets.battle.frameWidth}px).
            </p>

            <form onSubmit={handleUploadSubmit} className="admin-auth-form">
              <div className="admin-field">
                <label>Chế độ cập nhật</label>
                <select
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value as 'replace' | 'append')}
                >
                  <option value="replace">Ghi đè dải frame (Thay thế từ vị trí frame X)</option>
                  <option value="append">Thêm hàng mới vào cuối Sprite Sheet</option>
                </select>
              </div>

              {uploadMode === 'replace' && (
                <div className="admin-field">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <label>Vị trí bắt đầu ghi đè (start frame)</label>
                    {activeSheet && sheetImage && (
                      <button
                        type="button"
                        className="stage-tool-btn"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => handleDownloadSingleFrame(uploadStartFrame)}
                        title="Tải frame hiện tại về máy để mở trong phần mềm vẽ làm mẫu"
                      >
                        <Download size={12} /> Tải frame #{uploadStartFrame} làm mẫu
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={(activeSheet?.frames ?? 60) - 1}
                    value={uploadStartFrame}
                    onChange={(e) => setUploadStartFrame(Number(e.target.value))}
                    required
                  />
                </div>
              )}

              <div className="admin-field">
                <label>Gán dải frame mới này cho Animation</label>
                <select
                  value={uploadAssignAnim}
                  onChange={(e) => setUploadAssignAnim(e.target.value as AnimationName)}
                >
                  <option value="">-- Không gán tự động --</option>
                  {(Object.keys(ANIMATION_LABELS) as AnimationName[]).map((anim) => (
                    <option key={anim} value={anim}>
                      {ANIMATION_LABELS[anim].vi} ({anim})
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label>Chọn file ảnh PNG dải ngang</label>
                <input
                  type="file"
                  accept="image/png,image/webp"
                  onChange={handleFileSelect}
                  required
                />
              </div>

              {uploadImageData && (
                <div
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    padding: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#38bdf8' }}>
                    Đã nhận diện: <strong>{uploadFrameCount} frames</strong>
                  </span>
                  <div
                    style={{
                      maxHeight: 120,
                      overflow: 'auto',
                      marginTop: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                    }}
                  >
                    <img
                      src={uploadImageData}
                      alt="Xem trước frame"
                      style={{ height: 80, objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              <div className="btn-row" style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  style={{ flex: 1 }}
                  disabled={uploading || !uploadImageData}
                >
                  {uploading ? 'Đang lưu vào Sprite Sheet...' : 'Xác Nhận Tải Lên & Cập Nhật'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setUploadOpen(false)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
