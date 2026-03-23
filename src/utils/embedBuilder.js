import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { MAX_LOG_LINES } from '../config.js';

function buildLogDescription(lines, maxLen = 4000) {
  const recent = lines.slice(-MAX_LOG_LINES);
  let desc = '```\n' + recent.join('\n') + '\n```';
  if (desc.length > maxLen) {
    const inner = recent.join('\n');
    const trimmed = inner.slice(-(maxLen - 8));
    desc = '```\n' + trimmed + '\n```';
  }
  return desc || '```\nStarting...\n```';
}

export function createProgressEmbed(taskId, logLines) {
  return new EmbedBuilder()
    .setTitle(`⬇️ Downloading... [${taskId}]`)
    .setDescription(buildLogDescription(logLines))
    .setColor(0x3498db)
    .setTimestamp();
}

export function createSuccessEmbed(taskId, fileName, fileSize, format) {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  return new EmbedBuilder()
    .setTitle(`✅ Download Complete [${taskId}]`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'File', value: fileName, inline: true },
      { name: 'Size', value: `${sizeMB} MB`, inline: true },
      { name: 'Format', value: format || 'unknown', inline: true },
    )
    .setTimestamp();
}

export function createSuccessActionRow(downloadUrl, fileName) {
  const label = `📥 Download: ${fileName}`.slice(0, 80);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(label)
      .setURL(downloadUrl)
      .setStyle(ButtonStyle.Link),
  );
}

function getExitCodeLabel(code) {
  switch (code) {
    case 0:    return '0 — Success';
    case 1:    return '1 — Error';
    case 2:    return '2 — Partial (some items in playlist failed)';
    case -1:   return '-1 — Could not start yt-dlp';
    case null:
    case undefined: return '? — Unknown';
    default:   return `${code}`;
  }
}

function getFriendlyError(logLines) {
  const text = logLines.join('\n');
  if (/unsupported url|is not a supported url|no suitable extractor/i.test(text))
    return 'This site or URL is not supported.';
  if (/private video|video is private/i.test(text))
    return 'This video is private.';
  if (/this video is unavailable/i.test(text))
    return 'This video is unavailable.';
  if (/this video has been removed/i.test(text))
    return 'This video has been removed.';
  if (/age.{0,10}restricted|sign in to confirm your age|inappropriate for some users/i.test(text))
    return 'This content is age-restricted and requires a login.';
  if (/not available in your country|geo.?restrict|geo.?block/i.test(text))
    return 'This video is not available in your region.';
  if (/members.{0,5}only|join this channel/i.test(text))
    return 'This content is members-only.';
  if (/has been blocked.*copyright|copyright.*blocked/i.test(text))
    return 'This video has been blocked due to a copyright claim.';
  if (/live event will begin|waiting for livestream/i.test(text))
    return 'This livestream has not started yet.';
  if (/this live event has ended/i.test(text))
    return 'This livestream has ended and the recording is not yet available.';
  if (/http error 403|403: forbidden/i.test(text))
    return 'Access denied (HTTP 403). The content may be private or geo-blocked.';
  if (/http error 404|404: not found/i.test(text))
    return 'Not found (HTTP 404). The video may have been deleted.';
  if (/http error 429|429: too many/i.test(text))
    return 'Rate limited (HTTP 429). Try again in a few minutes.';
  if (/requested format is not available|no video formats found|no formats found/i.test(text))
    return 'No downloadable formats found. Try a different format or quality setting.';
  if (/ffmpeg.*not found|ffmpeg is not installed/i.test(text))
    return 'ffmpeg is not installed on the server. Audio extraction and format merging will not work.';
  return null;
}

export function createErrorEmbed(taskId, logLines, exitCode) {
  const friendly = getFriendlyError(logLines);
  const embed = new EmbedBuilder()
    .setTitle(`❌ Download Failed [${taskId}]`)
    .setColor(0xe74c3c)
    .setTimestamp();

  if (friendly) {
    const prefix = `**${friendly}**\n\n`;
    embed.setDescription(prefix + buildLogDescription(logLines, 4096 - prefix.length));
  } else {
    embed.setDescription(buildLogDescription(logLines));
  }

  embed.addFields({ name: 'Exit Code', value: getExitCodeLabel(exitCode), inline: true });
  return embed;
}


export function createUploadSuccessEmbed(taskId, fileName, fileSize) {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  return new EmbedBuilder()
    .setTitle(`✅ Upload Complete [${taskId}]`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'File', value: fileName, inline: true },
      { name: 'Size', value: `${sizeMB} MB`, inline: true },
    )
    .setTimestamp();
}

export function createUploadingEmbed(taskId, fileName) {
  return new EmbedBuilder()
    .setTitle(`📤 Uploading... [${taskId}]`)
    .setDescription(`Uploading **${fileName}** to file host...`)
    .setColor(0xf39c12)
    .setTimestamp();
}

export function createCancelledEmbed(taskId) {
  return new EmbedBuilder()
    .setTitle(`🚫 Download Cancelled [${taskId}]`)
    .setColor(0x95a5a6)
    .setTimestamp();
}

export function createUploadFailedEmbed(taskId, fileName, error) {
  return new EmbedBuilder()
    .setTitle(`⚠️ Upload Failed [${taskId}]`)
    .setColor(0xe67e22)
    .setDescription(`Could not upload **${fileName}**.\n\`${error}\`\n\nThe file is kept for **3 hours** — use the button below to retry.`)
    .setTimestamp();
}

export function createUploadExpiredEmbed(taskId, fileName) {
  return new EmbedBuilder()
    .setTitle(`🗑️ Upload Expired [${taskId}]`)
    .setColor(0x95a5a6)
    .setDescription(`The retry window for **${fileName}** has expired and the file has been deleted.`)
    .setTimestamp();
}

export function createRetryActionRow(taskId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`retry_upload_${taskId}`)
      .setLabel('Retry Upload')
      .setStyle(ButtonStyle.Primary),
  );
}

export function createQueueEmbed(downloads) {
  if (downloads.length === 0) {
    return new EmbedBuilder()
      .setTitle('📋 Your Download Queue')
      .setDescription('No active downloads.')
      .setColor(0x95a5a6)
      .setTimestamp();
  }

  const list = downloads
    .map((d) => {
      const short = d.url.length > 60 ? d.url.slice(0, 57) + '...' : d.url;
      return `**[${d.taskId}]** \`${short}\``;
    })
    .join('\n');

  return new EmbedBuilder()
    .setTitle('📋 Your Download Queue')
    .setDescription(list)
    .setColor(0x3498db)
    .setTimestamp();
}
