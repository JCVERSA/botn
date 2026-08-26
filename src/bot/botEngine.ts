import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import pino from "pino";
import { Boom } from "@hapi/boom";
import fs from "fs";
import { getConfig } from "./config.js";
import { getCommand, initRegistry } from "./commandRegistry.js";
import { BotCommandContext } from "./types.js";
import { incrementCommandStats } from "./commandStats.js";
import { database } from "./database.js";

const groupMetadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

async function getCachedGroupMetadata(sock: any, groupId: string) {
  const cached = groupMetadataCache.get(groupId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  try {
    const metadata = await sock.groupMetadata(groupId);
    groupMetadataCache.set(groupId, { data: metadata, timestamp: Date.now() });
    return metadata;
  } catch (err) {
    return cached ? cached.data : null;
  }
}

export type ConnectionStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "error";

interface BotState {
  status: ConnectionStatus;
  qrCode: string;
  logs: string[];
  socket: any | null;
  reconnectCount: number;
  reconnectTimeout?: NodeJS.Timeout | null;
}

const botState: BotState = {
  status: "disconnected",
  qrCode: "",
  logs: ["🤖 Nebula Bot Engine initialized. Ready to start."],
  socket: null,
  reconnectCount: 0,
  reconnectTimeout: null,
};

export function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  botState.logs.push(formattedLog);
  // Keep logs capped at 200 items for memory efficiency
  if (botState.logs.length > 200) {
    botState.logs.shift();
  }
  console.log(formattedLog);
}

export function getBotState() {
  return {
    status: botState.status,
    qrCode: botState.qrCode,
    logs: botState.logs,
  };
}

export function clearLogs() {
  botState.logs = ["🤖 Logs cleared."];
}

// Simulated execution for the web play-zone
export async function simulateMessage(senderName: string, text: string): Promise<{ text: string; imageUrl?: string; emoji?: string }> {
  addLog(`[Simulator] Message from ${senderName}: "${text}"`);
  
  const config = getConfig();
  const prefix = config.prefix;

  if (text === "🎙️ [Voice Note]") {
    return {
      text: `🎙️ *Nebula Audio Processor:* Voice note of *0:07* received successfully.\n\n_I have parsed the binary stream buffer and visualized the wave frequencies. Type \`${prefix}menu\` to see what textual commands you can send!_`,
      emoji: "🎵"
    };
  }
  
  // Check if starts with prefix
  if (!text.startsWith(prefix)) {
    return { text: `🤖 Hello! I am ${config.botName}. Type \`${prefix}menu\` to see what I can do!` };
  }

  // Parse command
  const body = text.slice(prefix.length).trim();
  const args = body.split(/\s+/);
  const commandName = args.shift()?.toLowerCase() || "";
  
  const command = getCommand(commandName);
  if (!command) {
    return { text: `❌ *Error:* Command \`${prefix}${commandName}\` not found. Type \`${prefix}menu\` for a list of commands.` };
  }

  let replyText = "";
  let replyImageUrl: string | undefined = undefined;
  let reactionEmoji: string | undefined = undefined;

  // Mock context
  const mockContext: BotCommandContext = {
    sender: "1234567890@s.whatsapp.net",
    senderName,
    isOwner: true, // Simulator user is simulated as owner to test all commands
    prefix,
    commandName,
    args,
    fullMessage: text,
    reply: async (replyMsg: string, mediaUrl?: string) => {
      replyText = replyMsg;
      replyImageUrl = mediaUrl;
      addLog(`[Simulator Reply] ${replyMsg.slice(0, 100)}${replyMsg.length > 100 ? "..." : ""}`);
      return {};
    },
    react: async (emoji: string) => {
      reactionEmoji = emoji;
      addLog(`[Simulator Reaction] ${emoji}`);
      return {};
    },
    downloadMedia: async () => {
      addLog(`[Simulator Media] Simulated downloading dummy media.`);
      return Buffer.from("dummy media");
    }
  };

  try {
    incrementCommandStats(commandName);
    await command.execute(null, null, mockContext);
    return { text: replyText, imageUrl: replyImageUrl, emoji: reactionEmoji };
  } catch (error: any) {
    addLog(`[Simulator Error] Failed to execute ${commandName}: ${error.message}`);
    return { text: `❌ *System Error executing command:* ${error.message || error}` };
  }
}

// Live Baileys startup
export async function startLiveBot() {
  if (botState.status === "connected" || botState.status === "connecting" || botState.status === "qr_ready") {
    addLog("⚠️ Bot is already running, connecting, or waiting for QR scan.");
    return;
  }

  // Clear any pending reconnection timer
  if (botState.reconnectTimeout) {
    clearTimeout(botState.reconnectTimeout);
    botState.reconnectTimeout = null;
  }

  // Safely end any lingering socket to prevent duplicate connections and conflict events
  if (botState.socket) {
    try {
      addLog("🧹 Cleaning up duplicate/lingering socket connection...");
      botState.socket.isClosedByEngine = true;
      botState.socket.end();
    } catch (e) {}
    botState.socket = null;
  }

  addLog("🔌 Starting Baileys Live Connection...");
  botState.status = "connecting";
  botState.qrCode = "";
  botState.reconnectCount = 0; // Reset reconnection attempts when manually starting

  try {
    initRegistry();
    
    // Auth state directory
    const { state, saveCreds } = await useMultiFileAuthState("nebula_auth_info");
    const { version } = await fetchLatestBaileysVersion();
    
    addLog(`🌐 Connecting to WhatsApp using Web API version ${version.join(".")}`);
    
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: ["Nebula Bot Panel", "Chrome", "1.0.0"],
    });

    botState.socket = sock;

    // Listen to connection updates
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        botState.status = "qr_ready";
        botState.qrCode = qr;
        addLog("📟 QR Code generated. Scan to login!");
      }

      if (connection === "connecting") {
        botState.status = "connecting";
        addLog("⚡ Re-establishing WebSocket connection...");
      }

      if (connection === "open") {
        botState.status = "connected";
        botState.qrCode = "";
        botState.reconnectCount = 0;
        addLog("✅ Nebula Bot is officially CONNECTED to WhatsApp!");
        
        // Notify owner if number configured
        const config = getConfig();
        if (config.ownerNumber) {
          const ownerJid = `${config.ownerNumber.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
          sock.sendMessage(ownerJid, { text: `🌌 *${config.botName}* is online and connected!\nPrefix: \`${config.prefix}\`` }).catch(() => {});
        }
      }

      if (connection === "close") {
        if ((sock as any).isClosedByEngine) {
          addLog("🧹 Ignored close event of superseded/closed socket.");
          return;
        }

        botState.qrCode = "";
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        // If logged out or bad session, we must stop reconnection and clear directory to prevent "Stream Errored (conflict)" loops
        const isBadSession = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession || statusCode === 403;
        const shouldReconnect = !isBadSession;
        
        addLog(`❌ Connection closed. Reason: ${lastDisconnect?.error?.message || "unknown"} (Status Code: ${statusCode}). Reconnect: ${shouldReconnect}`);
        
        botState.status = "disconnected";
        botState.socket = null;

        if (isBadSession) {
          addLog("🗑️ Session is bad, logged out, or forbidden. Clearing stored credentials to allow a fresh scan...");
          try {
            if (fs.existsSync("nebula_auth_info")) {
              fs.rmSync("nebula_auth_info", { recursive: true, force: true });
              addLog("✨ Stored credentials cleared successfully.");
            }
          } catch (e: any) {
            addLog(`⚠️ Failed to clear credentials: ${e.message}`);
          }
        }

        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

        if (shouldReconnect) {
          let delayMs = 5000;
          if (isRestartRequired) {
            delayMs = 1000;
            addLog("🔄 WhatsApp server requested restart. Reconnecting in 1 second without consuming failure retry budget...");
          } else {
            if (botState.reconnectCount >= 5) {
              addLog("🚫 Reconnection failure limit reached. Bot stopped.");
              return;
            }
            botState.reconnectCount++;
            addLog(`🔄 Attempting reconnect (${botState.reconnectCount}/5) in 5 seconds...`);
          }
          
          if (botState.reconnectTimeout) {
            clearTimeout(botState.reconnectTimeout);
          }
          
          // Mark this socket as superseded so future duplicate close events are discarded
          (sock as any).isClosedByEngine = true;
          
          botState.reconnectTimeout = setTimeout(() => {
            botState.reconnectTimeout = null;
            startLiveBot();
          }, delayMs);
        } else {
          addLog("🚫 Logged out or bad session. Bot stopped.");
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // Message handler with memory guards
    sock.ev.on("messages.upsert", async (m) => {
      if (m.type !== "notify") return;
      
      for (const msg of m.messages) {
        if (!msg.message) continue;

        // Unwrap ephemeral, viewOnce, or other wrapper messages
        let messageContent = msg.message;
        if (messageContent.ephemeralMessage) {
          messageContent = messageContent.ephemeralMessage.message || {};
        }
        if (messageContent.viewOnceMessage) {
          messageContent = messageContent.viewOnceMessage.message || {};
        }
        if (messageContent.viewOnceMessageV2) {
          messageContent = messageContent.viewOnceMessageV2.message || {};
        }
        if (messageContent.documentWithCaptionMessage) {
          messageContent = messageContent.documentWithCaptionMessage.message || {};
        }

        if (!messageContent) continue;

        // Extract text from the unwrapped message
        const text = messageContent.conversation || 
                     messageContent.extendedTextMessage?.text || 
                     messageContent.imageMessage?.caption || 
                     messageContent.videoMessage?.caption || 
                     messageContent.templateButtonReplyMessage?.selectedId ||
                     messageContent.buttonsResponseMessage?.selectedButtonId ||
                     messageContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
                     "";

        const config = getConfig();
        const prefix = config.prefix;
        const senderJid = msg.key.remoteJid || "";
        const senderNumber = senderJid.split("@")[0];
        const senderName = msg.pushName || "WhatsApp User";
        const isFromMe = !!msg.key.fromMe;

        // Extract precise actual sender info (handles group participants vs DM)
        const actualSenderJid = msg.key.participant || msg.key.remoteJid || "";
        const actualSenderNumber = actualSenderJid.split("@")[0].replace(/[^0-9]/g, "");
        const isOwner = actualSenderNumber === config.ownerNumber.replace(/[^0-9]/g, "");

        // Add visual live logs to the dashboard so the user knows messages are being processed
        if (text.trim()) {
          addLog(`📨 Message Received: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}" from ${senderName} (${senderNumber}) [fromMe: ${isFromMe}]`);
        }

        // Active Group Moderation Engine
        const isGroup = senderJid.endsWith("@g.us");
        if (isGroup && !isFromMe) {
          const settings = database.getGroupSettings(senderJid);
          let isSenderAdmin = false;
          let isBotAdmin = false;

          try {
            const groupMetadata = await getCachedGroupMetadata(sock, senderJid);
            if (groupMetadata) {
              const botJid = sock.user?.id ? (sock.user.id.split(":")[0] + "@s.whatsapp.net") : "";
              const senderParticipant = groupMetadata.participants.find((p: any) => p.id.split("@")[0] === actualSenderNumber);
              const botParticipant = groupMetadata.participants.find((p: any) => p.id.split("@")[0] === botJid.split("@")[0]);

              isSenderAdmin = senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin";
              isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";
            }
          } catch (e) {}

          // 1. Antilink Filtering
          if (settings.antilink && !isSenderAdmin && !isOwner) {
            const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
            if (linkRegex.test(text)) {
              addLog(`🛡️ [Antilink] Link message detected from @${actualSenderNumber} in group ${senderJid}`);
              
              if (isBotAdmin) {
                await sock.sendMessage(senderJid, { delete: msg.key });
                
                if (settings.antilinkAction === "kick") {
                  await sock.groupParticipantsUpdate(senderJid, [actualSenderJid], "remove");
                  await sock.sendMessage(senderJid, {
                    text: `🚫 *Antilink enforcement:* @${actualSenderNumber} has been kicked for sharing WhatsApp group invites.`,
                    mentions: [actualSenderJid]
                  });
                } else {
                  await sock.sendMessage(senderJid, {
                    text: `⚠️ *Antilink warning:* Invite links are prohibited, @${actualSenderNumber}.`,
                    mentions: [actualSenderJid]
                  });
                }
              }
              continue; // Prevent command execution / normal message processing
            }
          }

          // 2. Antitag (Mass Mentions) Filtering
          if (settings.antitag && !isSenderAdmin && !isOwner) {
            const ctxInfo = msg.message?.extendedTextMessage?.contextInfo || messageContent?.extendedTextMessage?.contextInfo;
            const mentionedJids = ctxInfo?.mentionedJid || [];
            if (mentionedJids.length >= 4) {
              addLog(`🛡️ [Antitag] Mass mention (${mentionedJids.length} tags) detected from @${actualSenderNumber}`);
              
              if (isBotAdmin) {
                await sock.sendMessage(senderJid, { delete: msg.key });
                
                if (settings.antitagAction === "kick") {
                  await sock.groupParticipantsUpdate(senderJid, [actualSenderJid], "remove");
                  await sock.sendMessage(senderJid, {
                    text: `🚫 *Antitag enforcement:* @${actualSenderNumber} has been kicked for mass mentioning group members.`,
                    mentions: [actualSenderJid]
                  });
                } else {
                  await sock.sendMessage(senderJid, {
                    text: `⚠️ *Antitag warning:* Mass mentions are disabled in this group, @${actualSenderNumber}.`,
                    mentions: [actualSenderJid]
                  });
                }
              }
              continue; // Prevent command execution / normal message processing
            }
          }
        }

        // Allow owner to run commands on their own session, but ignore regular self messages that don't start with prefix
        if (isFromMe && !text.startsWith(prefix)) {
          continue;
        }

        if (!text.startsWith(prefix)) continue;

        const body = text.slice(prefix.length).trim();
        const args = body.split(/\s+/);
        const commandName = args.shift()?.toLowerCase() || "";
        
        const command = getCommand(commandName);
        if (!command) {
          addLog(`⚠️ Unknown or dynamically excluded command: "${commandName}"`);
          continue;
        }

        // Build dynamic reply and react handlers
        const replyHandler = async (textStr: string, mediaUrl?: string) => {
          try {
            if (mediaUrl) {
              return await sock.sendMessage(senderJid, { 
                image: { url: mediaUrl }, 
                caption: textStr 
              }, { quoted: msg });
            } else {
              return await sock.sendMessage(senderJid, { text: textStr }, { quoted: msg });
            }
          } catch (e: any) {
            addLog(`Error sending message: ${e.message}`);
          }
        };

        const reactHandler = async (emoji: string) => {
          try {
            return await sock.sendMessage(senderJid, {
              react: { text: emoji, key: msg.key }
            });
          } catch (e: any) {
            addLog(`Error reacting: ${e.message}`);
          }
        };

        // Sensible media handling - dynamic buffer downloader
        const mediaDownloader = async (): Promise<Buffer | null> => {
          try {
            const messageType = Object.keys(msg.message!)[0];
            if (!["imageMessage", "videoMessage", "documentMessage", "audioMessage"].includes(messageType)) {
              return null;
            }
            
            addLog(`Downloading media content of type: ${messageType}`);
            const stream = await (sock as any).downloadContentFromMessage(
              msg.message![messageType as keyof typeof msg.message],
              messageType.replace("Message", "")
            );
            
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Log memory safe usage
            addLog(`Media download finished. Buffer size: ${Math.round(buffer.length / 1024)} KB.`);
            return buffer;
          } catch (err: any) {
            addLog(`Media download failed: ${err.message}`);
            return null;
          }
        };

        const context: BotCommandContext = {
          sender: senderJid,
          senderName,
          isOwner,
          prefix,
          commandName,
          args,
          fullMessage: text,
          reply: replyHandler,
          react: reactHandler,
          downloadMedia: mediaDownloader,
        };

        addLog(`💬 Executing dynamic command: [${commandName}] for ${senderName} (${senderNumber})`);
        
        try {
          incrementCommandStats(commandName);
          await command.execute(sock, msg, context);
        } catch (err: any) {
          addLog(`❌ Error in ${commandName}: ${err.message || err}`);
          await replyHandler(`❌ *Nebula Error:* Failed to execute command \`${commandName}\`.\nReason: ${err.message || err}`);
        }
      }
    });

  } catch (error: any) {
    botState.status = "error";
    addLog(`❌ Failed to start bot connection: ${error.message || error}`);
  }
}

export function stopLiveBot() {
  if (botState.reconnectTimeout) {
    clearTimeout(botState.reconnectTimeout);
    botState.reconnectTimeout = null;
  }
  if (botState.socket) {
    try {
      botState.socket.isClosedByEngine = true;
      botState.socket.end();
    } catch (e) {}
    botState.socket = null;
  }
  botState.status = "disconnected";
  botState.qrCode = "";
  addLog("🔌 Baileys Live Connection stopped manually.");
}
