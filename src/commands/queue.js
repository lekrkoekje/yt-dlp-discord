import { activeDownloads } from '../handlers/downloadManager.js';
import { createQueueEmbed } from '../utils/embedBuilder.js';

export async function handleQueue(interaction) {
  const userId = interaction.user.id;
  const userDownloads = [...activeDownloads.values()].filter((d) => d.userId === userId);
  const embed = createQueueEmbed(userDownloads);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
