import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, Maximize2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';

interface Props {
  orderId: string;
  photos: string[];
  addedBy?: string;
  addedAt?: string;
  canDelete: boolean;
  onDelete: (index: number) => Promise<void> | void;
}

export default function ServiceOrderPhotoGallery({ orderId, photos, addedBy, addedAt, canDelete, onDelete }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStart = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const close = () => { setActive(null); setZoom(1); setPan({ x: 0, y: 0 }); };
  const move = (direction: number) => { setPan({ x: 0, y: 0 }); setZoom(1); setActive(current => current === null ? null : (current + direction + photos.length) % photos.length); };

  useEffect(() => {
    if (active === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(4, value + .25));
      if (event.key === '-') setZoom(value => Math.max(.5, value - .25));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, photos.length]);

  if (!photos.length) return <div className="md:col-span-4 py-8 text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-surface-container-high"><p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nenhuma foto registrada.</p></div>;
  const current = active === null ? null : photos[active];

  return <>
    {photos.map((photo, index) => <button type="button" key={`${photo}-${index}`} onClick={() => { setActive(index); setLoading(true); setZoom(1); setPan({ x: 0, y: 0 }); }} className="relative aspect-video rounded-2xl overflow-hidden border border-surface-container-high group cursor-zoom-in bg-surface-container-high text-left">
      {failed[index] ? <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-[10px] font-bold text-error">Não foi possível carregar esta imagem.</span> : <img src={photo} alt={`Foto ${index + 1} da OS`} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(event) => { setFailed(value => ({ ...value, [index]: true })); console.error('[SERVICE ORDER PHOTO ERROR]', { orderId, photoId: index, storagePath: photo, error: event.type }); }} />}
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"><Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} /></span>
    </button>)}

    {active !== null && current && <div ref={viewerRef} className="fixed inset-0 z-[350] bg-black/95 flex flex-col" onMouseDown={event => { if (event.target === event.currentTarget) close(); }} onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { if (touchStart.current === null) return; const delta=(event.changedTouches[0]?.clientX || 0)-touchStart.current; if(Math.abs(delta)>60) move(delta>0?-1:1); touchStart.current=null; }}>
      <div className="flex items-center justify-between gap-3 p-3 text-white bg-black/50">
        <div><p className="text-sm font-bold">Foto {active + 1} de {photos.length}</p><p className="text-[10px] text-white/60">{addedBy || 'Responsável não informado'} · {addedAt ? new Date(addedAt).toLocaleString('pt-BR') : 'Data não informada'}</p></div>
        <div className="flex items-center gap-1">
          <button type="button" title="Reduzir" onClick={() => setZoom(value => Math.max(.5, value - .25))} className="p-2 hover:bg-white/10 rounded-full"><Minus size={18}/></button>
          <button type="button" title="Restaurar" onClick={() => setZoom(1)} className="p-2 hover:bg-white/10 rounded-full"><RotateCcw size={18}/></button>
          <button type="button" title="Ampliar" onClick={() => setZoom(value => Math.min(4, value + .25))} className="p-2 hover:bg-white/10 rounded-full"><Plus size={18}/></button>
          <button type="button" title="Tela cheia" onClick={() => viewerRef.current?.requestFullscreen?.()} className="p-2 hover:bg-white/10 rounded-full"><Expand size={18}/></button>
          <a href={current} download={`OS-${orderId}-foto-${active + 1}`} target="_blank" rel="noreferrer" title="Baixar" className="p-2 hover:bg-white/10 rounded-full"><Download size={18}/></a>
          {canDelete && <button type="button" title="Excluir" onClick={async () => { if (!confirm('Deseja realmente excluir esta foto da Ordem de Serviço?')) return; await onDelete(active); if (photos.length <= 1) close(); else setActive(Math.min(active, photos.length - 2)); }} className="p-2 hover:bg-red-500/30 text-red-300 rounded-full"><Trash2 size={18}/></button>}
          <button type="button" title="Fechar" onClick={close} className="p-2 hover:bg-white/10 rounded-full"><X size={22}/></button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 overflow-auto flex items-center justify-center" onWheel={event => { event.preventDefault(); setZoom(value => Math.max(.5, Math.min(4, value + (event.deltaY < 0 ? .15 : -.15)))); }}>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-white text-sm">Carregando imagem...</div>}
        {!failed[active] && <img src={current} alt={`Foto ampliada ${active + 1}`} draggable={false} onPointerDown={event => { if (zoom <= 1) return; event.currentTarget.setPointerCapture(event.pointerId); dragStart.current={x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y}; }} onPointerMove={event => { if (!dragStart.current) return; setPan({x:dragStart.current.panX+event.clientX-dragStart.current.x,y:dragStart.current.panY+event.clientY-dragStart.current.y}); }} onPointerUp={() => { dragStart.current=null; }} onLoad={() => setLoading(false)} onError={(event) => { setLoading(false); setFailed(value => ({ ...value, [active]: true })); console.error('[SERVICE ORDER PHOTO ERROR]', { orderId, photoId: active, storagePath: current, error: event.type }); }} className="max-w-[92vw] max-h-[82vh] object-contain select-none cursor-grab active:cursor-grabbing" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, touchAction: zoom > 1 ? 'none' : 'pan-x pan-y pinch-zoom' }} />}
        {failed[active] && <p className="text-white">Não foi possível carregar esta imagem.</p>}
        {photos.length > 1 && <><button type="button" aria-label="Foto anterior" onClick={() => move(-1)} className="fixed left-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full"><ChevronLeft size={28}/></button><button type="button" aria-label="Próxima foto" onClick={() => move(1)} className="fixed right-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full"><ChevronRight size={28}/></button></>}
      </div>
    </div>}
  </>;
}
