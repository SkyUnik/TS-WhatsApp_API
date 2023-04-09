import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import dotenv from "dotenv";
dotenv.config();

export default async function ChatGpt(msg) {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    let messages: ChatCompletionRequestMessage[] = [{ role: "user", content: msg }];
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
