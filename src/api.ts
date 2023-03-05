import { Configuration, OpenAIApi } from "openai";

const apiKey = process.env.OPENAI_TOKEN;
const configuration = new Configuration({ apiKey });
const openai = new OpenAIApi(configuration);

export function fetchChatCompletion(messages: Array<{ role: string; content: string }>) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages,
            max_tokens: 500,
            temperature: 0,
        }),
    }).then(res => res.json());
}

export function fetchCompletion(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 500,
        temperature: 0,
    });
}

export function fetchCompletionStream(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 500,
        temperature: 0,
        stream: true,
    }, { responseType: 'stream' });
}

export function fetchCodeResponse(prompt: string) {
    return fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'code-davinci-002',
            prompt,
            max_tokens: 500,
            temperature: 0,
        })
    }).then(res => res.json());
}

export function fetchImageGenerationResponse(prompt: string) {
    return openai.createImage({ prompt });
}
