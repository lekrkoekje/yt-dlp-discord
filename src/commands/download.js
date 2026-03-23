import { EmbedBuilder } from 'discord.js';
import { queueDownload, detectIsLive } from '../handlers/downloadManager.js';

function splitExtraArgs(str) {
  if (!str) return [];
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
      if (current) { args.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

export async function handleDownload(interaction) {
  const url            = interaction.options.getString('url');
  const audioOnly      = interaction.options.getBoolean('audio-only') ?? false;
  const audioFormat    = interaction.options.getString('audio-format') ?? 'mp3';
  const audioQuality   = interaction.options.getString('audio-quality') ?? '0';
  const format         = interaction.options.getString('format');
  const playlist       = interaction.options.getBoolean('playlist') ?? false;
  const playlistItems  = interaction.options.getString('playlist-items');
  const subtitles      = interaction.options.getBoolean('subtitles') ?? false;
  const subLang        = interaction.options.getString('sub-lang');
  const thumbnail      = interaction.options.getBoolean('thumbnail') ?? false;
  const sponsorblock   = interaction.options.getBoolean('sponsorblock') ?? false;
  const limitRate      = interaction.options.getString('limit-rate');
  const keepGoing      = interaction.options.getBoolean('keep-going') ?? false;
  const outputName     = interaction.options.getString('output-name');
  const extraArgs      = interaction.options.getString('extra-args');

  const ytArgs = [];
  if (format) ytArgs.push('-f', format);
  if (audioOnly) {
    ytArgs.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', audioQuality);
  }
  if (playlist) ytArgs.push('--yes-playlist');
  else ytArgs.push('--no-playlist');
  if (playlistItems) ytArgs.push('--playlist-items', playlistItems);
  if (subtitles) ytArgs.push('--embed-subs', '--write-subs');
  if (subLang) ytArgs.push('--sub-lang', subLang);
  if (thumbnail) ytArgs.push('--embed-thumbnail');
  if (sponsorblock) ytArgs.push('--sponsorblock-remove', 'default');
  if (limitRate) ytArgs.push('-r', limitRate);
  if (keepGoing) ytArgs.push('-i');
  if (extraArgs) ytArgs.push(...splitExtraArgs(extraArgs));
  ytArgs.push(url);

  const isLive    = await detectIsLive(url, ytArgs);
  const isDM      = !interaction.guild;
  const userId    = interaction.user.id;
  const username  = interaction.user.tag;
  const guildId   = interaction.guildId ?? null;
  const guildName = interaction.guild?.name ?? null;
  const channelId = interaction.channelId ?? null;

  // Ephemeral acknowledgement — only visible to the user
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⬇️ Download queued')
        .setDescription('You will receive the progress and download link in your DMs.\n-# Use `/cancel` to stop the download.')
        .setFooter({ text: isLive ? 'Livestream detected' : 'Use /cancel to stop the download' }),
    ],
    ephemeral: true,
  });

  const reply = async (embed) => {
    if (isDM) return interaction.followUp({ embeds: [embed] });
    try {
      const user = await interaction.client.users.fetch(userId);
      return await user.send({ embeds: [embed] });
    } catch {
      await interaction.followUp({
        content: '❌ Could not send you a DM. Please enable DMs from server members in your privacy settings.',
        ephemeral: true,
      });
      throw new Error('DM unavailable');
    }
  };

  await queueDownload({
    reply,
    client: interaction.client,
    userId,
    username,
    ytArgs,
    outputName: outputName ?? null,
    url,
    isLive,
    isDM,
    guildId,
    guildName,
    channelId,
    source: 'slash command',
  });
}
