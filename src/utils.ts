import type { ChatCompletionRequestMessage } from "openai";
import type { Message } from "node-telegram-bot-api";

class ChatMessages {
  chatMessages: Record<string, Array<ChatCompletionRequestMessage>>;
  constructor() {
    this.chatMessages = {};
  }

  public getMessages(chatId: number): Array<ChatCompletionRequestMessage> {
    return this.chatMessages[chatId];
  }

  public addMessage(chatId: number, message: ChatCompletionRequestMessage): void {
    if (!message) return;
    if (this.chatMessages[chatId]) {
      this.chatMessages[chatId].push(message);
    } else {
      this.chatMessages[chatId] = [message];
    }
  }

  public deleteLastMessageInChat(chatId: number): void {
    if (this.chatMessages[chatId]) {
      this.chatMessages[chatId].pop();
    }
  }

  public clearChat(chatId: number): void {
    delete this.chatMessages[chatId];
  }

  public clearAllChats(): void {
    this.chatMessages = {};
  }
}
const chatModule = new ChatMessages();
export { chatModule };

export function preparePrompt({ chat, text, entities = [] }: Message): { command?: string; prompt?: string; } {
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    // bot-commands
    if (entity.type === 'bot_command') {
      return {
        command: text.slice(entity.offset + 1, entity.offset + entity.length).replace('@zerealchatgptbot',''),
        prompt: text.substring(0, entity.offset) + text.substring(entity.offset + 1).replace('@zerealchatgptbot',''),
      };
    }
    // bot-mentions
    if (
      entity.type === 'mention' &&
      text.slice(entity.offset, entity.length) === '@zerealchatgptbot'
    ) {
      return {
        command: 'default',
        prompt: text.substring(0, entity.offset) + text.substring(entity.length),
      };
    }
  }
  // normal text in private chats
  if (chat.type === 'private') {
    return {
      command: 'default',
      prompt: text,
    };
  }
  // invalid commands
  return {};
};

export function handleChineseCharacters(str: string): string {
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g.test(str)) {
    return 'name';
  }
  return str;
}
