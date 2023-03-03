import type { Message } from "node-telegram-bot-api";

export function preparePrompt({ chat, text, entities = [] }: Message): string | undefined {
  if (chat.type === 'private') {
    return text;
  }

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (
      entity.type === 'mention' &&
      text.slice(entity.offset, entity.length) === '@zerealchatgptbot'
    ) {
      return text.substring(0, entity.offset) + text.substring(entity.length);
    }
  }
};

// export function getContext({}) {

// }
