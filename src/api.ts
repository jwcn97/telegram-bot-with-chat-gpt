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
            max_tokens: 400,
            temperature: 0,
        }),
    }).then(res => res.json());
}

export function fetchCompletion(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 400,
        temperature: 0,
    });
}

export function fetchCompletionStream(prompt: string) {
    return openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 400,
        temperature: 0,
        stream: true,
    }, { responseType: 'stream' });
}

// export function fetchCode(prompt: string) {
//     return openai.createCompletion({
//         model: 'code-cushman-001',
//         prompt,
//         max_tokens: 1000,
//         temperature: 0,
//     });
// }

export function fetchImageGenerationResponse(prompt: string) {
    return openai.createImage({ prompt, n: 2 });
}
