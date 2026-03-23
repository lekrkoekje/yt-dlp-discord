import { EmbedBuilder } from 'discord.js';
import { spawn } from 'child_process';
import { mkdir, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { nanoid } from 'nanoid';
import { filterLogLine } from '../utils/logFilter.js';
import {
  createProgressEmbed,
  createSuccessEmbed,
  createSuccessActionRow,
  createErrorEmbed,
  createCancelledEmbed,
  createUploadingEmbed,
} from '../utils/embedBuilder.js';
import { uploadFile } from '../utils/fileUploader.js';
import { deleteFile, deleteUserDir } from '../utils/cleanup.js';
import { logger } from '../utils/logger.js';
import { DOWNLOADS_DIR, LOG_UPDATE_INTERVAL } from '../config.js';
import { checkResources } from '../utils/systemMonitor.js';

let logs = null;
try { logs = await import('../logs.js'); } catch {}

// taskId -> { process, userId, url, username, taskId, stop }
export const activeDownloads = new Map();
export const cancelledTasks  = new Set();

// Global resource-based queue — { resolve, isLive }
const waitingQueue = [];

function processQueue() {
  for (let i = 0; i < waitingQueue.length; i++) {
    const reason = checkResources(waitingQueue[i].isLive);
    if (!reason) {
      const [entry] = waitingQueue.splice(i, 1);
      entry.resolve();
      return;
    }
  }
}

// Flags users are not allowed to pass — prevents reading host cookies/credentials,
// arbitrary code execution, or writing files outside the designated download dir.
const BLOCKED_FLAGS = new Set([
  '--cookies', '--cookies-from-browser',
  '--exec', '--exec-before-download',
  '--external-downloader', '--external-downloader-args',
  '--post-processor-args', '--postprocessor-args',
  '--config-location', '--ignore-config', '--no-config',
  '--netrc', '--netrc-location', '--netrc-cmd',
  '--load-info-json',
  '--print-to-file',
  '--download-archive', '--break-on-existing',
  '-o', '--output',
  '--paths', '-P',
]);

function sanitizeArgs(args) {
  const result = [];
  let skip = false;
  for (const arg of args) {
    if (skip) { skip = false; continue; }
    const flag = arg.includes('=') ? arg.split('=')[0] : arg;
    if (BLOCKED_FLAGS.has(flag)) {
      // If the flag uses --flag value (not --flag=value), skip next token too
      if (!arg.includes('=')) skip = true;
      continue;
    }
    result.push(arg);
  }
  return result;
}

function liveByRegex(url) {
  return /twitch\.tv\/(?!videos\/|clips\/)[^/?]+/.test(url) ||
    /youtube\.com\/(live|.*\/live)/.test(url) ||
    /kick\.com\/[^/?]+/.test(url) ||
    /instagram\.com\/.*\/live/.test(url) ||
    /tiktok\.com\/@[^/?]+\/live/.test(url) ||
    /afreecatv\.com\/[^/?]+/.test(url) ||
    /live\.bilibili\.com\//.test(url) ||
    /nimo\.tv\/[^/?]+/.test(url) ||
    /douyu\.com\/[^/?]+/.test(url) ||
    /huya\.com\/[^/?]+/.test(url) ||
    /facebook\.com\/.*\/live/.test(url);
}

export async function detectIsLive(url, args = []) {
  if (args.some((a) => a === '--live-from-start' || a === '--wait-for-video')) return true;
  if (!url) return false;
  if (liveByRegex(url)) return true;

  // Ask yt-dlp directly for unknown sites
  try {
    const result = await new Promise((resolve) => {
      const child = spawn('yt-dlp', ['-s', '--print', 'is_live', url]);
      let output = '';
      child.stdout.on('data', (d) => { output += d.toString(); });
      child.on('close', () => resolve(output.trim()));
      child.on('error', () => resolve(''));
      setTimeout(() => { try { child.kill(); } catch {} resolve(''); }, 15_000);
    });
    if (result === 'True') return true;
  } catch {}

  return false;
}

export async function queueDownload({ reply, client, userId, username, ytArgs, outputName, url, isLive, isDM, guildId, guildName, channelId, source }) {
  const type = isLive ? 'livestream' : 'video/audio';
  logger.queue(username, type, isDM, guildName, guildId, channelId);

  const reason = checkResources(isLive);
  if (reason) {
    const position = waitingQueue.length + 1;
    try {
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('⏳ Download queued')
            .setDescription(`Your download has been added to the queue at position **${position}**. The server is busy — it will start automatically when ready.`)
            .setTimestamp(),
        ],
      });
    } catch {}

    await new Promise((resolve) => waitingQueue.push({ resolve, isLive }));
  }

  try {
    await startDownload({ reply, userId, username, ytArgs, outputName, url, isLive, isDM, guildId, guildName, channelId, source });
  } finally {
    setTimeout(processQueue, 1500);
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function startDownload({ reply, userId, username, ytArgs, outputName, url, isLive, isDM, guildId, guildName, channelId, source }) {
  const taskId = nanoid(6);
  const userDir = join(DOWNLOADS_DIR, userId);
  await mkdir(userDir, { recursive: true });

  let existingFiles = new Set();
  try { existingFiles = new Set(await readdir(userDir)); } catch {}

  const logLines = [];
  let embedMessage;

  try {
    embedMessage = await reply(createProgressEmbed(taskId, ['Starting download...']));
  } catch (err) {
    logger.error(`Could not send DM to ${username}: ${err.message}`);
    return;
  }

  logger.start(username, taskId, url);

  const safeArgs = sanitizeArgs(ytArgs);
  const template = outputName ? `${outputName}.%(ext)s` : '%(title)s [%(id)s].%(ext)s';
  const fullArgs = [
    '--newline', '--no-colors', '--progress',
    '--paths', userDir,
    '-o', template,
    ...safeArgs,
  ];

  const child = spawn('yt-dlp', fullArgs);

  const updateInterval = setInterval(async () => {
    if (!embedMessage) return;
    try {
      await embedMessage.edit({ embeds: [createProgressEmbed(taskId, logLines)] });
    } catch {}
  }, LOG_UPDATE_INTERVAL);

  activeDownloads.set(taskId, {
    process: child,
    userId,
    url,
    username,
    taskId,
    stop: () => clearInterval(updateInterval),
  });

  child.stdout.on('data', (data) => {
    data.toString().split('\n').filter((l) => l.trim()).forEach((l) => logLines.push(filterLogLine(l)));
  });
  child.stderr.on('data', (data) => {
    data.toString().split('\n').filter((l) => l.trim()).forEach((l) => logLines.push(filterLogLine(l)));
  });

  await new Promise((resolve) => {
    let done = false;

    child.on('close', async (code) => {
      clearInterval(updateInterval);
      activeDownloads.delete(taskId);
      if (done) { resolve(); return; }
      done = true;
      if (cancelledTasks.has(taskId)) {
        cancelledTasks.delete(taskId);
        try { await embedMessage.edit({ embeds: [createCancelledEmbed(taskId)] }); } catch {}
        resolve();
        return;
      }
      if (code === 0) {
        await handleSuccess({ embedMessage, username, userId, userDir, taskId, existingFiles, url, isLive, isDM, guildId, guildName, channelId, source });
      } else {
        await handleFailure({ embedMessage, userDir, taskId, logLines, exitCode: code, username, userId, url, isDM, guildId, guildName, channelId, source });
      }
      resolve();
    });

    child.on('error', async (err) => {
      clearInterval(updateInterval);
      activeDownloads.delete(taskId);
      done = true;
      logLines.push(`Process error: ${err.message}`);
      await handleFailure({ embedMessage, userDir, taskId, logLines, exitCode: -1, username, userId, url, isDM, guildId, guildName, channelId, source });
      // 'close' will fire after this and call resolve()
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function handleSuccess({ embedMessage, username, userId, userDir, taskId, existingFiles, url, isLive, isDM, guildId, guildName, channelId, source }) {
  let allFiles = [];
  try { allFiles = await readdir(userDir); } catch {}

  const newFiles = allFiles.filter((f) => !existingFiles.has(f));

  if (newFiles.length === 0) {
    try {
      await embedMessage.edit({
        embeds: [createErrorEmbed(taskId, ['No files were found after the download completed.'], 0)],
      });

    } catch {}
    return;
  }

  for (const file of newFiles) {
    const filePath = join(userDir, file);
    let fileStats;
    try { fileStats = await stat(filePath); } catch { continue; }

    const sizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    logger.uploading(username, taskId, file, sizeMB);
    try { await embedMessage.edit({ embeds: [createUploadingEmbed(taskId, file)] }); } catch {}

    const uploadResult = await uploadFile(filePath);
    await deleteFile(filePath);

    if (!uploadResult.success) {
      logger.failure(username, taskId, `upload failed: ${uploadResult.error}`);
      try {
        await embedMessage.edit({
          embeds: [createErrorEmbed(taskId, [`Upload failed: ${uploadResult.error}`], 0)],
        });
  
      } catch {}
      continue;
    }

    const format = extname(file).slice(1) || 'unknown';

    logger.success(username, taskId, file, sizeMB, uploadResult.url);
    logs?.logDownload({ taskId, userId, username, url, uploadUrl: uploadResult.url, fileName: file, fileSize: fileStats.size, format, isLive, isDM, guildId, guildName, channelId, source });

    try {
      await embedMessage.edit({
        embeds: [createSuccessEmbed(taskId, file, fileStats.size, format)],
        components: [createSuccessActionRow(uploadResult.url, file)],
      });

    } catch {}
  }

  try {
    const remaining = await readdir(userDir);
    if (remaining.length === 0) await deleteUserDir(userDir);
  } catch {}
}

async function handleFailure({ embedMessage, userDir, taskId, logLines, exitCode, username, userId, url, isDM, guildId, guildName, channelId, source }) {
  logger.failure(username, taskId, exitCode);
  logs?.logFailure({ taskId, userId, username, url, exitCode, isDM, guildId, guildName, channelId, source });

  try {
    await embedMessage.edit({
      embeds: [createErrorEmbed(taskId, logLines, exitCode)],
    });
  } catch {}

  try {
    const files = await readdir(userDir);
    for (const file of files) await deleteFile(join(userDir, file));
    await deleteUserDir(userDir);
  } catch {}
}
