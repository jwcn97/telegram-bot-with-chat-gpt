
import * as dotenv from "dotenv";
import { Readable } from 'stream';
dotenv.config();

import TelegramBot from "node-telegram-bot-api";
import { preparePrompt } from "./utils";
import { fetchCompletionResponse, fetchCompletionResponseTest, fetchImageGenerationResponse } from "./api";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const queue = [];

async function handleCompletionStream(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    const { data }: any = await fetchCompletionResponseTest(prompt);
    const readable = Readable.from(data, { encoding: 'utf8' });
    let phrase = '';
    let tempPhrase = '';
    let maxHoldingLength = 20;

    // TODO: assumption that stream is quicker than dequeue and editting message process
    readable.on('data', async (d) => {
      const jsonText = d.replace('data: ', '');
      if (!jsonText || jsonText.includes('[DONE]')) return;
      try {
        const res = JSON.parse(jsonText);
        const text = res?.choices?.[0]?.text;

        // accumulate words until a phrase is formed
        tempPhrase += text;
        if (tempPhrase.length < maxHoldingLength) return;

        // append phrase to queue
        queue.push(tempPhrase);
        tempPhrase = '';
        if (phrase) return;

        // dequeue and edit message
        while (queue.length) {
          phrase += queue.shift();
          await bot.editMessageText(phrase, {
            chat_id: chatId,
            message_id: messageId,
          });
        }
        
        // append any remaining words to the message
        if (tempPhrase) {
          phrase += tempPhrase
          tempPhrase = '';
          await bot.editMessageText(phrase, {
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

async function handleCompletion(chatId: number, prompt: string): Promise<void> {
  const { message_id: messageId } = await bot.sendMessage(chatId, '⌛...');
  try {
    const { data: response } = await fetchCompletionResponse(prompt);
    const { choices = [] } = response || {};
    if (choices.length) {
      bot.editMessageText(choices[0].text, {
        chat_id: chatId,
        message_id: messageId,
      })
    }
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

bot.on('message', async (msg) => {
  console.log(msg);
  const prompt = preparePrompt(msg);
  if (!prompt) return;

  const chatId = msg.chat.id;

  if (prompt.includes('image') || prompt.includes('img') || prompt.includes('picture')) {
    handleImageGeneration(chatId, prompt);
  } else if (prompt.includes('story')) {
    handleCompletionStream(chatId, prompt);
  } else {
    handleCompletion(chatId, prompt);
  }
});