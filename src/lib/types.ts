export interface BotConfig {
  botName: string;
  prefix: string;
  botImage: string;
  ownerNumber: string;
  newsletterUrl: string;
  newsletterName: string;
}

export interface BotCommand {
  name: string;
  category: string;
  description: string;
  usage: string;
  aliases?: string[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  senderName: string;
  text: string;
  imageUrl?: string;
  emoji?: string;
  timestamp: string;
  isAudio?: boolean;
  audioDuration?: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "error";
