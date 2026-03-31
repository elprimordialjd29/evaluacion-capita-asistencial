import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wczamyidhyqwtxvjgwgu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tAqk5QkAKpZg-3WkjN4VwQ_Kli028NL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const CloudStorage = {
  async get(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', key)
        .single();
      if (error || !data) return null;
      return data.value;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any): Promise<void> {
    try {
      await supabase
        .from('app_storage')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) {
      console.warn('CloudStorage.set failed', e);
    }
  },

  async getAll(keys: string[]): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('app_storage')
        .select('key, value')
        .in('key', keys);
      if (error || !data) return {};
      return Object.fromEntries(data.map(r => [r.key, r.value]));
    } catch {
      return {};
    }
  }
};
