export interface BotCommandContext {
  sender: string;
  senderName: string;
  isOwner: boolean;
  /** True when the sender is a group admin (always false outside groups). */
  isAdmin: boolean;
  prefix: string;
  commandName: string;
  args: string[];
  fullMessage: string;
  reply: (text: string, mediaUrl?: string) => Promise<any>;
  react: (emoji: string) => Promise<any>;
  downloadMedia?: () => Promise<Buffer | null>;
}

export interface BotCommand {
  name: string;
  category: string;
  description: string;
  usage?: string;
  aliases?: string[];
  execute: (sock: any, msg: any, context: BotCommandContext) => Promise<void> | void;
}
