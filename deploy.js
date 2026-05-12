// deploy.js - شغّله مرة وحدة عشان يرسل زر الكول أب للقناة
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channelId = process.env.CALLUP_CHANNEL_ID;
  if (!channelId) {
    console.error('❌ حط CALLUP_CHANNEL_ID في الـ .env');
    process.exit(1);
  }

  const channel = await client.channels.fetch(channelId);

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🚨 نظام الكول أب')
    .setDescription('اضغط الزر أدناه لفتح فورم الكول أب\nسيتم إزالة رتبة **WHITLIST** وإعطاء رتبة **CALL UP**')
    .setFooter({ text: 'فقط المخوّلين يمكنهم استخدام هذا الزر' });

  const button = new ButtonBuilder()
    .setCustomId('open_callup_form')
    .setLabel('📋 فتح فورم الكول أب')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ تم إرسال الزر للقناة!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
