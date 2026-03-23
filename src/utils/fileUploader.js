import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { basename } from 'path';
import { Readable } from 'stream';
import { logger } from './logger.js';

async function withRetry(fn, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await fn();
      if (result?.success) return result;
    } catch (err) {
      lastErr = err;
    }
    if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  throw lastErr ?? new Error('All attempts failed');
}

// Stream a file directly to the upload service — no 2 GiB RAM limit.
export async function uploadFile(filePath) {
  const filename = basename(filePath);

  try {
    return await withRetry(() => gofileUploadStream(filePath, filename));
  } catch (err) {
    logger.warn(`gofile.io failed: ${err.message}`);
  }

  try {
    return await withRetry(() => litterboxUploadStream(filePath, filename));
  } catch (err) {
    logger.warn(`litterbox failed: ${err.message}`);
  }

  return { success: false, error: 'All upload services failed' };
}

// Buffer-based upload used for /upload (Discord attachments, always <25 MB).
export async function uploadBuffer(buffer, filename) {
  try {
    const result = await gofileUploadBuffer(buffer, filename);
    if (result.success) return result;
  } catch (err) {
    logger.warn(`gofile.io failed: ${err.message}`);
  }

  try {
    const result = await litterboxUploadBuffer(buffer, filename);
    if (result.success) return result;
  } catch (err) {
    logger.warn(`litterbox failed: ${err.message}`);
  }

  return { success: false, error: 'All upload services failed' };
}

// ─── Multipart stream helper ──────────────────────────────────────────────────

async function buildMultipartStream(fields, fileField, filePath, filename) {
  const boundary = `FormBoundary${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const fileStats = await stat(filePath);

  let preamble = '';
  for (const [name, value] of Object.entries(fields)) {
    preamble += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  preamble += `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;

  const preambleBuf = Buffer.from(preamble);
  const epilogueBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
  const contentLength = preambleBuf.length + fileStats.size + epilogueBuf.length;

  async function* generate() {
    yield preambleBuf;
    for await (const chunk of createReadStream(filePath)) yield chunk;
    yield epilogueBuf;
  }

  const stream = Readable.toWeb(Readable.from(generate()));
  return { stream, boundary, contentLength };
}

// ─── gofile.io ────────────────────────────────────────────────────────────────

async function getGofileServer() {
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

  return { token, server: serverData.data.servers[0].name };
}

async function gofileUploadStream(filePath, filename) {
  const { token, server } = await getGofileServer();
  const { stream, boundary, contentLength } = await buildMultipartStream(
    { token }, 'file', filePath, filename,
  );

  const res = await fetch(`https://${server}.gofile.io/uploadfile`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(contentLength),
    },
    body: stream,
    duplex: 'half',
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`gofile error: ${data.status}`);
  return { success: true, url: data.data.downloadPage, service: 'gofile.io' };
}

async function gofileUploadBuffer(buffer, filename) {
  const { token, server } = await getGofileServer();
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

// ─── litterbox.catbox.moe ─────────────────────────────────────────────────────

async function litterboxUploadStream(filePath, filename) {
  const { stream, boundary, contentLength } = await buildMultipartStream(
    { reqtype: 'fileupload', time: '1w' }, 'fileToUpload', filePath, filename,
  );

  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(contentLength),
    },
    body: stream,
    duplex: 'half',
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const url = (await res.text()).trim();
  if (url.startsWith('http')) return { success: true, url, service: 'litterbox.catbox.moe' };
  throw new Error(`Unexpected response: ${url}`);
}

async function litterboxUploadBuffer(buffer, filename) {
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
