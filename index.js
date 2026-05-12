const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// ══════════════════════════════════════════
const WHITELIST_ROLE_ID  = '1443294946089242727';
const CALLUP_ROLE_ID     = '1502830142496575569';
const LOG_CHANNEL_ID     = '1503564649168244848';
const CALLUP_VC_ID       = '1503616176998187038'; // روم الكول أب الصوتي
// ══════════════════════════════════════════

// تخزين بيانات الكول أب { targetId -> { adminId, deadline, logMsgId, logChannelId } }
const callupData = new Map();

client.once('ready', () => {
  console.log(`✅ البوت شغّال: ${client.user.tag}`);
});

// ══════════════════════════════════════════
// مراقبة دخول روم الكول أب
// ══════════════════════════════════════════
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === CALLUP_VC_ID && oldState.channelId !== CALLUP_VC_ID) {
    const member = newState.member;
    const data = callupData.get(member.id);

    const notifyEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('✅ العضو دخل روم الكول أب')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
        { name: '⏰ الوقت', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
      )
      .setTimestamp();

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      // إبلاغ الاداري إذا موجود في البيانات
      if (data) {
        await logChannel.send({ content: `<@${data.adminId}> العضو <@${member.id}> دخل روم الكول أب!`, embeds: [notifyEmbed] });
      } else {
        await logChannel.send({ embeds: [notifyEmbed] });
      }
    } catch (err) {
      console.error(err);
    }
  }
});

// ══════════════════════════════════════════
// الإنتركشنز
// ══════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {

  // ── زر فتح الفورم ──
  if (interaction.isButton() && interaction.customId === 'open_callup_form') {
    const modal = new ModalBuilder()
      .setCustomId('callup_modal')
      .setTitle('📋 فورم الكول أب');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('user_id').setLabel('Copy ID الشخص').setStyle(TextInputStyle.Short).setPlaceholder('123456789012345678').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('السبب').setStyle(TextInputStyle.Paragraph).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('evidence').setLabel('الدليل (رابط)').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setRequired(true)
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── استقبال الفورم ──
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'callup_modal') {
    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.fields.getTextInputValue('user_id').trim();
    const reason   = interaction.fields.getTextInputValue('reason').trim();
    const evidence = interaction.fields.getTextInputValue('evidence').trim();
    const guild    = interaction.guild;
    let targetMember;

    try { targetMember = await guild.members.fetch(targetId); }
    catch { return interaction.editReply({ content: '❌ ما لقيت العضو!' }); }

    if (!targetMember.roles.cache.has(WHITELIST_ROLE_ID))
      return interaction.editReply({ content: `⚠️ **${targetMember.user.tag}** ما عنده رتبة WHITLIST.` });

    try {
      await targetMember.roles.remove(WHITELIST_ROLE_ID);
      await targetMember.roles.add(CALLUP_ROLE_ID);
    } catch {
      return interaction.editReply({ content: '❌ صار خطأ في تغيير الرتب.' });
    }

    // حفظ بيانات الكول أب
    const deadline = Math.floor(Date.now()/1000) + 86400; // 24 ساعة
    callupData.set(targetId, { adminId: interaction.user.id, deadline, extended: false });

    const evidenceText = evidence.startsWith('http') ? `[اضغط هنا للدليل](${evidence})` : evidence;

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
        { name: '⏰ الموعد النهائي', value: `<t:${deadline}:R>` },
        { name: '🔄 التغيير', value: '> ❌ إزالة **WHITLIST**\n> ✅ إضافة **CALL UP**' },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${targetId}` });

    // أزرار الإدارة
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`remind_admin_${targetId}`).setLabel('🔔 تذكير الاداري').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`remind_member_${targetId}`).setLabel('📩 تذكير الشخص').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`extend_${targetId}`).setLabel('⏳ تمديد المدة').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`restore_${targetId}`).setLabel('↩️ إرجاع الرتبة').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`restore_norole_${targetId}`).setLabel('🚪 إرجاع بدون رتبة').setStyle(ButtonStyle.Danger),
    );

    // رسالة خاصة للعضو
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

    try { await targetMember.send({ embeds: [dmEmbed] }); } catch {}

    await interaction.editReply({ content: '✅ تم تنفيذ الكول أب وإرسال رسالة خاصة!' });

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ content: `> تم تنفيذ كول أب على <@${targetId}>`, embeds: [embed], components: [row1, row2] });
    } catch (err) { console.error(err); }
  }

  // ══════════════════════════════════════════
  // أزرار الإدارة
  // ══════════════════════════════════════════

  // ── تذكير الاداري ──
  if (interaction.isButton() && interaction.customId.startsWith('remind_admin_')) {
    const targetId = interaction.customId.replace('remind_admin_', '');
    const data = callupData.get(targetId);
    const adminId = data ? data.adminId : null;

    await interaction.reply({ ephemeral: true, content: adminId
      ? `✅ تم إرسال تذكير لـ <@${adminId}>`
      : '⚠️ ما في اداري مسجل لهذا الكول أب'
    });

    if (adminId) {
      try {
        const admin = await client.users.fetch(adminId);
        await admin.send({
          embeds: [new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔔 تذكير — كول أب')
            .setDescription(`العضو <@${targetId}> لا يزال في الكول أب\nالموعد النهائي: <t:${data.deadline}:R>`)
            .setTimestamp()]
        });
      } catch {}
    }
  }

  // ── تذكير الشخص ──
  if (interaction.isButton() && interaction.customId.startsWith('remind_member_')) {
    const targetId = interaction.customId.replace('remind_member_', '');
    const data = callupData.get(targetId);

    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = await client.users.fetch(targetId);
      await targetUser.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFF6600)
          .setTitle('⚠️ تذكير — كول أب')
          .setDescription([
            '> لم تتوجه للكول أب بعد!',
            '',
            `> ⏰ الموعد النهائي: <t:${data ? data.deadline : Math.floor(Date.now()/1000)+3600}:R>`,
            '',
            '> في حال عدم توجهك سيتم محاسبتك بشكل فوري.',
          ].join('\n'))
          .setTimestamp()]
      });
      await interaction.editReply({ content: `✅ تم إرسال تذكير للعضو <@${targetId}>` });
    } catch {
      await interaction.editReply({ content: '❌ ما قدر يرسل رسالة خاصة، العضو أغلق الرسائل.' });
    }
  }

  // ── تمديد المدة ──
  if (interaction.isButton() && interaction.customId.startsWith('extend_')) {
    const targetId = interaction.customId.replace('extend_', '');
    const modal = new ModalBuilder()
      .setCustomId(`extend_modal_${targetId}`)
      .setTitle('⏳ تمديد مدة الكول أب');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('hours')
          .setLabel('كم ساعة تبي تمدد؟')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 12')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }

  // ── استقبال فورم التمديد ──
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('extend_modal_')) {
    const targetId = interaction.customId.replace('extend_modal_', '');
    const hours = parseInt(interaction.fields.getTextInputValue('hours'));

    if (isNaN(hours) || hours <= 0)
      return interaction.reply({ ephemeral: true, content: '❌ أدخل رقم صحيح.' });

    const data = callupData.get(targetId) || { adminId: interaction.user.id, deadline: Math.floor(Date.now()/1000), extended: false };
    data.deadline += hours * 3600;
    callupData.set(targetId, data);

    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⏳ تم تمديد المدة')
        .addFields(
          { name: '👤 العضو', value: `<@${targetId}>`, inline: true },
          { name: '➕ التمديد', value: `${hours} ساعة`, inline: true },
          { name: '⏰ الموعد الجديد', value: `<t:${data.deadline}:R>` },
        )
        .setTimestamp()]
    });

    // إبلاغ العضو بالتمديد
    try {
      const targetUser = await client.users.fetch(targetId);
      await targetUser.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⏳ تم تمديد مدة الكول أب')
          .setDescription(`> تم تمديد مدتك **${hours} ساعة** إضافية.\n> الموعد الجديد: <t:${data.deadline}:R>`)
          .setTimestamp()]
      });
    } catch {}
  }

  // ── إرجاع الرتبة ──
  if (interaction.isButton() && interaction.customId.startsWith('restore_') && !interaction.customId.startsWith('restore_norole_')) {
    await interaction.deferReply({ ephemeral: true });
    const targetId = interaction.customId.replace('restore_', '');
    const guild = interaction.guild;
    let targetMember;

    try { targetMember = await guild.members.fetch(targetId); }
    catch { return interaction.editReply({ content: '❌ ما لقيت العضو!' }); }

    try {
      await targetMember.roles.remove(CALLUP_ROLE_ID);
      await targetMember.roles.add(WHITELIST_ROLE_ID);
    } catch { return interaction.editReply({ content: '❌ صار خطأ.' }); }

    callupData.delete(targetId);

    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setAuthor({ name: '✅ تم إرجاع الرتبة', iconURL: client.user.displayAvatarURL() })
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 العضو', value: `<@${targetId}>`, inline: true },
        { name: '👮 بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🔄 التغيير', value: '> ❌ إزالة **CALL UP**\n> ✅ إرجاع **WHITLIST**' },
      )
      .setTimestamp();

    await interaction.editReply({ content: '✅ تم إرجاع الرتبة!' });
    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ content: `> تم إرجاع رتبة <@${targetId}>`, embeds: [embed] });
    } catch {}

    try { await targetMember.send({ embeds: [new EmbedBuilder().setColor(0x00FF7F).setTitle('✅ تم إنهاء الكول أب').setDescription('> تمت إعادة رتبتك بشكل كامل.').setTimestamp()] }); } catch {}
  }

  // ── إرجاع بدون رتبة ──
  if (interaction.isButton() && interaction.customId.startsWith('restore_norole_')) {
    await interaction.deferReply({ ephemeral: true });
    const targetId = interaction.customId.replace('restore_norole_', '');
    const guild = interaction.guild;
    let targetMember;

    try { targetMember = await guild.members.fetch(targetId); }
    catch { return interaction.editReply({ content: '❌ ما لقيت العضو!' }); }

    try {
      await targetMember.roles.remove(CALLUP_ROLE_ID);
    } catch { return interaction.editReply({ content: '❌ صار خطأ.' }); }

    callupData.delete(targetId);

    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setAuthor({ name: '🚪 إرجاع بدون رتبة', iconURL: client.user.displayAvatarURL() })
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 العضو', value: `<@${targetId}>`, inline: true },
        { name: '👮 بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🔄 التغيير', value: '> ❌ إزالة **CALL UP**\n> ⚠️ بدون إرجاع **WHITLIST**' },
      )
      .setTimestamp();

    await interaction.editReply({ content: '✅ تم إرجاع العضو بدون رتبة!' });
    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({ content: `> تم إرجاع <@${targetId}> بدون رتبة`, embeds: [embed] });
    } catch {}

    try { await targetMember.send({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle('🚪 تم إنهاء الكول أب').setDescription('> تم إنهاء الكول أب، تواصل مع الإدارة لمعرفة وضعك.').setTimestamp()] }); } catch {}
  }

});

client.login(process.env.DISCORD_TOKEN);
