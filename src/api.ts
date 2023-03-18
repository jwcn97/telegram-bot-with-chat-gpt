import { Configuration, OpenAIApi } from 'openai';
import { chatModule } from './utils';

const apiKey = process.env.OPENAI_TOKEN;
const configuration = new Configuration({ apiKey });
const openai = new OpenAIApi(configuration);

type DefaultArgType = Record<string, unknown>;
type DefaultReturnType = any;

/**
 * low level fetch function which handles error handling
 * @param func async function to be called
 * @returns
 */
function makeFetch<ArgType = DefaultArgType, ReturnType = DefaultReturnType>(
  func: (args: ArgType) => ReturnType
) {
  return async (args: ArgType) => {
    try {
      return await func(args);
    } catch (error) {
      let errorMsg = '';
      // assumes axios error response
      if (error.response) {
        console.error(error.response.data);
        errorMsg = `[${error.response.status}][${error.response.data?.error?.type}]: ${error.response.data?.error?.message}`;
      } else {
        errorMsg = error.message;
      }
      return Promise.resolve({ errorMsg });
    }
  };
}

export const fetchChatCompletion = makeFetch<{ chatId: number }, Promise<any>>(
  async ({ chatId }) =>
    openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: chatModule.getMessages(chatId),
      max_tokens: 300,
      temperature: 0,
    })
);

export const fetchCompletion = makeFetch<{ prompt: string }, Promise<any>>(
  ({ prompt }) =>
    openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      max_tokens: 300,
      temperature: 0,
    })
);

export const fetchCompletionStream = makeFetch<
  { prompt: string },
  Promise<any>
>(({ prompt }) =>
  openai.createCompletion(
    {
      model: 'text-davinci-003',
      prompt,
      max_tokens: 350,
      temperature: 0,
      stream: true,
    },
    {
      responseType: 'stream',
    }
  )
);

export const fetchImageGeneration = makeFetch<{ prompt: string }, Promise<any>>(
  ({ prompt }) => openai.createImage({ prompt })
);
