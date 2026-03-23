import { EmbedBuilder } from 'discord.js';
import { queueDownload, activeDownloads, cancelledTasks, detectIsLive } from './downloadManager.js';
import { handleUploadMessage } from '../commands/upload.js';
import { createQueueEmbed } from '../utils/embedBuilder.js';
import { logger } from '../utils/logger.js';
let logs = null;
try { logs = await import('../logs.js'); } catch {}

const PREFIX = 'yt-dlp';

function parseArgs(str) {
  const args = [];
  let current = '';
  let inQuote = null;
  for (const ch of str) {
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) { args.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) args.push(current);
  return args;
}

function extractUrl(args) {
  return args.find((a) => a.startsWith('http://') || a.startsWith('https://')) ?? null;
}

export async function handleMessage(message) {
  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;
  const after = content.slice(PREFIX.length);
  if (after.length > 0 && after[0] !== ' ' && after[0] !== '\t') return;

  const rawArgs  = after.trim();
  const userId   = message.author.id;
  const username = message.author.tag;
  const isDM     = !message.guild;
  const guildId   = message.guildId ?? null;
  const guildName = message.guild?.name ?? null;
  const channelId = message.channelId ?? null;

  // yt-dlp  or  yt-dlp queue
  if (!rawArgs || rawArgs === 'queue') {
    const userDownloads = [...activeDownloads.values()].filter((d) => d.userId === userId);
    await message.reply({ embeds: [createQueueEmbed(userDownloads)] });
    return;
  }

  // yt-dlp upload (with attachment)
  if (rawArgs === 'upload') {
    await handleUploadMessage({ message, isDM, userId, username, guildId, guildName, channelId });
    return;
  }

  // yt-dlp cancel <taskId>
  if (rawArgs.startsWith('cancel')) {
    const taskId = rawArgs.slice('cancel'.length).trim();
    if (!taskId) { await message.reply('Usage: `yt-dlp cancel <task-id>`'); return; }

    const download = activeDownloads.get(taskId);
    if (!download) { await message.reply(`No active download with task ID \`${taskId}\`.`); return; }
    if (download.userId !== userId) { await message.reply('You can only cancel your own downloads.'); return; }

    cancelledTasks.add(taskId);
    logger.cancel(download.username, taskId);
    logs?.logCancel({ taskId, userId, username: download.username, url: download.url, isDM, guildId, guildName, channelId });
    download.stop();
    try { download.process.kill('SIGTERM'); } catch { download.process.kill(); }
    activeDownloads.delete(taskId);
    await message.reply(`Cancelled download \`${taskId}\`.`);
    return;
  }

  // Regular download
  const args = parseArgs(rawArgs);
  if (args.length === 0) {
    await message.reply('Usage: `yt-dlp <url> [options]`');
    return;
  }

  const url    = extractUrl(args) ?? '';
  const isLive = await detectIsLive(url, args);
  let reply;

  if (isDM) {
    reply = async (embed) => message.reply({ embeds: [embed] });
  } else {
    const ackEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⬇️ Download queued')
      .setDescription('You will receive the progress and download link in your DMs.\n-# Use `yt-dlp cancel <id>` to stop the download.')
      .setFooter({ text: isLive ? 'Livestream detected' : 'Use `yt-dlp cancel <id>` to stop the download' });

    await message.reply({ embeds: [ackEmbed] });

    reply = async (embed) => {
      try {
        const user = await message.client.users.fetch(userId);
        return await user.send({ embeds: [embed] });
      } catch {
        message.channel.send(`<@${userId}> Could not send a DM. Please enable DMs from server members.`).catch(() => {});
        throw new Error('DM unavailable');
      }
    };
  }

  await queueDownload({
    reply,
    client: message.client,
    userId,
    username,
    ytArgs: args,
    outputName: null,
    url,
    isLive,
    isDM,
    guildId,
    guildName,
    channelId,
    source: 'message command',
  });
}
