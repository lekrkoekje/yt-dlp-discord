import { EmbedBuilder } from 'discord.js';
import { nanoid } from 'nanoid';
import { uploadBuffer } from '../utils/fileUploader.js';
import { createUploadSuccessEmbed, createSuccessActionRow, createErrorEmbed } from '../utils/embedBuilder.js';
import { logger } from '../utils/logger.js';

let logs = null;
try { logs = await import('../logs.js'); } catch {}

export async function handleUpload(interaction) {
  const attachment = interaction.options.getAttachment('file');
  const isDM       = !interaction.guild;
  const userId     = interaction.user.id;
  const username   = interaction.user.tag;
  const guildId    = interaction.guildId ?? null;
  const guildName  = interaction.guild?.name ?? null;
  const channelId  = interaction.channelId ?? null;
  const taskId     = nanoid(6);
  const source     = 'slash command';

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📤 Upload queued')
        .setDescription('Uploading your file to gofile.io…\nYou will receive the link in your DMs.')
        .setFooter({ text: `${attachment.name} — ${(attachment.size / 1024 / 1024).toFixed(2)} MB` }),
    ],
    ephemeral: true,
  });

  const sendDm = async (payload) => {
    if (isDM) return interaction.followUp(payload);
    const user = await interaction.client.users.fetch(userId);
    return user.send(payload);
  };

  let dmMessage;
  try {
    dmMessage = await sendDm({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`📤 Uploading... [${taskId}]`)
          .setDescription('Fetching and uploading your file…')
          .setTimestamp(),
      ],
    });
  } catch {
    return;
  }

  let buffer;
  try {
    const res = await fetch(attachment.url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to fetch attachment: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    try {
      await dmMessage.edit({ embeds: [createErrorEmbed(taskId, [`Could not fetch file: ${err.message}`], 0)] });
    } catch {}
    return;
  }

  const result = await uploadBuffer(buffer, attachment.name);

  if (!result.success) {
    try {
      await dmMessage.edit({ embeds: [createErrorEmbed(taskId, [`Upload failed: ${result.error}`], 0)] });
    } catch {}
    return;
  }

  const sizeMB = (attachment.size / 1024 / 1024).toFixed(2);
  logger.upload(username, taskId, attachment.name, sizeMB, result.url, isDM, guildName, guildId, channelId);
  logs?.logUpload({ taskId, userId, username, fileName: attachment.name, fileSize: attachment.size, uploadUrl: result.url, source, isDM, guildId, guildName, channelId });

  try {
    await dmMessage.edit({
      embeds: [createUploadSuccessEmbed(taskId, attachment.name, attachment.size)],
      components: [createSuccessActionRow(result.url, attachment.name)],
    });
  } catch {}
}

export async function handleUploadMessage({ message, isDM, userId, username, guildId, guildName, channelId }) {
  if (message.attachments.size === 0) {
    await message.reply('Attach a file to upload. Example: `yt-dlp upload` with a file attached.');
    return;
  }

  const attachment = message.attachments.first();
  const taskId     = nanoid(6);
  const source     = 'message command';

  if (!isDM) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📤 Upload queued')
          .setDescription('Uploading your file to gofile.io…\nYou will receive the link in your DMs.')
          .setFooter({ text: `${attachment.name} — ${(attachment.size / 1024 / 1024).toFixed(2)} MB` }),
      ],
    });
  }

  const sendDm = async (payload) => {
    if (isDM) return message.reply(payload);
    const user = await message.client.users.fetch(userId);
    return user.send(payload);
  };

  let dmMessage;
  try {
    dmMessage = await sendDm({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`📤 Uploading... [${taskId}]`)
          .setDescription('Fetching and uploading your file…')
          .setTimestamp(),
      ],
    });
  } catch {
    return;
  }

  let buffer;
  try {
    const res = await fetch(attachment.url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to fetch attachment: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    try {
      await dmMessage.edit({ embeds: [createErrorEmbed(taskId, [`Could not fetch file: ${err.message}`], 0)] });
    } catch {}
    return;
  }

  const result = await uploadBuffer(buffer, attachment.name);

  if (!result.success) {
    try {
      await dmMessage.edit({ embeds: [createErrorEmbed(taskId, [`Upload failed: ${result.error}`], 0)] });
    } catch {}
    return;
  }

  const sizeMB = (attachment.size / 1024 / 1024).toFixed(2);
  logger.upload(username, taskId, attachment.name, sizeMB, result.url, isDM, guildName, guildId, channelId);
  logs?.logUpload({ taskId, userId, username, fileName: attachment.name, fileSize: attachment.size, uploadUrl: result.url, source, isDM, guildId, guildName, channelId });

  try {
    await dmMessage.edit({
      embeds: [createUploadSuccessEmbed(taskId, attachment.name, attachment.size)],
      components: [createSuccessActionRow(result.url, attachment.name)],
    });
  } catch {}
}
