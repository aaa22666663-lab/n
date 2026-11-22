import React, { useEffect, useRef, useState } from 'react';
import {
  CUSTOM_DESIGN_COST,
  CustomDesign,
  DesignTarget,
  PatternType,
  SaveDesignInput,
} from '../game/config';
import { renderPatternToCanvas } from '../game/weaponSystem';

interface StudioModalProps {
  cp: number;
  ownedDesigns: CustomDesign[];
  onClose: () => void;
  onSaveDesign: (input: SaveDesignInput) => { ok: boolean; errorAr?: string; costPaid: number; design?: CustomDesign };
  onGrantTestCp: () => void;
}

const SWATCHES = ['#2563eb', '#dc2626', '#f59e0b', '#10b981', '#7c3aed', '#0f172a', '#f8fafc', '#ec4899'];
const PATTERNS: Array<{ id: PatternType; labelAr: string }> = [
  { id: 'none', labelAr: 'لون صافي' },
  { id: 'stripes', labelAr: 'خطوط مائلة' },
  { id: 'camo', labelAr: 'تمويه قتالي' },
  { id: 'checker', labelAr: 'مربعات' },
  { id: 'stars', labelAr: 'نجوم' },
];

export const StudioModal: React.FC<StudioModalProps> = ({
  cp,
  ownedDesigns,
  onClose,
  onSaveDesign,
  onGrantTestCp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('تصميم النخبة');
  const [target, setTarget] = useState<DesignTarget>('skin');
  const [baseColor, setBaseColor] = useState('#2563eb');
  const [accentColor, setAccentColor] = useState('#facc15');
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [pattern, setPattern] = useState<PatternType>('stripes');
  const [emblemText, setEmblemText] = useState('قائد');
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  const isFreeReEdit = Boolean(editingId && ownedDesigns.some((d) => d.id === editingId));
  const currentCost = isFreeReEdit ? 0 : CUSTOM_DESIGN_COST;

  const paintTemplateOnCanvas = (
    bColor = baseColor,
    aColor = accentColor,
    pat = pattern,
    txt = emblemText
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderPatternToCanvas(ctx, canvas.width, canvas.height, bColor, aColor, pat, txt);
  };

  useEffect(() => {
    if (!editingId) {
      paintTemplateOnCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOwnedIntoEditor = (design: CustomDesign) => {
    setEditingId(design.id);
    setNameAr(design.nameAr);
    setTarget(design.target);
    setBaseColor(design.baseColor);
    setAccentColor(design.accentColor);
    setPattern(design.pattern);
    setEmblemText(design.emblemText);
    setFeedback({ text: `تم فتح "${design.nameAr}" للتعديل المجاني غير المحدود`, isError: false });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && design.canvasDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = design.canvasDataUrl;
    }
  };

  const startNewDesignMode = () => {
    setEditingId(null);
    setNameAr('تصميم مخصص جديد');
    setFeedback(null);
    paintTemplateOnCanvas();
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasCoords(e);
    lastPtRef.current = pt;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasCoords(e);
    const prev = lastPtRef.current || pt;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPtRef.current = null;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const result = onSaveDesign({
      existingDesignId: editingId,
      nameAr,
      target,
      baseColor,
      accentColor,
      pattern,
      emblemText,
      canvasDataUrl: dataUrl,
    });

    if (!result.ok) {
      setFeedback({ text: result.errorAr || 'رصيد CP غير كافٍ', isError: true });
      return;
    }

    if (result.design) {
      setEditingId(result.design.id);
    }

    setFeedback({
      text:
        result.costPaid > 0
          ? `تم إنشاء التصميم وتطبيقه بنجاح! (-${result.costPaid.toLocaleString('en-US')} CP)`
          : 'تم حفظ التعديلات مجاناً (0 CP) وتطبيق التصميم!',
      isError: false,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="استوديو التصميم المخصص"
      data-testid="studio-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto studio-scroll rounded-2xl border border-slate-700 bg-slate-900 p-5 md:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">استوديو التصميم المخصص</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              إنشاء تصميم جديد يكلف <strong className="text-amber-400">20,000 CP</strong> • إعادة تعديل تصاميمك المملوكة{' '}
              <strong className="text-emerald-400">مجانية وبلا حدود</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-amber-400/40 bg-slate-950 px-3 py-1.5 text-sm font-black text-amber-400 tabular-nums">
              {cp.toLocaleString('en-US')} CP
            </div>
            <button
              type="button"
              data-testid="studio-grant-cp-btn"
              onClick={onGrantTestCp}
              className="cursor-pointer rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/35"
            >
              +20,000 CP تجربة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Body Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left/Right: Canvas Draw Surface + Owned Designs */}
          <div className="md:col-span-5 flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs font-bold text-slate-300">ارسم بحرية بالماوس على النسيج (128×128)</div>
            <canvas
              ref={canvasRef}
              width={128}
              height={128}
              data-testid="studio-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="h-52 w-52 cursor-crosshair rounded-xl border-2 border-slate-600 shadow-lg touch-none"
              style={{ imageRendering: 'pixelated' }}
            />

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>لون الفرشاة</span>
                <div className="flex items-center gap-1.5">
                  {SWATCHES.slice(0, 6).map((hex) => (
                    <button
                      key={`b_${hex}`}
                      type="button"
                      aria-label={`لون فرشاة ${hex}`}
                      onClick={() => setBrushColor(hex)}
                      className={`cursor-pointer h-5 w-5 rounded border ${
                        brushColor === hex ? 'border-white scale-110' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>حجم الفرشاة</span>
                <div className="flex gap-1.5">
                  {[3, 6, 11].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setBrushSize(sz)}
                      className={`cursor-pointer rounded px-2.5 py-0.5 text-[11px] font-bold ${
                        brushSize === sz ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Owned Designs List */}
            <div className="w-full border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-300">
                  التصاميم المملوكة ({ownedDesigns.length})
                </span>
                <button
                  type="button"
                  onClick={startNewDesignMode}
                  className="cursor-pointer rounded bg-slate-800 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-700"
                >
                  + تصميم جديد
                </button>
              </div>
              {ownedDesigns.length === 0 ? (
                <div className="text-[11px] text-slate-500">لا توجد تصاميم مخصصة بعد. أنشئ أول تصميم لك!</div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto studio-scroll">
                  {ownedDesigns.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => loadOwnedIntoEditor(d)}
                      className={`cursor-pointer flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-right text-xs ${
                        editingId === d.id
                          ? 'border-emerald-400 bg-emerald-500/20 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <span className="font-bold truncate">{d.nameAr}</span>
                      <span className="text-[10px] font-bold text-emerald-400">تعديل مجاني</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controls & Templates */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="studio-design-name" className="block text-xs font-bold text-slate-300 mb-1">
                    اسم التصميم
                  </label>
                  <input
                    id="studio-design-name"
                    type="text"
                    value={nameAr}
                    maxLength={24}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-300 mb-1">نوع التصميم</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTarget('skin')}
                      className={`cursor-pointer rounded-lg border py-2 text-xs font-bold ${
                        target === 'skin'
                          ? 'border-sky-400 bg-sky-500/25 text-white'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      مظهر الشخصية
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarget('weapon')}
                      className={`cursor-pointer rounded-lg border py-2 text-xs font-bold ${
                        target === 'weapon'
                          ? 'border-sky-400 bg-sky-500/25 text-white'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      طلاء السلاح
                    </button>
                  </div>
                </div>
              </div>

              {/* Base & Accent Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="studio-base-color" className="block text-xs font-bold text-slate-300 mb-1">
                    اللون الأساسي
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SWATCHES.map((hex) => (
                      <button
                        key={`base_${hex}`}
                        type="button"
                        aria-label={`لون أساسي ${hex}`}
                        onClick={() => {
                          setBaseColor(hex);
                          paintTemplateOnCanvas(hex, accentColor, pattern, emblemText);
                        }}
                        className={`cursor-pointer h-6 w-6 rounded border ${
                          baseColor === hex ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                    <input
                      id="studio-base-color"
                      type="color"
                      value={baseColor}
                      onChange={(e) => {
                        setBaseColor(e.target.value);
                        paintTemplateOnCanvas(e.target.value, accentColor, pattern, emblemText);
                      }}
                      className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="studio-accent-color" className="block text-xs font-bold text-slate-300 mb-1">
                    لون النقش الثانوي
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SWATCHES.map((hex) => (
                      <button
                        key={`acc_${hex}`}
                        type="button"
                        aria-label={`لون ثانوي ${hex}`}
                        onClick={() => {
                          setAccentColor(hex);
                          paintTemplateOnCanvas(baseColor, hex, pattern, emblemText);
                        }}
                        className={`cursor-pointer h-6 w-6 rounded border ${
                          accentColor === hex ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                    <input
                      id="studio-accent-color"
                      type="color"
                      value={accentColor}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        paintTemplateOnCanvas(baseColor, e.target.value, pattern, emblemText);
                      }}
                      className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Patterns */}
              <div>
                <span className="block text-xs font-bold text-slate-300 mb-1.5">النمط الهندسي</span>
                <div className="flex flex-wrap gap-2">
                  {PATTERNS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPattern(p.id);
                        paintTemplateOnCanvas(baseColor, accentColor, p.id, emblemText);
                      }}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        pattern === p.id
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      {p.labelAr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emblem Text */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="studio-emblem-text" className="block text-xs font-bold text-slate-300 mb-1">
                    نص أو شعار مختصر على التصميم
                  </label>
                  <input
                    id="studio-emblem-text"
                    type="text"
                    maxLength={8}
                    value={emblemText}
                    onChange={(e) => {
                      setEmblemText(e.target.value);
                      paintTemplateOnCanvas(baseColor, accentColor, pattern, e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => paintTemplateOnCanvas()}
                  className="cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  إعادة تطبيق القالب
                </button>
              </div>
            </div>

            {/* Feedback & Primary Save Action */}
            <div className="space-y-3 border-t border-slate-800 pt-3">
              {feedback && (
                <div
                  data-testid="studio-feedback"
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                    feedback.isError
                      ? 'border-rose-500/60 bg-rose-950/70 text-rose-200'
                      : 'border-emerald-500/60 bg-emerald-950/70 text-emerald-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-300">
                  {isFreeReEdit ? (
                    <span className="text-emerald-400">وضع إعادة التعديل: مجاني تماماً (0 CP)</span>
                  ) : (
                    <span className="text-amber-300">إنشاء تصميم جديد: 20,000 CP</span>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="studio-save-btn"
                  onClick={handleSave}
                  className={`cursor-pointer rounded-xl px-6 py-2.5 text-sm font-black shadow-lg transition-colors ${
                    isFreeReEdit
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {isFreeReEdit
                    ? 'حفظ التعديلات (مجاني 0 CP)'
                    : `إنشاء وتطبيق (${currentCost.toLocaleString('en-US')} CP)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
