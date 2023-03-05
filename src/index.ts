
import * as dotenv from "dotenv";
import { Readable } from 'stream';
dotenv.config();

import TelegramBot from "node-telegram-bot-api";
import { preparePrompt } from "./utils";
import {
  fetchChatCompletion,
  fetchCompletionStream,
  fetchImageGenerationResponse,
} from "./api";

const PHRASE_LEN = 30;
const CHAT_MESSAGES = {};
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function handleChatCompletion(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    // append user input
    if (CHAT_MESSAGES[chatId]) {
      CHAT_MESSAGES[chatId].push({ role: 'user', content: prompt });
    } else {
      CHAT_MESSAGES[chatId] = [{ role: 'user', content: prompt }];
    }
    const response = await fetchChatCompletion(CHAT_MESSAGES[chatId]);
    const { choices = [] } = response || {};
    // append assistant response
    if (choices[0]?.message) {
      CHAT_MESSAGES[chatId].push(choices[0]?.message)
    }
    bot.editMessageText(choices?.[0]?.message?.content, {
      parse_mode: 'Markdown',
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    console.log(error.message);
    bot.editMessageText(`❗ ${JSON.stringify(error, null, 4)}`, {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}

// TODO: FIX: optimise stream in group chat (too many telegram requests)
async function handleCompletionStream(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    const { data }: any = await fetchCompletionStream(prompt);
    const readable = Readable.from(data, { encoding: 'utf8' });
    let queue = '';
    let fullMessage = '';
    let tempPhrase = '';

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
        while (queue.length) {
          fullMessage += queue.slice(0, PHRASE_LEN);
          queue = queue.slice(PHRASE_LEN);
          await bot.editMessageText(fullMessage, {
            chat_id: chatId,
            message_id: messageId,
          });
        }
      } catch (e) {
        console.error('PARSE STREAM FAIL', e);
        bot.editMessageText(`❗ ${JSON.stringify(e)}`, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    });

    // NOTE: [EDGE CASE] end of stream is reached and program is
    // still accumulating words for a decent phrase to send out
    readable.on('end', async () => {
      if (!tempPhrase) return;
      bot.editMessageText(fullMessage + tempPhrase, {
        chat_id: chatId,
        message_id: messageId,
      });
    })
  } catch (error) {
    let errorMsg = '';
    if (error.response) {
      console.log(error.response.data);
      errorMsg = `[${error.response.status}][${error.response.data.error.type}]: ${error.response.data.error.message}`;
    } else {
      errorMsg = error.message;
    }
    bot.editMessageText(`❗ ${errorMsg}`, {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}

async function handleImageGeneration(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  let originalMessageDeleted = false;
  try {
    const { data: response } = await fetchImageGenerationResponse(prompt);
    const { data = [] } = response || {};
    data.forEach(async (obj) => {
      if (obj.url) {
        await bot.sendPhoto(chatId, obj.url);
        if (!originalMessageDeleted) {
          bot.deleteMessage(chatId, messageId.toString());
          originalMessageDeleted = true;
        }
      }
    });
  } catch (error) {
    let errorMsg = '';
    if (error.response) {
      console.log(error.response.data);
      errorMsg = `[${error.response.status}][${error.response.data.error.type}]: ${error.response.data.error.message}`;
    } else {
      errorMsg = error.message;
    }
    bot.editMessageText(`❗ ${errorMsg}`, {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}

bot.on('message', async (msg) => {
  console.log(msg);
  const prompt = preparePrompt(msg);
  if (!prompt) return;

  const chatId = msg.chat.id;

  if (prompt.includes('image') || prompt.includes('img') || prompt.includes('picture')) {
    handleImageGeneration(chatId, prompt);
  }
  else {
    handleChatCompletion(chatId, prompt);
    // handleCompletionStream(chatId, prompt);
  }
});