import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    interface ChatMessage {
        role: any;
        content: any;
    }
    let messages: ChatMessage[] = [{ role: "user", content: "hello, who are you" }];
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
        });
        console.log(completion.data.choices);
    } catch (error) {
        if (error.response) {
            console.log(error.response.status);
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}
main();
