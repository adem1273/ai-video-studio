import React from 'react';

// src/components/StockAgentModal.tsx
// Simple modal that shows logs and top candidates for user approval

type Clip = {
  id: string;
  source: string;
  title?: string;
  thumbnail_url?: string;
  duration?: number;
};

export function StockAgentModal({
  logs,
  candidates,
  onSelect,
  onClose,
}: {
  logs: string[];
  candidates: Clip[];
  onSelect: (clip: Clip) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ padding: 16 }}>
      <h3>Otomatik Klip Seçici</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h4>Logs</h4>
          <div style={{ maxHeight: 300, overflow: 'auto', background: '#111', color: '#fff', padding: 8 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>{l}</div>
            ))}
          </div>
        </div>
        <div style={{ width: 420 }}>
          <h4>Top Adaylar</h4>
          {candidates.map(c => (
            <div key={`${c.source}:${c.id}`} style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #ddd' }}>
              <img src={c.thumbnail_url} alt="thumb" style={{ width: 120, height: 68, objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.title || c.id}</div>
                <div style={{ fontSize: 12 }}>{c.source} • {c.duration}s</div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => onSelect(c)} style={{ marginRight: 8 }}>Seç</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={onClose}>Kapat</button>
      </div>
    </div>
  );
}
