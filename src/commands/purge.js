import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export async function handlePurge(interaction) {
  const userId = interaction.user.id;

  let dmMessage;
  try {
    const user = await interaction.client.users.fetch(userId);
    dmMessage = await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🗑️ Purge DM history')
          .setDescription('This will delete **all messages sent by the bot** in this DM conversation.\n\nAre you sure?')
          .setTimestamp(),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`purge_confirm_${userId}`)
            .setLabel('Yes, delete everything')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`purge_cancel_${userId}`)
            .setLabel('No, cancel')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  } catch {
    await interaction.reply({
      content: 'Could not send you a DM. Please enable DMs from server members.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: 'Check your DMs.', ephemeral: true });

  try {
    const button = await dmMessage.awaitMessageComponent({
      filter: (i) => i.user.id === userId,
      time: 120_000,
    });

    if (button.customId === `purge_cancel_${userId}`) {
      await button.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle('Cancelled')
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    await button.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle('🗑️ Deleting messages...')
          .setDescription('Finding and deleting all bot messages. This may take a moment.')
          .setTimestamp(),
      ],
      components: [],
    });

    const dmChannel = dmMessage.channel;
    const confirmId = dmMessage.id;
    let deleted = 0;
    let before = undefined;
    const toDelete = [];

    while (true) {
      const batch = await dmChannel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (batch.size === 0) break;
      batch.filter((m) => m.author.id === interaction.client.user.id && m.id !== confirmId)
        .forEach((m) => toDelete.push(m));
      before = batch.last().id;
      if (batch.size < 100) break;
    }

    for (const msg of toDelete) {
      try { await msg.delete(); deleted++; } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }

    try {
      await dmMessage.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Done')
            .setDescription(`Deleted **${deleted}** message${deleted !== 1 ? 's' : ''}.`)
            .setTimestamp(),
        ],
        components: [],
      });
    } catch {}

  } catch (err) {
    const isTimeout = err?.code === 'InteractionCollectorError' || err?.message?.includes('time');
    try {
      await dmMessage.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle(isTimeout ? 'Timed out' : '❌ Something went wrong')
            .setDescription(isTimeout ? 'No response received. Nothing was deleted.' : `Error: ${err.message}`)
            .setTimestamp(),
        ],
        components: [],
      });
    } catch {}
  }
}
