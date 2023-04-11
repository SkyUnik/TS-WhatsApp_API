import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import dotenv from "dotenv";

dotenv.config();

export default async function ChatGpt(msg: string) {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const moderation = await fetch("https://api.openai.com/v1/moderations", {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        method: "POST",
        body: JSON.stringify({
            input: msg,
        }),
    });
    const moderation_data = await moderation.json();
    const [result_moderation] = moderation_data.results;
    if (result_moderation.flagged) {
        throw new Error("Query is forbidden by openai");
        return;
    }
    const openai = new OpenAIApi(configuration);
    const messages: ChatCompletionRequestMessage[] = [
        {
            role: "system",
            content:
                "You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible. Also you are a AI ChatBot in WhatsApp Enviroment.",
        },
    ];
    let message_user: ChatCompletionRequestMessage = { role: "user", content: msg };
    messages.push(message_user);
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
        });
        // console.log(completion.data.choices);
        return completion.data;
    } catch (error) {
        if (error.response) {
            console.log(error.response.status);
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}
