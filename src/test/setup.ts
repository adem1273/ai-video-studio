// Test setup for AI Video Studio
import '@testing-library/jdom';
import { errorHandler } from '@/lib/errorHandler';

// Mock Supabase for tests
const mockSupabase = {
  from: () => ({
    select: () => ({ data: [], error: null, eq: () => ({}), single: () => ({}), insert: () => ({}), update: () => ({)}),
    rpc: () => ({}),
  }),
};

// Mock IndexedDB for Dexie tests
global.indexedDB = {
  createObjectStore: () => ({}),
  createDatabase: () => ({}),
  deleteDatabase: () => ({}),
  cmp: (a: any, b: any) => a === b ? 0 : 1,
  add: () => Promise.resolve(),
  get: () => Promise.resolve(),
  delete: () => Promise.resolve(),
  open: () => ({ onupgradeneeded: () => {}, onversionchange: () => {}, promise: Promise.resolve({ result: null }) }),
};
