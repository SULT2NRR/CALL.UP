const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

const WHITELIST_ROLE_ID = '1443294946089242727';
const CALLUP_ROLE_ID    = '1502830142496575569';
const LOG_CHANNEL_ID    = '1503564649168244848';

client.once('ready', () => {
  console.log(`✅ البوت شغّال: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {

  if (interaction.isButton() && interaction.customId === 'open_callup_form') {
    const modal = new ModalBuilder()
      .setCustomId('callup_modal')
      .setTitle('📋 فورم الكول أب');

    const userIdInput = new TextInputBuilder()
      .setCustomId('user_id')
      .setLabel('Copy ID الشخص')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('مثال: 123456789012345678')
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('السبب')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('اكتب السبب هنا...')
      .setRequired(true);

    const evidenceInput = new TextInputBuilder()
      .setCustomId('evidence')
      .setLabel('الدليل (رابط)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(evidenceInput),
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'callup_modal') {
    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.fields.getTextInputValue('user_id').trim();
    const reason   = interaction.fields.getTextInputValue('reason').trim();
    const evidence = interaction.fields.getTextInputValue('evidence').trim();

    const guild = interaction.guild;
    let targetMember;

    try {
      targetMember = await guild.members.fetch(targetId);
    } catch {
      return interaction.editReply({ content: '❌ **ما لقيت العضو!** تأكد من الـ ID وإن العضو في السيرفر.' });
    }

    const hasWhitelist = targetMember.roles.cache.has(WHITELIST_ROLE_ID);
    if (!hasWhitelist) {
      return interaction.editReply({ content: `⚠️ **${targetMember.user.tag}** ما عنده رتبة WHITLIST أصلاً.` });
    }

    try {
      await targetMember.roles.remove(WHITELIST_ROLE_ID, `كول أب - السبب: ${reason}`);
      await targetMember.roles.add(CALLUP_ROLE_ID, `كول أب - السبب: ${reason}`);
    } catch (err) {
      console.error(err);
      return interaction.editReply({ content: '❌ **صار خطأ أثناء تغيير الرتب.**' });
    }

    const evidenceText = evidence.startsWith('http')
      ? `[اضغط هنا للدليل](${evidence})`
      : evidence;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setAuthor({ name: '🚨 تم تنفيذ الكول أب', iconURL: client.user.displayAvatarURL() })
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 العضو', value: `<@${targetId}>`, inline: true },
        { name: '👮 نُفّذ بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📌 السبب', value: `\`\`\`${reason}\`\`\`` },
        { name: '🔗 الدليل', value: evidenceText },
        { name: '🔄 التغيير', value: '> ❌ تمت إزالة رتبة **WHITLIST**\n> ✅ تمت إضافة رتبة **CALL UP**' },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${targetId}` });

    const restoreButton = new ButtonBuilder()
      .setCustomId(`restore_${targetId}`)
      .setLabel('↩️ إرجاع الرتبة')
      .setStyle(ButtonStyle.Success);

    const restoreRow = new ActionRowBuilder().addComponents(restoreButton);

    // ── إرسال رسالة خاصة للعضو ──
    const dmEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🚨 تم استدعاؤك — كول أب')
      .setDescription([
        '> احفظ تصاويرك **آخر 20 دقيقة** من خروجك وتوجّه فوراً.',
        '',
        '> ⚠️ في حال عدم توجهك خلال **24 ساعة** سيتم محاسبتك بشكل فوري.',
      ].join('\n'))
      .setTimestamp()
      .setFooter({ text: 'نظام الكول أب' });

    try {
      await targetMember.send({ embeds: [dmEmbed] });
    } catch {
      console.log('ما قدر يرسل خاص للعضو - ربما أغلق الرسائل الخاصة');
    }

    await interaction.editReply({ content: '✅ تم تنفيذ الكول أب!' });

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ content: `> تم تنفيذ كول أب على <@${targetId}>`, embeds: [embed], components: [restoreRow] });
    } catch (err) {
      console.error('خطأ في إرسال اللوق:', err);
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('restore_')) {
    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.customId.replace('restore_', '');
    const guild = interaction.guild;
    let targetMember;

    try {
      targetMember = await guild.members.fetch(targetId);
    } catch {
      return interaction.editReply({ content: '❌ ما لقيت العضو!' });
    }

    try {
      await targetMember.roles.remove(CALLUP_ROLE_ID, `إرجاع الرتبة بواسطة ${interaction.user.tag}`);
      await targetMember.roles.add(WHITELIST_ROLE_ID, `إرجاع الرتبة بواسطة ${interaction.user.tag}`);
    } catch (err) {
      console.error(err);
      return interaction.editReply({ content: '❌ صار خطأ أثناء إرجاع الرتبة.' });
    }

    const restoreEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setAuthor({ name: '✅ تم إرجاع الرتبة', iconURL: client.user.displayAvatarURL() })
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 العضو', value: `<@${targetId}>`, inline: true },
        { name: '👮 بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🔄 التغيير', value: '> ❌ تمت إزالة رتبة **CALL UP**\n> ✅ تمت إعادة رتبة **WHITLIST**' },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${targetId}` });

    await interaction.editReply({ content: '✅ تم إرجاع الرتبة!' });

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ content: `> تم إرجاع رتبة <@${targetId}>`, embeds: [restoreEmbed] });
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
