import * as dotenv from 'dotenv';
import { Readable } from 'stream';
dotenv.config();

import { ChatCompletionRequestMessageRoleEnum } from 'openai';
import TelegramBot from 'node-telegram-bot-api';
import { chatModule, preparePrompt, handleChineseCharacters } from './utils';
import {
  fetchChatCompletion,
  fetchCompletionStream,
  fetchImageGeneration,
} from './api';

import type { Message } from 'node-telegram-bot-api';

const PHRASE_LEN = 30;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function handleChatCompletion(
  msg: Message,
  prompt: string
): Promise<void> {
  const { from, chat } = msg;
  const { message_id: messageId } = await bot.sendMessage(chat.id, '💭...⌛');

  chatModule.addMessage(chat.id, {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: prompt,
    name: handleChineseCharacters(from.first_name),
  });
  const { data, errorMsg } = await fetchChatCompletion({ chatId: chat.id });
  if (errorMsg) {
    chatModule.deleteLastMessageInChat(chat.id);
    bot.editMessageText(`❗ ${errorMsg}`, {
      chat_id: chat.id,
      message_id: messageId,
    });
    return;
  }

  const { choices = [] } = data || {};
  chatModule.addMessage(chat.id, choices?.[0]?.message);
  bot.editMessageText(choices?.[0]?.message?.content, {
    parse_mode: 'Markdown',
    chat_id: chat.id,
    message_id: messageId,
  });
}

async function handleCompletionStream(
  msg: Message,
  prompt: string
): Promise<void> {
  const { chat } = msg;
  const { message_id: messageId } = await bot.sendMessage(chat.id, '💭...⌛');
  const { data, errorMsg }: { data: Iterable<any>; errorMsg: string } =
    await fetchCompletionStream({ prompt });
  if (errorMsg) {
    bot.editMessageText(`❗ ${errorMsg}`, {
      chat_id: chat.id,
      message_id: messageId,
    });
    return;
  }

  let queue = '';
  let fullMessage = '';
  let tempPhrase = '';
  const readable = Readable.from(data, { encoding: 'utf8' });

  // TODO: assumption: stream is quicker than dequeue / message-editing process
  readable.on('data', async (d) => {
    const jsonText = d.replace('data: ', '');
    if (!jsonText || jsonText.includes('[DONE]')) return;
    try {
      const res = JSON.parse(jsonText);
      // accumulate words until a phrase is formed
      tempPhrase += res?.choices?.[0]?.text || '';
      if (tempPhrase.length < PHRASE_LEN) return;
      // append phrase to queue
      queue += tempPhrase;
      tempPhrase = '';
      if (fullMessage) return;
      // dequeue and edit message
      while (queue) {
        fullMessage += queue.slice(0, PHRASE_LEN);
        queue = queue.slice(PHRASE_LEN);
        await bot.editMessageText(fullMessage, {
          chat_id: chat.id,
          message_id: messageId,
        });
      }
    } catch (e) {
      console.error('PARSE STREAM FAIL', e);
    }
  });

  // NOTE: [EDGE CASE] end of stream is reached and program is
  // still accumulating words for a decent phrase to send out
  readable.on('end', async () => {
    if (!tempPhrase) return;
    bot.editMessageText(fullMessage + tempPhrase, {
      chat_id: chat.id,
      message_id: messageId,
    });
  });
}

async function handleImageGeneration(
  msg: Message,
  prompt: string
): Promise<void> {
  const { from, chat } = msg;
  const { message_id: messageId } = await bot.sendMessage(chat.id, '💭...⌛');
  let originalMessageDeleted = false;
  const { data: response, errorMsg } = await fetchImageGeneration({ prompt });
  if (errorMsg) {
    bot.editMessageText(`❗ ${errorMsg}`, {
      chat_id: chat.id,
      message_id: messageId,
    });
    return;
  }

  // update chat status for chatgpt to have context when referring back
  chatModule.addMessage(chat.id, {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: prompt,
    name: handleChineseCharacters(from.first_name),
  });
  chatModule.addMessage(chat.id, {
    role: ChatCompletionRequestMessageRoleEnum.Assistant,
    content: `here is ${prompt}`,
  });

  const { data = [] } = response || {};
  data.forEach(async (obj) => {
    if (obj.url) {
      await bot.sendPhoto(chat.id, obj.url);
      if (!originalMessageDeleted) {
        bot.deleteMessage(chat.id, messageId.toString());
        originalMessageDeleted = true;
      }
    }
  });
}

bot.setMyCommands(
  [
    {
      command: '/image',
      description: '(e.g. "/image of a seal")',
    },
    {
      command: '/story',
      description: '(e.g. "/story of australia")',
    },
    {
      command: '/clearconvo',
      description: 'ask chatgpt to forget the current convo',
    },
  ],
  {
    scope: {
      type: 'all_private_chats',
    },
  }
);

bot.on('message', async (msg) => {
  const { command, prompt } = preparePrompt(msg);
  if (!command) return;
  if (['image', 'story'].includes(command) && command === prompt) {
    bot.sendMessage(
      msg.chat.id,
      'Please input a prompt after the command, e.g:\n`/[command] [prompt]`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  console.log('\nCOMMAND:', command, '\nPROMPT:', prompt);

  // const commands = await bot.getMyCommands({ type: 'all_private_chats' });

  switch (command) {
    case 'clearconvo':
      chatModule.clearChat(msg.chat.id);
      bot.sendMessage(msg.chat.id, 'Chat cleared');
      break;
    case 'image':
      handleImageGeneration(msg, prompt);
      break;
    case 'story':
      // TODO: FIX: optimise stream in group chat (too many telegram requests)
      if (msg.chat.type !== 'private') {
        handleChatCompletion(msg, prompt);
      } else {
        handleCompletionStream(msg, prompt);
      }
      break;
    case 'default':
      handleChatCompletion(msg, prompt);
      break;
    default:
      // bot.sendMessage(
      //   msg.chat.id,
      //   'Please input one of the valid commands below\n\n' +
      //     commands
      //       .map((obj) => '/' + obj.command + ' : ' + obj.description)
      //       .join('\n')
      // );
      break;
  }
});
