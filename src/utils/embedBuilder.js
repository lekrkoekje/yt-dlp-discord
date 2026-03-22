import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { MAX_LOG_LINES } from '../config.js';

function buildLogDescription(lines) {
  const recent = lines.slice(-MAX_LOG_LINES);
  let desc = '```\n' + recent.join('\n') + '\n```';
  if (desc.length > 4000) {
    const inner = recent.join('\n');
    const trimmed = inner.slice(-(4000 - 8));
    desc = '```\n' + trimmed + '\n```';
  }
  return desc || '```\nStarting...\n```';
}

export function createProgressEmbed(taskId, logLines, username) {
  return new EmbedBuilder()
    .setTitle(`⬇️ Downloading... [${taskId}]`)
    .setDescription(buildLogDescription(logLines))
    .setColor(0x3498db)
    .setFooter({ text: `Requested by ${username}` })
    .setTimestamp();
}

export function createSuccessEmbed(taskId, fileName, fileSize, format, username) {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  return new EmbedBuilder()
    .setTitle(`✅ Download Complete [${taskId}]`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'File', value: fileName, inline: true },
      { name: 'Size', value: `${sizeMB} MB`, inline: true },
      { name: 'Format', value: format || 'unknown', inline: true },
    )
    .setFooter({ text: `Requested by ${username}` })
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

export function createErrorEmbed(taskId, logLines, exitCode, username) {
  return new EmbedBuilder()
    .setTitle(`❌ Download Failed [${taskId}]`)
    .setDescription(buildLogDescription(logLines))
    .setColor(0xe74c3c)
    .addFields({ name: 'Exit Code', value: String(exitCode ?? '?'), inline: true })
    .setFooter({ text: `Requested by ${username}` })
    .setTimestamp();
}

export function createFileTooLargeEmbed(taskId, fileSize, username) {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  return new EmbedBuilder()
    .setTitle(`⚠️ File Too Large [${taskId}]`)
    .setDescription(
      `The file is **${sizeMB} MB**, which exceeds the 100 MB limit for free hosting.\n\n` +
      `Try again with a lower quality or format, for example:\n` +
      `- \`format: worst\`\n` +
      `- \`audio-only: true\` with \`audio-format: mp3\``,
    )
    .setColor(0xf39c12)
    .setFooter({ text: `Requested by ${username}` })
    .setTimestamp();
}

export function createUploadSuccessEmbed(taskId, fileName, fileSize, username) {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  return new EmbedBuilder()
    .setTitle(`✅ Upload Complete [${taskId}]`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'File', value: fileName, inline: true },
      { name: 'Size', value: `${sizeMB} MB`, inline: true },
    )
    .setFooter({ text: `Uploaded by ${username}` })
    .setTimestamp();
}

export function createQueueEmbed(downloads, username) {
  if (downloads.length === 0) {
    return new EmbedBuilder()
      .setTitle('📋 Your Download Queue')
      .setDescription('No active downloads.')
      .setColor(0x95a5a6)
      .setFooter({ text: `Requested by ${username}` })
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
    .setFooter({ text: `Requested by ${username}` })
    .setTimestamp();
}
