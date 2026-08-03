import Dexie, { type Table } from 'dexie';
import type { VideoProject, Scene, ProjectSettings, ThumbnailStyle } from './types';
import { supabase } from './supabase';

export type SavedProject = {
  id: string;
  title: string;
  prompt: string;
  status: VideoProject['status'];
  scenes: Scene[];
  settings: ProjectSettings;
  youtube_title: string | null;
  youtube_description: string | null;
  youtube_tags: string[] | null;
  thumbnail_url: string | null;
  thumbnail_style: ThumbnailStyle;
  is_published: boolean;
  video_blob_url: string | null;
  updated_at: number;
  created_at: number;
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'local-only' | 'conflict';

class ProjectDB extends Dexie {
  projects!: Table<SavedProject, string>;
  constructor() {
    super('montaj-projects');
    this.version(1).stores({ projects: 'id, updated_at, title' });
  }
}

const db = new ProjectDB();

export function emptyProject(): SavedProject {
  const now = Date.now();
  return {
    id: crypto.randomUUID(), title: '', prompt: '', status: 'draft', scenes: [],
    settings: { voice: '', ttsVoice: 'alloy', ttsMode: 'pollinations', rate: 1, style: 'cinematic', aspect: '16:9', resolution: '720p', music: 'cinematic', mediaSource: 'auto', musicVolume: 0.5, transition: 'fade', showTitleCard: true, exportFormat: 'webm', subtitleStyle: 'standard', subtitleColor: 'white', endCard: { enabled: false, text: '', duration: 3, fontColor: 'gold' }, brand: { enabled: false, primaryColor: '#3b82f6', fontFamily: 'sans-serif' } },
    youtube_title: null, youtube_description: null, youtube_tags: null, thumbnail_url: null, thumbnail_style: 'bold', is_published: false, video_blob_url: null, updated_at: now, created_at: now,
  };
}

export async function saveProjectLocal(p: SavedProject): Promise<void> { await db.projects.put({ ...p, updated_at: Date.now() }); }
export async function getLatestProject(): Promise<SavedProject | undefined> { const all = await db.projects.orderBy('updated_at').reverse().toArray(); return all[0]; }
export async function getAllProjectsLocal(): Promise<SavedProject[]> { const all = await db.projects.orderBy('updated_at').reverse().toArray(); return all; }
export async function deleteProjectLocal(id: string): Promise<void> { await db.projects.delete(id); }

type RemoteRow = {
  id: string; title: string; prompt: string; status: VideoProject['status']; script: Scene[] | null; settings: ProjectSettings | null; video_path: string | null;
  youtube_title: string | null; youtube_description: string | null; youtube_tags: string[] | null; thumbnail_url: string | null; thumbnail_style: ThumbnailStyle | null;
  category: string | null; is_published: boolean; published_at: string | null; created_at: string; updated_at: string;
};

function remoteToLocal(row: RemoteRow): SavedProject {
  return {
    id: row.id, title: row.title, prompt: row.prompt, status: row.status, scenes: row.script ?? [], settings: row.settings ?? emptyProject().settings,
    youtube_title: row.youtube_title, youtube_description: row.youtube_description, youtube_tags: row.youtube_tags, thumbnail_url: row.thumbnail_url, thumbnail_style: row.thumbnail_style ?? 'bold', is_published: row.is_published, video_blob_url: row.video_path,
    updated_at: new Date(row.updated_at).getTime(), created_at: new Date(row.created_at).getTime(),
  };
}

function localToRemote(p: SavedProject): Record<string, unknown> {
  return { id: p.id, title: p.title, prompt: p.prompt, status: p.status, script: p.scenes, settings: p.settings, video_path: p.video_blob_url, youtube_title: p.youtube_title, youtube_description: p.youtube_description, youtube_tags: p.youtube_tags, thumbnail_url: p.thumbnail_url, thumbnail_style: p.thumbnail_style, is_published: p.is_published };
}

export async function saveProjectRemote(p: SavedProject): Promise<void> {
  const payload = localToRemote(p);
  const { error } = await supabase.from('video_projects').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

export async function syncProjects(): Promise<{ projects: SavedProject[]; conflicts: string[] }> {
  const localProjects = await getAllProjectsLocal();
  const localMap = new Map(localProjects.map((p) => [p.id, p]));
  const { data: remoteRows, error } = await supabase.from('video_projects').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  const remoteProjects = (remoteRows as RemoteRow[] ?? []).map(remoteToLocal);
  const conflicts: string[] = [];
  const mergedMap = new Map<string, SavedProject>();
  for (const remote of remoteProjects) {
    const local = localMap.get(remote.id);
    if (local) {
      const remoteNewer = remote.updated_at > local.updated_at;
      const localNewer = local.updated_at > remote.updated_at;
      if (remoteNewer) { mergedMap.set(remote.id, remote); await saveProjectLocal(remote); }
      else if (localNewer) { mergedMap.set(local.id, local); await saveProjectRemote(local); }
      else { mergedMap.set(local.id, local); }
    } else { mergedMap.set(remote.id, remote); await saveProjectLocal(remote); }
  }
  for (const local of localProjects) {
    if (!mergedMap.has(local.id)) {
      const { error: upsertError } = await supabase.from('video_projects').upsert(localToRemote(local), { onConflict: 'id' });
      if (upsertError) conflicts.push(local.id);
      else mergedMap.set(local.id, local);
    }
  }
  const projects = Array.from(mergedMap.values()).sort((a, b) => b.updated_at - a.updated_at);
  return { projects, conflicts };
}

export { db };
