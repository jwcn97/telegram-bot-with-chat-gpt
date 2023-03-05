
import * as dotenv from "dotenv";
import { Readable } from 'stream';
dotenv.config();

import TelegramBot from "node-telegram-bot-api";
import { preparePrompt } from "./utils";
import { fetchCompletionResponse, fetchImageGenerationResponse, modelAPI } from "./api";

const PHRASE_LEN = 30;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function handleCompletion(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    const { data }: any = await fetchCompletionResponse(prompt);
    const readable = Readable.from(data, { encoding: 'utf8' });
    let queue = '';
    let fullMessage = '';
    let tempPhrase = '';

    // TODO: assumption: stream is quicker than dequeue / message-editing process
    readable.on('data', async (d) => {
      const jsonText = d.replace('data: ', '');
      if (!jsonText) return;
      
      // NOTE: [EDGE CASE] full message is shorter than phrase length
      if (jsonText.includes('[DONE]')) {
        fullMessage += tempPhrase.slice(0, PHRASE_LEN);
        await bot.editMessageText(fullMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
        return;
      }

      try {
        const res = JSON.parse(jsonText);
        const text = res?.choices?.[0]?.text;

        // accumulate words until a phrase is formed
        tempPhrase += text;
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
        
        // append any remaining words to the message
        if (tempPhrase) {
          fullMessage += tempPhrase
          tempPhrase = '';
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
  try {
    const { data: response } = await fetchImageGenerationResponse(prompt);
    const { data = [] } = response || {};
    data.forEach(async (obj) => {
      if (obj.url) {
        await bot.sendPhoto(chatId, obj.url);
        bot.deleteMessage(chatId, messageId.toString());
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

async function handleGenericPrompt(chatId, prompt) {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    const { choices = [] } = await modelAPI(prompt);
    bot.editMessageText(choices?.[0]?.message?.content, {
      parse_mode: 'Markdown',
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    console.log(error.message);
    bot.editMessageText(`❗ ${JSON.stringify(error, null, 2)}`, {
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
  else if (prompt.includes('story') || prompt.includes('how')) {
    handleCompletion(chatId, prompt);
  }
  else {
    handleGenericPrompt(chatId, prompt);
  }
});