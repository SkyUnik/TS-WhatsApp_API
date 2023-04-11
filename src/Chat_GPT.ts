import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const mySecret = process.env["OPENAI_API_KEY"];
export default async function ChatGpt(msg: string) {
    const configuration = new Configuration({
        apiKey: mySecret,
    });
    try {
        const moderation = await axios.post(
            "https://api.openai.com/v1/moderations",
            {
                input: msg,
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
