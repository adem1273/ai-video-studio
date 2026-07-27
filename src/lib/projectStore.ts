import Dexie, { type Table } from 'dexie';
import type { VideoProject, Scene, ProjectSettings, ThumbnailStyle } from './types';

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

class ProjectDB extends Dexie {
  projects!: Table<SavedProject, string>;

  constructor() {
    super('montaj-projects');
    this.version(1).stores({
      projects: 'id, updated_at, title',
    });
  }
}

const db = new ProjectDB();

export function emptyProject(): SavedProject {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '',
    prompt: '',
    status: 'draft',
    scenes: [],
    settings: {
      voice: '',
      ttsVoice: 'alloy',
      ttsMode: 'pollinations',
      rate: 1,
      style: 'cinematic',
      aspect: '16:9',
      resolution: '720p',
      music: 'cinematic',
      mediaSource: 'auto',
      musicVolume: 0.5,
      transition: 'fade',
      showTitleCard: true,
      exportFormat: 'webm',
      subtitleStyle: 'standard',
      subtitleColor: 'white',
      endCard: { enabled: false, text: '', duration: 3, fontColor: 'gold' },
      brand: { enabled: false, primaryColor: '#3b82f6', fontFamily: 'sans-serif' },
    },
    youtube_title: null,
    youtube_description: null,
    youtube_tags: null,
    thumbnail_url: null,
    thumbnail_style: 'bold',
    is_published: false,
    video_blob_url: null,
    updated_at: now,
    created_at: now,
  };
}

export async function saveProjectLocal(p: SavedProject): Promise<void> {
  await db.projects.put({ ...p, updated_at: Date.now() });
}

export async function getLatestProject(): Promise<SavedProject | undefined> {
  const all = await db.projects.orderBy('updated_at').reverse().toArray();
  return all[0];
}

export async function getAllProjectsLocal(): Promise<SavedProject[]> {
  const all = await db.projects.orderBy('updated_at').reverse().toArray();
  return all;
}

export async function deleteProjectLocal(id: string): Promise<void> {
  await db.projects.delete(id);
}

export { db };
