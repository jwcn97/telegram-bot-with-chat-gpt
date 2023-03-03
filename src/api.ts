import { Configuration, OpenAIApi } from "openai";

const apiKey = process.env.OPENAI_TOKEN;
const configuration = new Configuration({ apiKey });
const openai = new OpenAIApi(configuration);

export function fetchCompletionResponse(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 500,
        temperature: 0,
        stream: true,
    }, { responseType: 'stream' });
}

export function modelAPI(prompt: string) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: "user", content: prompt }],
            max_tokens: 500,
            temperature: 0,
        })
    }).then(res => res.json());
}

export function fetchImageGenerationResponse(prompt: string) {
    return openai.createImage({ prompt });
}
