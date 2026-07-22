const SUPABASE_URL = 'https://wczamyidhyqwtxvjgwgu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tAqk5QkAKpZg-3WkjN4VwQ_Kli028NL';
const TABLE = 'almacenamiento_aplicacion';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Mapping from code keys to Supabase stored keys (legacy Spanish keys)
const KEY_MAP: Record<string, string> = {
  'appUsers':   'usuarios de aplicaciones',
  'customCups': 'tazas personalizadas',
};
const toSupabaseKey = (k: string) => KEY_MAP[k] ?? k;
const fromSupabaseKey = (k: string) => {
  const entry = Object.entries(KEY_MAP).find(([, v]) => v === k);
  return entry ? entry[0] : k;
};

export const CloudStorage = {
  async get(key: string): Promise<any> {
    try {
      const sk = toSupabaseKey(key);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?clave=eq.${encodeURIComponent(sk)}&select=valor`,
        { headers }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0]?.valor ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any): Promise<void> {
    try {
      const sk = toSupabaseKey(key);
      await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ clave: sk, valor: value, actualizado_at: new Date().toISOString() })
      });
    } catch (e) {
      console.warn('CloudStorage.set failed', e);
    }
  },

  async getAll(keys: string[]): Promise<Record<string, any>> {
    try {
      const supabaseKeys = keys.map(toSupabaseKey);
      const keysParam = supabaseKeys.map(k => `"${k}"`).join(',');
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?clave=in.(${keysParam})&select=clave,valor`,
        { headers }
      );
      if (!res.ok) return {};
      const data: { clave: string; valor: any }[] = await res.json();
      return Object.fromEntries(data.map(r => [fromSupabaseKey(r.clave), r.valor]));
    } catch {
      return {};
    }
  }
};
