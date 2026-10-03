import { supabase } from './supabase';
export const avg = rs => (rs?.length ? (rs.reduce((a, r) => a + r.rating, 0) / rs.length).toFixed(1) : '–');
export const toast = (m, bad) => window.dispatchEvent(new CustomEvent('toast', { detail: { m, bad } }));
export const sortEps = a => [...a].sort((x, y) => x.season_number - y.season_number || x.episode_number - y.episode_number);
export const lab = e => `S${e.season_number}·E${e.episode_number}`;
export const act = async (p, ok) => { const { error } = await p; if (error) toast(error.message, true); else if (ok) toast(ok); return !error; };
export const IMPORT_EMAIL = 'hunkclement@gmail.com';
export async function uploadImage(bucket, uid, file, max = 600) {
  try {
    const bmp = await createImageBitmap(file); const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
    const path = `${uid}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) { toast(error.message, true); return null; }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch { toast('Could not read that image', true); return null; }
}
export const removeImage = (bucket, url) => {
  const i = url ? url.indexOf(`/${bucket}/`) : -1;
  if (i > 0) supabase.storage.from(bucket).remove([url.slice(i + bucket.length + 2)]);
};
