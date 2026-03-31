const SUPABASE_URL = 'https://wczamyidhyqwtxvjgwgu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tAqk5QkAKpZg-3WkjN4VwQ_Kli028NL';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export const CloudStorage = {
  async get(key: string): Promise<any> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=value`,
        { headers }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0]?.value ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any): Promise<void> {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_storage`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
      });
    } catch (e) {
      console.warn('CloudStorage.set failed', e);
    }
  },

  async getAll(keys: string[]): Promise<Record<string, any>> {
    try {
      const keysParam = keys.map(k => `"${k}"`).join(',');
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_storage?key=in.(${keysParam})&select=key,value`,
        { headers }
      );
      if (!res.ok) return {};
      const data: { key: string; value: any }[] = await res.json();
      return Object.fromEntries(data.map(r => [r.key, r.value]));
    } catch {
      return {};
    }
  }
};
