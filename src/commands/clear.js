import { clearUserDownloads, activeDownloads } from '../handlers/downloadManager.js';

export async function handleClear(interaction) {
  const userId = interaction.user.id;

  const active = [...activeDownloads.values()].filter((d) => d.userId === userId).length;
  clearUserDownloads(userId);

  await interaction.reply({
    content: active > 0
      ? `Stopped ${active} active download${active !== 1 ? 's' : ''} and cleared the queue.`
      : 'Queue cleared. No active downloads were running.',
    ephemeral: true,
  });
}
