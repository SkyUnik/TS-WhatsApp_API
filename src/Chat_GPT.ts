import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const mySecret = process.env["OPENAI_API_KEY"];
export default async function ChatGpt(msg) {
    const configuration = new Configuration({
        apiKey: mySecret,
    });
    try {
        const moderation = await axios.post(
            "https://api.openai.com/v1/moderations",
            {
                input: msg.argument,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${mySecret}`,
                },
            }
        );
        const result_moderation = moderation.data.results[0];
        if (result_moderation.flagged) {
            throw new Error("Query is forbidden by openai");
        }
        const openai = new OpenAIApi(configuration);
        const messages: ChatCompletionRequestMessage[] = [
            {
                role: "system",
                content:
                    "You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible. Also you are a AI ChatBot in WhatsApp Enviroment.",
            },
        ];
        if (msg.quotedMsg && msg.quotedMsg?.key?.fromMe) {
            let message_gpt: ChatCompletionRequestMessage = { role: "assistant", content: msg.quotedMsg?.message?.conversation.substring(22) };
            messages.push(message_gpt);
        }
        let message_user: ChatCompletionRequestMessage = { role: "user", content: msg.argument };
        messages.push(message_user);
        messages.map((message: ChatCompletionRequestMessage) => JSON.stringify(message)).join(",");
        console.log(messages);
        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages,
            });
            // console.log(completion.data.choices);
            return completion.data;
        } catch (error) {
            throw new Error(error);
            // if (error.response) {
            //     console.log(error.response.status);
            //     console.log(error.response.data);
            // } else {
            //     console.log(error.message);
            // }
        }
    } catch (err) {
        throw new Error(err);
    }
}
