import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const downloadCommand = new SlashCommandBuilder()
  .setName('yt-dlp')
  .setDescription('Download a video, audio, livestream or playlist')
  .addStringOption((o) =>
    o.setName('url')
      .setDescription('Link to the video, playlist or livestream')
      .setRequired(true))
  .addBooleanOption((o) =>
    o.setName('audio-only')
      .setDescription('Download only the audio, no video')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('audio-format')
      .setDescription('Audio file type (only used with audio-only). Default: mp3')
      .setRequired(false)
      .addChoices(
        { name: 'mp3', value: 'mp3' },
        { name: 'aac', value: 'aac' },
        { name: 'flac (lossless)', value: 'flac' },
        { name: 'opus', value: 'opus' },
        { name: 'wav (lossless)', value: 'wav' },
        { name: 'm4a', value: 'm4a' },
      ))
  .addStringOption((o) =>
    o.setName('audio-quality')
      .setDescription('Audio quality (only used with audio-only). Default: best')
      .setRequired(false)
      .addChoices(
        { name: 'Best', value: '0' },
        { name: 'High', value: '2' },
        { name: 'Medium', value: '5' },
        { name: 'Low', value: '7' },
        { name: 'Smallest file', value: '10' },
      ))
  .addBooleanOption((o) =>
    o.setName('playlist')
      .setDescription('Download the entire playlist, not just this video')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('playlist-items')
      .setDescription('Which videos from a playlist to download. Examples: 1-5, 1,3,5')
      .setRequired(false))
  .addBooleanOption((o) =>
    o.setName('subtitles')
      .setDescription('Embed subtitles into the file if available')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('sub-lang')
      .setDescription('Subtitle language(s). Examples: en, nl, en,nl')
      .setRequired(false))
  .addBooleanOption((o) =>
    o.setName('thumbnail')
      .setDescription('Embed the thumbnail into the file')
      .setRequired(false))
  .addBooleanOption((o) =>
    o.setName('sponsorblock')
      .setDescription('Cut out sponsor segments automatically (YouTube only)')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('limit-rate')
      .setDescription('Cap the download speed. Examples: 5M, 500K')
      .setRequired(false))
  .addBooleanOption((o) =>
    o.setName('keep-going')
      .setDescription('Continue if one video in a playlist fails')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('output-name')
      .setDescription('Custom filename without extension')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('format')
      .setDescription('Manual format string, leave empty for best quality. Example: bestvideo[height<=1080]+bestaudio')
      .setRequired(false))
  .addStringOption((o) =>
    o.setName('extra-args')
      .setDescription('Any extra yt-dlp flags. Example: --geo-bypass --sleep-interval 5')
      .setRequired(false));

const uploadCommand = new SlashCommandBuilder()
  .setName('upload')
  .setDescription('Upload a file to gofile.io and get a download link in your DMs')
  .addAttachmentOption((o) =>
    o.setName('file')
      .setDescription('The file to upload')
      .setRequired(true));

const queueCommand = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show your active downloads');

const cancelCommand = new SlashCommandBuilder()
  .setName('cancel')
  .setDescription('Cancel an active download')
  .addStringOption((o) =>
    o.setName('task-id')
      .setDescription('The task ID shown in the download message, e.g. aB3xYz')
      .setRequired(true));

const commands = [downloadCommand, uploadCommand, queueCommand, cancelCommand].map((c) => c.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
