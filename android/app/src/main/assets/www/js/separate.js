// Client for the stem-separation server (server/server.py). Separation uses Demucs, which is far
// too heavy to run inside the phone's web view, so it runs on a computer/server you control.
const hdr = (token) => (token ? { 'X-Token': token } : {});
const base = (u) => u.replace(/\/+$/, '');

export async function testServer(url, token) {
  const r = await fetch(base(url) + '/health', { headers: hdr(token) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function startJob(url, token, file, model, fmt) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('model', model);
  fd.append('fmt', fmt);
  const r = await fetch(base(url) + '/jobs', { method: 'POST', body: fd, headers: hdr(token) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()));
  return (await r.json()).job_id;
}

export async function waitJob(url, token, id, onTick, signal) {
  for (;;) {
    if (signal?.aborted) throw new Error('cancelled');
    const r = await fetch(`${base(url)}/jobs/${id}`, { headers: hdr(token) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    onTick?.(j);
    if (j.status === 'done') return j;
    if (j.status === 'error') throw new Error(j.error || 'separation failed');
    await new Promise((res) => setTimeout(res, 2000));
  }
}

export async function downloadStem(url, token, id, stem) {
  const r = await fetch(`${base(url)}/jobs/${id}/stems/${encodeURIComponent(stem)}`, { headers: hdr(token) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.arrayBuffer();
}

export async function deleteJob(url, token, id) {
  try { await fetch(`${base(url)}/jobs/${id}`, { method: 'DELETE', headers: hdr(token) }); } catch (e) { /* best effort */ }
}
