import { readFile } from 'fs/promises';
import { basename } from 'path';
import { logger } from './logger.js';

export async function uploadFile(filePath) {
  const buffer = await readFile(filePath);
  return uploadBuffer(buffer, basename(filePath));
}

export async function uploadBuffer(buffer, filename) {
  try {
    const result = await gofileUpload(buffer, filename);
    if (result.success) return result;
  } catch (err) {
    logger.warn(`gofile.io failed: ${err.message}`);
  }

  try {
    const result = await litterboxUpload(buffer, filename);
    if (result.success) return result;
  } catch (err) {
    logger.warn(`litterbox failed: ${err.message}`);
  }

  return { success: false, error: 'All upload services failed' };
}

async function gofileUpload(buffer, filename) {
  const tokenRes = await fetch('https://api.gofile.io/accounts', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new Error(`Token fetch HTTP ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  const token = tokenData.data?.token;
  if (!token) throw new Error('No guest token returned');

  const serverRes = await fetch('https://api.gofile.io/servers', {
    signal: AbortSignal.timeout(10_000),
  });
  if (!serverRes.ok) throw new Error(`Server fetch HTTP ${serverRes.status}`);
  const serverData = await serverRes.json();
  if (serverData.status !== 'ok') throw new Error('gofile server list unavailable');

  const server = serverData.data.servers[0].name;
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  form.append('token', token);

  const res = await fetch(`https://${server}.gofile.io/uploadfile`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`gofile error: ${data.status}`);

  return { success: true, url: data.data.downloadPage, service: 'gofile.io' };
}

async function litterboxUpload(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', '1w');
  form.append('fileToUpload', new Blob([buffer]), filename);

  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const url = (await res.text()).trim();
  if (url.startsWith('http')) return { success: true, url, service: 'litterbox.catbox.moe' };
  throw new Error(`Unexpected response: ${url}`);
}
