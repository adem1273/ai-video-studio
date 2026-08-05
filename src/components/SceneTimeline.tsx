import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Film, Copy, Trash2, Clock, Pencil, Check, X, AlertCircle, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import type { Scene, AgentLogEntry } from '@/lib/types';

type Props = {
  scenes: Scene[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onReorder: (scenes: Scene[]) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onRename: (index: number, name: string) => void;
  onDurationChange: (index: number, duration: number) => void;
};

export function SceneTimeline({
  scenes,
  selectedIndex,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onRename,
  onDurationChange,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = scenes.findIndex((s) => s.id === active.id);
    const newIndex = scenes.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(scenes, oldIndex, newIndex));
  };

  if (scenes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        Henüz sahne yok. Senaryo oluşturduğunuzda sahneler burada görünür.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={scenes.map((s) => s.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {scenes.map((scene, i) => (
            <SortableSceneCard
              key={scene.id}
              scene={scene}
              index={i}
              isSelected={i === selectedIndex}
              onSelect={() => onSelect(i)}
              onDuplicate={() => onDuplicate(i)}
              onDelete={() => onDelete(i)}
              onRename={(name) => onRename(i, name)}
              onDurationChange={(d) => onDurationChange(i, d)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

type CardProps = {
  scene: Scene;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onDurationChange: (duration: number) => void;
};

function SortableSceneCard({
  scene,
  index,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
  onDurationChange,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(scene.name ?? '');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  const commitName = () => {
    onRename(nameDraft.trim() || `Sahne ${index + 1}`);
    setEditingName(false);
  };

  const cancelName = () => {
    setNameDraft(scene.name ?? '');
    setEditingName(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative shrink-0 w-44 rounded-xl border-2 transition group ${
        isSelected
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
      }`}
    >
      {/* Drag handle + thumbnail */}
      <div
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className="relative h-20 rounded-t-lg overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {scene.image_url ? (
          <img
            src={scene.image_url}
            alt=""
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : scene.video_poster ? (
          <img
            src={scene.video_poster}
            alt=""
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <Film size={18} className="text-slate-600" />
          </div>
        )}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
          {index + 1}
        </div>
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-0.5">
          <Clock size={9} /> {scene.duration}s
        </div>
        {scene.mediaError && (
          <div
            className="absolute top-1 right-1 p-0.5 rounded bg-red-500/90 text-white"
            title={scene.mediaError}
          >
            <AlertCircle size={11} />
          </div>
        )}
      </div>

      {/* Name / rename */}
      <div className="px-2 py-1.5 border-t border-slate-800">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') cancelName();
              }}
              className="flex-1 min-w-0 rounded bg-slate-950 border border-slate-700 px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={commitName}
              className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/10"
            >
              <Check size={12} />
            </button>
            <button
              onClick={cancelName}
              className="p-0.5 rounded text-slate-400 hover:bg-slate-800"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <span
              className="text-xs text-slate-300 truncate flex-1"
              title={scene.name ?? `Sahne ${index + 1}`}
            >
              {scene.name ?? `Sahne ${index + 1}`}
            </span>
            <button
              onClick={() => {
                setNameDraft(scene.name ?? `Sahne ${index + 1}`);
                setEditingName(true);
              }}
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition"
              title="Yeniden adlandır"
            >
              <Pencil size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 pb-2">
        <button
          onClick={onDuplicate}
          className="p-1 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
          title="Sahneyi kopyala"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          title="Sahneyi sil"
        >
          <Trash2 size={12} />
        </button>
        <div className="flex-1" />
        <input
          type="number"
          min={1}
          max={60}
          value={scene.duration}
          onChange={(e) => onDurationChange(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
          className="w-12 rounded-md bg-slate-950 border border-slate-800 px-1 py-0.5 text-[11px] text-slate-200 text-center focus:outline-none focus:border-slate-600"
          title="Süre (saniye)"
        />
        <span className="text-[10px] text-slate-500">sn</span>
      </div>

      {/* Agent Decision Log */}
      {scene.agentLogs && scene.agentLogs.length > 0 && (
        <AgentLogPanel logs={scene.agentLogs} />
      )}
    </div>
  );
}

function AgentLogPanel({ logs }: { logs: AgentLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  const actionLabels: Record<string, string> = {
    thinking: 'Düşünüyor',
    search: 'Arama',
    results: 'Sonuçlar',
    selected: 'Seçildi',
    fallback: 'AI Video',
    blocked: 'Engellendi',
    error: 'Hata',
    force_fallback: 'Zorunlu Fallback',
    select_failed: 'Seçim Başarısız',
  };

  const actionColors: Record<string, string> = {
    thinking: 'text-slate-400',
    search: 'text-blue-400',
    results: 'text-cyan-400',
    selected: 'text-emerald-400',
    fallback: 'text-amber-400',
    blocked: 'text-red-400',
    error: 'text-red-500',
    force_fallback: 'text-amber-500',
    select_failed: 'text-red-400',
  };

  return (
    <div className="border-t border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition"
      >
        <Bot size={11} className="text-violet-400" />
        <span className="font-medium">Ajan Kararı</span>
        <span className="text-slate-600">({logs.length})</span>
        <div className="flex-1" />
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
          {logs.map((log, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px]">
              <span className={`shrink-0 font-medium ${actionColors[log.action] ?? 'text-slate-400'}`}>
                {actionLabels[log.action] ?? log.action}
              </span>
              <span className="text-slate-500 break-all">{log.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
