import { Configuration, OpenAIApi } from "openai";

const apiKey = process.env.OPENAI_TOKEN;
const configuration = new Configuration({ apiKey });
const openai = new OpenAIApi(configuration);

export function fetchCompletionResponseTest(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 100,
        temperature: 0,
        stream: true,
    }, { responseType: 'stream' });
}

export function fetchCompletionResponse(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 500,
        temperature: 0,
    });
}

export function fetchImageGenerationResponse(prompt: string) {
    return openai.createImage({ prompt });
}
