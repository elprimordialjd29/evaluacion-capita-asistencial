import { ServiceTypeMeta, RipsRecord, UserRecord } from '../types';
import { CloudStorage } from './supabaseClient';

const KEYS = {
  METAS: 'rips_dashboard_metas',
  REGISTROS: 'rips_dashboard_registros',
  USUARIOS: 'rips_dashboard_usuarios',
  SCALE: 'rips_dashboard_scale'
};

// Guarda en localStorage Y Supabase
const saveCloud = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
  CloudStorage.set(key, value); // async, fire-and-forget
};

// Lee de Supabase primero, cae a localStorage
const loadCloud = async (key: string): Promise<any | null> => {
  const cloud = await CloudStorage.get(key);
  if (cloud !== null) {
    localStorage.setItem(key, JSON.stringify(cloud)); // actualizar cache local
    return cloud;
  }
  const local = localStorage.getItem(key);
  return local ? JSON.parse(local) : null;
};

export const StorageService = {
  saveConfig: async (metas: ServiceTypeMeta[], scale: number) => {
    saveCloud(KEYS.METAS, metas);
    saveCloud(KEYS.SCALE, scale);
  },

  getConfig: async (): Promise<{ metas: ServiceTypeMeta[], scale: number } | null> => {
    const [metas, scale] = await Promise.all([
      loadCloud(KEYS.METAS),
      loadCloud(KEYS.SCALE)
    ]);
    if (metas || scale) {
      return { metas: metas || [], scale: scale ? Number(scale) : 1 };
    }
    return null;
  },

  saveSessionData: async (registros: RipsRecord[], usuarios: UserRecord[]): Promise<boolean> => {
    try {
      saveCloud(KEYS.REGISTROS, registros);
      saveCloud(KEYS.USUARIOS, usuarios);
      return true;
    } catch {
      return false;
    }
  },

  loadSessionData: async (): Promise<{ registros: RipsRecord[], usuarios: UserRecord[] } | null> => {
    const [registros, usuarios] = await Promise.all([
      loadCloud(KEYS.REGISTROS),
      loadCloud(KEYS.USUARIOS)
    ]);
    if (registros && registros.length > 0) {
      return { registros, usuarios: usuarios || [] };
    }
    return null;
  },

  clearData: async () => {
    localStorage.removeItem(KEYS.REGISTROS);
    localStorage.removeItem(KEYS.USUARIOS);
    await Promise.all([
      CloudStorage.set(KEYS.REGISTROS, []),
      CloudStorage.set(KEYS.USUARIOS, [])
    ]);
  }
};
