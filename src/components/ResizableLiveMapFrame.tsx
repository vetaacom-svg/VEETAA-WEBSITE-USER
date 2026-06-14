/**
 * **Grand cadre** Live map = ce composant seul (`ResizableLiveMapFrame`) : carte + barres + poignées dans un bloc flex vertical.
 *
 * Page : `src/views/AdminLiveMap.tsx` · route : `/admin/carte-live`
 */
import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { GripHorizontal } from 'lucide-react';
import { safeGetItem, safeSetItem } from '../lib/storage';

/** Hauteur courante du cadre (px) — pour `map.invalidateSize()` dans la zone carte */
export const LiveMapFrameHeightContext = createContext<number>(560);

export function useLiveMapFrameHeight(): number {
  return useContext(LiveMapFrameHeightContext);
}

const DEFAULT_STORAGE = 'veetaa_live_map_frame_height_px';

type Props = {
  /** Barre du haut (onglets, filtres) — hauteur fixe */
  top: React.ReactNode;
  /** Zone carte : sera dans un conteneur `flex-1 min-h-0` (doit remplir la hauteur) */
  map: React.ReactNode;
  /** Sous la poignée TIRER (légende, texte) */
  bottom: React.ReactNode;
  className?: string;
  defaultHeightPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  /** Défaut true : pas de plafond viewport, tirer agrandit le cadre (scroll page). `false` → max ~96vh */
  unboundedVerticalResize?: boolean;
  storageKey?: string;
  gripLabel?: string;
  /** Deuxième poignée sous la légende (même action : hauteur du cadre entier) */
  showBottomResizeGrip?: boolean;
  /** Sous la légende : boutons + poignée large « illimité » (défaut si bas visible + mode illimité) */
  showBottomExpandControls?: boolean;
  /** Texte court sur la grande poignée du bas */
  bottomGripTitle?: string;
  bottomGripHint?: string;
};

const TECHNICAL_MAX_PX = 50_000;

/**
 * Bloc arrondi unique : header + carte (flex) + poignée(s) TIRER + pied (légende).
 * La hauteur du **cadre entier** suit `heightPx` ; la carte occupe l’espace restant (`flex-1 min-h-0`).
 */
export function ResizableLiveMapFrame({
  top,
  map,
  bottom,
  className = '',
  defaultHeightPx = 560,
  minHeightPx = 380,
  maxHeightPx,
  unboundedVerticalResize = true,
  storageKey = DEFAULT_STORAGE,
  gripLabel = 'TIRER',
  showBottomResizeGrip = true,
  showBottomExpandControls,
  bottomGripTitle = 'TIRER VERS LE BAS',
  bottomGripHint = 'Hauteur quasi illimitée — faites défiler la page',
}: Props) {
  const expandControls =
    showBottomExpandControls ?? (showBottomResizeGrip && unboundedVerticalResize);
  const getMaxH = useCallback(() => {
    if (unboundedVerticalResize) return maxHeightPx ?? TECHNICAL_MAX_PX;
    return maxHeightPx ?? Math.min(Math.round(typeof window !== 'undefined' ? window.innerHeight * 0.92 : 900), 960);
  }, [unboundedVerticalResize, maxHeightPx]);

  const readInitial = () => {
    if (typeof window === 'undefined') return defaultHeightPx;
    const raw = safeGetItem(storageKey);
    const n = raw ? parseInt(raw, 10) : NaN;
    const mx = unboundedVerticalResize ? maxHeightPx ?? TECHNICAL_MAX_PX : getMaxH();
    if (Number.isFinite(n) && n >= minHeightPx && n <= mx) return n;
    return defaultHeightPx;
  };

  const [heightPx, setHeightPx] = useState(readInitial);
  const heightRef = useRef(heightPx);
  heightRef.current = heightPx;

  useEffect(() => {
    if (unboundedVerticalResize) return;
    const onResize = () => {
      const mx = getMaxH();
      setHeightPx((h) => Math.min(h, mx));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [unboundedVerticalResize, getMaxH]);

  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    try {
      safeSetItem(storageKey, String(heightRef.current));
    } catch {
      /* private mode */
    }
  }, [storageKey]);

  const persistHeight = useCallback(
    (h: number) => {
      heightRef.current = h;
      try {
        safeSetItem(storageKey, String(h));
      } catch {
        /* */
      }
    },
    [storageKey]
  );

  const bumpHeight = useCallback(
    (delta: number) => {
      const mx = unboundedVerticalResize ? maxHeightPx ?? TECHNICAL_MAX_PX : maxHeightPx ?? Math.min(Math.round(window.innerHeight * 0.92), 960);
      setHeightPx((h) => {
        const next = Math.round(Math.min(Math.max(h + delta, minHeightPx), mx));
        persistHeight(next);
        return next;
      });
    },
    [minHeightPx, maxHeightPx, unboundedVerticalResize, persistHeight]
  );

  const expandToAtLeast = useCallback(
    (targetMin: number) => {
      const mx = unboundedVerticalResize ? maxHeightPx ?? TECHNICAL_MAX_PX : maxHeightPx ?? Math.min(Math.round(window.innerHeight * 0.92), 960);
      setHeightPx((h) => {
        const next = Math.round(Math.min(Math.max(Math.max(h, targetMin), minHeightPx), mx));
        persistHeight(next);
        return next;
      });
    },
    [minHeightPx, maxHeightPx, unboundedVerticalResize, persistHeight]
  );

  const onGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = e.pointerId;
      const el = e.currentTarget;
      dragRef.current = { startY: e.clientY, startH: heightRef.current };
      try {
        el.setPointerCapture(pid);
      } catch {
        /* */
      }

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        ev.preventDefault();
        const dy = ev.clientY - d.startY;
        const mx = unboundedVerticalResize ? maxHeightPx ?? TECHNICAL_MAX_PX : maxHeightPx ?? Math.min(Math.round(window.innerHeight * 0.92), 960);
        const next = Math.round(Math.min(Math.max(d.startH + dy, minHeightPx), mx));
        setHeightPx(next);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        try {
          el.releasePointerCapture(pid);
        } catch {
          /* */
        }
        endDrag();
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [minHeightPx, maxHeightPx, unboundedVerticalResize, endDrag]
  );

  const rootStyle: React.CSSProperties = unboundedVerticalResize
    ? {
        height: heightPx,
        minHeight: minHeightPx,
        maxHeight: 'none',
      }
    : {
        height: heightPx,
        minHeight: minHeightPx,
        maxHeight: '96vh',
      };

  return (
    <LiveMapFrameHeightContext.Provider value={heightPx}>
    <div
      data-veetaa-live-map-frame-root
      className={[
        /* flexible dans le parent : largeur fluide, peut rétrécir en flex (min-w-0 / min-h-0) */
        'flex w-full min-w-0 min-h-0 flex-col box-border',
        'rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-xl',
        'overflow-hidden',
        unboundedVerticalResize ? 'max-h-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
    >
      <div className="shrink-0 w-full min-w-0">{top}</div>
      <div
        data-veetaa-live-map-slot
        className="relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden"
      >
        {map}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={`${gripLabel} — entre carte et légende`}
        onPointerDown={onGripPointerDown}
        className="shrink-0 z-10 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-row-resize select-none touch-none bg-amber-50/90 border-y border-amber-200/80 hover:bg-amber-100/90 active:bg-amber-100"
        style={{ touchAction: 'none' }}
      >
        <GripHorizontal className="w-9 h-4 text-amber-700/70" strokeWidth={2.5} aria-hidden />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900/80">{gripLabel}</span>
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white">{bottom}</div>

      {showBottomResizeGrip ? (
        <div className="shrink-0 z-10 rounded-b-3xl border-t-2 border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          {expandControls ? (
            <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2.5 border-b border-amber-300/60">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-950/70 w-full text-center sm:w-auto sm:text-left">
                Agrandir vite
              </span>
              <button
                type="button"
                className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm border border-amber-300 hover:bg-amber-50 active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  bumpHeight(600);
                }}
              >
                +600 px
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm border border-amber-300 hover:bg-amber-50 active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  bumpHeight(1500);
                }}
              >
                +1500 px
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm border border-amber-700 hover:bg-amber-500 active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
                  expandToAtLeast(Math.round(vh * 2.1));
                }}
              >
                2× la fenêtre
              </button>
            </div>
          ) : null}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={`${bottomGripTitle} — tirer vers le bas, hauteur libre`}
            onPointerDown={onGripPointerDown}
            className="flex flex-col items-center justify-center gap-1 py-5 min-h-[4.5rem] cursor-row-resize select-none touch-none hover:from-amber-100 hover:to-amber-100/95 active:bg-amber-200/40"
            style={{ touchAction: 'none' }}
          >
            <GripHorizontal className="w-12 h-5 text-amber-800" strokeWidth={2.75} aria-hidden />
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-950">{bottomGripTitle}</span>
            <span className="text-[10px] font-semibold text-amber-900/75 text-center px-4 max-w-md leading-snug">
              {bottomGripHint}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-800/60 mt-0.5">
              max. ~50 000 px — {gripLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
    </LiveMapFrameHeightContext.Provider>
  );
}
