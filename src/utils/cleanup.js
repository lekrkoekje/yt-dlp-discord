import { unlink, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';
import { DOWNLOADS_DIR } from '../config.js';

const execAsync = promisify(exec);

export async function deleteFile(filePath) {
  try {
    await unlink(filePath);
  } catch {
    // Ignore — file may already be gone
  }
}

export async function deleteUserDir(userDir) {
  try {
    await rm(userDir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

export async function cleanupDownloadsDir() {
  let entries;
  try {
    entries = await readdir(DOWNLOADS_DIR);
  } catch {
    return; // Directory doesn't exist yet
  }

  if (entries.length === 0) return;

  let removed = 0;
  for (const entry of entries) {
    const fullPath = join(DOWNLOADS_DIR, entry);
    try {
      await rm(fullPath, { recursive: true, force: true });
      removed++;
    } catch (err) {
      logger.warn(`Could not remove ${fullPath}: ${err.message}`);
    }
  }

  if (removed > 0) logger.clean(`Removed ${removed} leftover item(s) from previous session`);
}

export async function checkDependencies() {
  let allOk = true;

  try {
    const { stdout } = await execAsync('yt-dlp --version');
    logger.info(`yt-dlp ${stdout.trim()} found`);
  } catch {
    logger.error('yt-dlp is not installed or not in PATH — install from https://github.com/yt-dlp/yt-dlp');
    allOk = false;
  }

  try {
    await execAsync('ffmpeg -version');
    logger.info('ffmpeg found');
  } catch {
    logger.warn('ffmpeg not found — audio extraction and format merging will not work (https://ffmpeg.org)');
  }

  if (!allOk) {
    process.exit(1);
  }
}
