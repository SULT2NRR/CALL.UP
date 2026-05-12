const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// ══════════════════════════════════════════
//   الإعدادات - غيّرها حسب السيرفر
// ══════════════════════════════════════════
const WHITELIST_ROLE_ID = '1443294946089242727';  // رتبة WHITLIST
const CALLUP_ROLE_ID    = '1502830142496575569';  // رتبة CALL UP
const LOG_CHANNEL_ID    = '1503564649168244848';  // قناة السجل
// ══════════════════════════════════════════

client.once('ready', () => {
  console.log(`✅ البوت شغّال: ${client.user.tag}`);
});

// ─── زر الكول أب ───────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── 1. زر يفتح الفورم ──
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
      .setLabel('الدليل (رابط أو وصف)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('رابط الدليل أو وصفه...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(evidenceInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── 2. استقبال الفورم ──
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'callup_modal') {
    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.fields.getTextInputValue('user_id').trim();
    const reason   = interaction.fields.getTextInputValue('reason').trim();
    const evidence = interaction.fields.getTextInputValue('evidence').trim();

    const guild = interaction.guild;
    let targetMember;

    // جلب العضو
    try {
      targetMember = await guild.members.fetch(targetId);
    } catch {
      return interaction.editReply({ content: '❌ **ما لقيت العضو!** تأكد من الـ ID وإن العضو في السيرفر.' });
    }

    // ── شيل رتبة WHITLIST ──
    const hasWhitelist = targetMember.roles.cache.has(WHITELIST_ROLE_ID);
    if (!hasWhitelist) {
      return interaction.editReply({ content: `⚠️ **${targetMember.user.tag}** ما عنده رتبة WHITLIST أصلاً.` });
    }

    try {
      await targetMember.roles.remove(WHITELIST_ROLE_ID, `كول أب - السبب: ${reason}`);
      await targetMember.roles.add(CALLUP_ROLE_ID, `كول أب - السبب: ${reason}`);
    } catch (err) {
      console.error(err);
      return interaction.editReply({ content: '❌ **صار خطأ أثناء تغيير الرتب.** تأكد إن البوت عنده صلاحية إدارة الرتب وإن رتبته فوق رتبة العضو.' });
    }

    // ── رسالة تأكيد ──
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🚨 تم تنفيذ الكول أب')
      .addFields(
        { name: '👤 العضو', value: `${targetMember.user.tag} (${targetId})`, inline: true },
        { name: '👮 نُفّذ بواسطة', value: `${interaction.user.tag}`, inline: true },
        { name: '📌 السبب', value: reason },
        { name: '🔗 الدليل', value: evidence },
        { name: '🔄 التغيير', value: `تمت إزالة **WHITLIST** وإضافة **CALL UP**` },
      )
      .setTimestamp()
      .setFooter({ text: 'نظام الكول أب' });

    // زر إرجاع الرتبة
    const restoreButton = new ButtonBuilder()
      .setCustomId(`restore_${targetId}`)
      .setLabel('↩️ إرجاع الرتبة')
      .setStyle(ButtonStyle.Success);

    const restoreRow = new ActionRowBuilder().addComponents(restoreButton);

    await interaction.editReply({ content: '✅ تم تنفيذ الكول أب!' });

    // ── إرسال للقناة الثانية ──
    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ embeds: [embed], components: [restoreRow] });
    } catch (err) {
      console.error('خطأ في إرسال اللوق:', err);
    }
  }

  // ── زر إرجاع الرتبة ──
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
      .setColor(0x2ECC71)
      .setTitle('✅ تم إرجاع الرتبة')
      .addFields(
        { name: '👤 العضو', value: `${targetMember.user.tag} (${targetId})`, inline: true },
        { name: '👮 بواسطة', value: `${interaction.user.tag}`, inline: true },
        { name: '🔄 التغيير', value: `تمت إزالة **CALL UP** وإرجاع **WHITLIST**` },
      )
      .setTimestamp()
      .setFooter({ text: 'نظام الكول أب' });

    await interaction.editReply({ content: '✅ تم إرجاع الرتبة!' });

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ embeds: [restoreEmbed] });
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
