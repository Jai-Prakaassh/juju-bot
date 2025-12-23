require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const { GoogleGenAI } = require("@google/genai");

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= GEMINI CLIENT =================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ================= MEMORY ==================
const userMemory = new Map(); // userId => [ { role, text } ]
const MAX_MEMORY = 8;

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ JUJU is online as ${client.user.tag}`);
});

// ================= MESSAGE HANDLER ==================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const userId = message.author.id;

    // Remove bot mention
    let content = message.content
      .replace(`<@${client.user.id}>`, "")
      .replace(`<@!${client.user.id}>`, "")
      .trim()
      .toLowerCase();

    // Timestamp
    const timestamp = new Date().toISOString();
    
    // Get server name or DM
    const serverName = message.guild ? message.guild.name : "DM";

    // Log USER message
    const userLine = `[${timestamp}] [${serverName}] USER ${message.author.tag}: ${message.content}`;
    console.log(userLine);
    fs.appendFileSync("bot_logs.txt", userLine + "\n");

    // ================= COMMANDS =================

    if (content === "reset") {
      userMemory.delete(userId);
      await message.reply("🧠 Memory reset ho gayi 😄");
      return;
    }

    if (content === "help") {
      await message.reply(
        "👋 **JUJU Commands**\n" +
        "• `reset` – clear memory\n" +
        "• `help` – show commands\n" +
        "• `ping` – check bot\n" +
        "• `about` – about JUJU\n" +
        "👉 Tag me and ask anything 😄"
      );
      return;
    }

    if (content === "ping") {
      await message.reply("🏓 Pong! JUJU zinda hai 😄");
      return;
    }

    if (content === "about") {
      await message.reply(
        "🤖 **JUJU**\nHinglish AI bot 😄\nBas tag karo aur sawaal pucho!"
      );
      return;
    }

    // ================= AI PART =================

    if (!userMemory.has(userId)) userMemory.set(userId, []);
    const memory = userMemory.get(userId);

    let prompt = content;
    if (message.reference?.messageId) {
      const repliedMsg = await message.channel.messages.fetch(
        message.reference.messageId
      );
      prompt =
        "User replied to this message:\n" +
        repliedMsg.content +
        "\n\nUser says:\n" +
        content;
    }

    const systemPrompt =
      "You are JUJU. Reply ONLY in Hinglish (Hindi + English). " +
      "Friendly, casual Indian tone. Never say you are an AI.";

    memory.push({ role: "user", text: prompt });
    if (memory.length > MAX_MEMORY) memory.shift();

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...memory.map((m) => ({
        role: "user",
        parts: [{ text: m.text }],
      })),
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
    });

    const reply =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Thoda issue aa gaya 😅";

    memory.push({ role: "assistant", text: reply });
    if (memory.length > MAX_MEMORY) memory.shift();

    await message.reply(reply);

    // Log the bot's response after sending it
    const botLine = `[${timestamp}] [${serverName}] BOT JUJU: ${reply}`;
    console.log(botLine);
    fs.appendFileSync("bot_logs.txt", botLine + "\n");

    } catch (err) {
    console.error("❌ Gemini error:", err);
    await message.reply("❌ Thoda issue aa gaya 😕");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
