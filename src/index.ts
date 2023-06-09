import makeWASocket, {
    DisconnectReason,
    downloadContentFromMessage,
    downloadMediaMessage,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    WAMessage,
    proto,
    GroupMetadata,
} from "@adiwajshing/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import keepAlive from "./server";
import ChatGpt from "./Chat_GPT";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
import * as fs from "fs";
// import { writeFile } from "fs/promises";
// import { exec } from "child_process";
import path from "path";
// import * as fs from "fs";
// import { promisify } from "util";

const prefix = "!"; // Prefix to be use can be '!' or '.' etc
const Chat_GPT_allowed = "/Gpt_Allowed.json";
async function connectToWhatsApp() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    console.log(`[VERSION] : ${version.join(".")}`);
    console.log(`[isLatest] : ${isLatest}`);
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }),
        markOnlineOnConnect: false,
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("connection closed due to ", lastDisconnect.error, ", reconnecting ", shouldReconnect);
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === "open") {
            console.log("Established Connection");
        }
    });
    sock.ev.on("messages.upsert", async (m_raw) => {
        type MsgConstructor = WAMessage & {
            type?: { msg?: string; quotedMsg?: string };
            body?: string;
            argument?: string;
            chatId?: string;
            sender?: string;
            isGroupMsg?: boolean;
            groupMetadata?: GroupMetadata | boolean;
            isMedia?: boolean;
            quotedMsg?: false | WAMessage;
            owner?: string;
            bcommand?: string;
        };
        type ChatGPT_API = {
            role: any;
            content: any;
        };
        let m: MsgConstructor = m_raw.messages[0];
        // console.log(JSON.stringify(m, undefined, 2));
        // console.log("replying to", m.messages[0].key.remoteJid);
        // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: "Hello there!" });
        if (m == undefined) return;
        if (m?.message == undefined) return;
        if (!m) return;
        if (m.key && m.key.remoteJid == "status@broadcast") return;
        if (m.key.fromMe == true) return;
        if (!m.message) return;

        await sock.readMessages([m.key]);
        const botnumber = sock.user.id.replace(/:(\d+)@s.whatsapp.net$/, "@s.whatsapp.net");
        // Format
        m.owner = "6281382519681@s.whatsapp.net";
        m.type = {};
        m.type.msg = Object.keys(m.message).find((key) => m?.message[key]?.contextInfo || m?.message[key]?.caption);
        // const type: any = Object.keys(m?.message)[0];
        m.isGroupMsg = m.key.remoteJid.endsWith("@g.us");
        m.sender = m.isGroupMsg ? m.key.participant : m.key.remoteJid;
        m.chatId = m.key.remoteJid;
        const sender_num = m.sender.split("@s.whatsapp.net");
        m.body =
            m.message?.conversation ||
            m.message[m.type.msg]?.text ||
            m.message[m.type.msg]?.caption ||
            m.message[m.type.msg]?.selectedDisplayText ||
            m.message[m.type.msg]?.description ||
            m.message[m.type.msg]?.contentText ||
            m.message[m.type.msg]?.title;
        let words: string[] = m.body?.replace(/^\s+|\s+$/g, "").split(/\s+/);
        words = words?.slice(1);
        m.argument = words?.join(" ");
        // let bcommand = body?.split(" ")[0].toLowerCase();
        m.bcommand = m.body
            ?.replace(/^\s+|\s+$/g, "")
            .split(/\s+/)[0]
            .toLowerCase();
        m.quotedMsg = m.message[m.type.msg]?.contextInfo?.quotedMessage ? m.message[m.type.msg]?.contextInfo?.quotedMessage : false;
        // const type_quoted: any = Object.keys(quotedMsg);
        if (m.quotedMsg != false) {
            m.type.quotedMsg = Object.keys(m.quotedMsg)[0];
            // const quote: any = m.quotedMsg;
            m.quotedMsg = {
                key: {
                    remoteJid: m.chatId,
                    id: m.message[m.type.msg]?.contextInfo?.stanzaId,
                    participant: m.message[m.type.msg]?.contextInfo?.participant,
                    fromMe: botnumber === m.message[m.type.msg]?.contextInfo?.participant,
                },
                message: new proto.Message(m.message[m.type.msg]?.contextInfo.quotedMessage),
            };
        }

        m.groupMetadata = m.isGroupMsg ? await sock.groupMetadata(m.chatId) : false;
        let mediaType = ["imageMessage", "videoMessage", "stickerMessage", "audioMessage"];
        m.isMedia = !m.quotedMsg ? mediaType.includes(m.type.msg) : mediaType.includes(m.type.quotedMsg);
        const participants = m.groupMetadata ? m.groupMetadata.participants.map((i) => i.id) : null;
        const ListAllGroup = await sock.groupFetchAllParticipating();

        // console.log(m);
        console.log(`[New Message] : --isGroupMsg:'${m.isGroupMsg}' --message:'${m.body}' --sender:'${m.sender}' --user:'${m.pushName}'`);
        // bcommand is the command of the body trimmed
        if (m.bcommand === prefix + "sticker") {
            await sock.sendPresenceUpdate("composing", m.chatId);
            if (!m.isMedia) {
                await sock.sendMessage(m.chatId, { text: "❓[REJECTED] : Please give a media to convert to sticker" }, { quoted: m });
                return;
            }
            // const sticker_mp4webp = path.normalize(__dirname + "/sticker_mp4this.webp");
            // const sticker_mp4gif = path.normalize(__dirname + "/sticker_mp4this.gif");
            // const sticker_mp4done = path.normalize(__dirname + "/sticker_mp4this.mp4");
            // const sticker_mp4another = path.normalize(__dirname + "/sticker_mp4other.mp4");
            if (m.type.quotedMsg === "stickerMessage") {
                try {
                    let sticker_img: any = await downloadMediaMessage(
                        !m.quotedMsg ? m : m.quotedMsg,
                        "buffer",
                        {},
                        {
                            logger: pino({ level: "silent" }),
                            reuploadRequest: sock.updateMediaMessage,
                        }
                    );
                    // sharp(sticker_img)
                    //     .metadata()
                    //     .then((metadata) => {
                    //         // Check if the WebP file contains more than one frame
                    //         const isAnimated = metadata.pages !== undefined && metadata.pages > 1;
                    //         // Print the result
                    //         if (isAnimated) {
                    //             console.log("The WebP buffer is an animated image.");
                    //         } else {
                    //             console.log("The WebP buffer is a still image.");
                    //         }
                    //     })
                    //     .catch((err) => console.error(err));
                    const metadata_sticker = await sharp(sticker_img).metadata();
                    const isAnimated = metadata_sticker.pages !== undefined && metadata_sticker.pages > 1;
                    if (isAnimated) {
                        await sock.sendMessage(
                            m.chatId,
                            {
                                text: "❓[INFO] : Animated sticker cannot be converted back!, also if possible, the video will have no sound it will be muted. Why would you ?",
                            },
                            { quoted: m }
                        );
                        // await sock.sendPresenceUpdate("composing", m.chatId);
                        //     console.log("its running");
                        //     // const videoBuffer = await sharp(sticker_img, { animated: true }).withMetadata().toFormat("gif").toBuffer();
                        //     // Send the video buffer as a message
                        //     console.log("NO ERROR SO FAR");
                        //     console.log("PASS");
                        //     try {
                        //         await writeFile(sticker_mp4webp, sticker_img);
                        //         if (fs.existsSync(sticker_mp4webp)) {
                        //             exec(`convert -coalesce ${sticker_mp4webp} -loop 0 ${sticker_mp4gif}`, (err) => {
                        //                 if (err) {
                        //                     console.log(err);
                        //                     sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //                 }
                        //                 if (fs.existsSync(sticker_mp4gif)) {
                        //                     exec(`ffmpeg -i ${sticker_mp4gif} ${sticker_mp4done}`, (err) => {
                        //                         console.log("in the ffmpeg");
                        //                         if (err) {
                        //                             console.log(err);
                        //                             sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //                         }
                        //                         sock.sendMessage(m.chatId, {
                        //                             video: { url: sticker_mp4done },
                        //                             mimetype: "video/mp4",
                        //                             // gifPlayback: true,
                        //                         });
                        //                         if (fs.existsSync(sticker_mp4webp)) {
                        //                             try {
                        //                                 fs.unlinkSync(sticker_mp4webp);
                        //                             } catch (err) {
                        //                                 sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //                             }
                        //                         }
                        //                         if (fs.existsSync(sticker_mp4gif)) {
                        //                             try {
                        //                                 fs.unlinkSync(sticker_mp4gif);
                        //                             } catch (err) {
                        //                                 sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //                             }
                        //                         }
                        //                         if (fs.existsSync(sticker_mp4done)) {
                        //                             try {
                        //                                 fs.unlinkSync(sticker_mp4done);
                        //                             } catch (err) {
                        //                                 sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //                             }
                        //                         }
                        //                     });
                        //                 }
                        //             });
                        //         }
                        //     } catch (err) {
                        //         await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        //     }
                    } else {
                        // Send the WebP buffer as an image message
                        await sock.sendMessage(m.chatId, {
                            image: sticker_img,
                        });
                        await sock.sendMessage(m.chatId, {
                            text: "Sticker has been successfully converted back to image",
                        });
                    }
                    return;
                } catch (err) {
                    console.log(err);
                    await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                }
                // await sock.sendMessage(m.chatId, { text: "❓[REJECTED] : Bro...., what are you DOING!" }, { quoted: m });
            }
            try {
                let buffer_img: any = await downloadMediaMessage(
                    !m.quotedMsg ? m : m.quotedMsg,
                    "buffer",
                    {},
                    {
                        logger: pino({ level: "silent" }),
                        reuploadRequest: sock.updateMediaMessage,
                    }
                );
                // OLD WAYS --
                if (m.type?.quotedMsg === "videoMessage" || m.type?.msg === "videoMessage") {
                    if (!m.quotedMsg ? m.message[m.type.msg].fileLength >= 1083000 : m.quotedMsg?.message[m.type.quotedMsg].fileLength >= 1083000) {
                        try {
                            let buffer_aloc = Buffer.alloc(1083000);
                            buffer_aloc.fill(buffer_img);
                            buffer_img = buffer_aloc;
                        } catch (err) {
                            await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                        }
                    }
                }
                // if (m.type?.quotedMsg === "videoMessage" || m.type?.msg === "videoMessage") {
                //     try {
                //         await writeFile(sticker_mp4done, buffer_img);
                //         if (fs.existsSync(sticker_mp4done)) {
                //             exec(`ffmpeg -i ${sticker_mp4done} -t 3 ${sticker_mp4another}`, (err) => {
                //                 if (err) {
                //                     console.log(err);
                //                     sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                //                 }
                //                 if (fs.existsSync(sticker_mp4another)) {
                //                     try {
                //                         buffer_img = fs.readFileSync(sticker_mp4another);
                //                         console.log(buffer_img);
                //                         fs.unlinkSync(sticker_mp4done);
                //                         fs.unlinkSync(sticker_mp4another);
                //                     } catch (err) {
                //                         sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                //                     }
                //                 }
                //             });
                //         }
                //     } catch (err) {
                //         console.log(err);
                //         await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                //     }
                // }
                const stickerimg = new Sticker(buffer_img, {
                    pack: "Bot Wwjs - Fatih", // pack name
                    id: sender_num.toString(),
                    author: m.argument ? m.argument.replace(/-\w+\s*/g, "").trim() : null, // author name
                    categories: ["👋", "❗", "🗯️"],
                    type: m.argument.includes("-f")
                        ? StickerTypes.FULL
                        : m.argument.includes("-c")
                        ? StickerTypes.CIRCLE
                        : m.argument.includes("-r")
                        ? StickerTypes.ROUNDED
                        : StickerTypes.CROPPED, // sticker type
                    quality: m.argument.includes("-h" || "-high")
                        ? 100
                        : m.argument.includes("-m" || "-medium" || "-med")
                        ? 50
                        : m.argument.includes("-l" || "-low")
                        ? 10
                        : m.argument.match(/-q-(\d+)/)
                        ? Number(m.argument.match(/-q-(\d+)/)[1])
                        : m.type?.quotedMsg === "videoMessage" || m.type?.msg === "videoMessage"
                        ? 5
                        : 25, // quality of the output file.
                });
                await sock.sendMessage(m.chatId, await stickerimg.toMessage(), { quoted: m });
                await sock.sendMessage(m.chatId, {
                    text: `Additional option : \n-f : Full size sticker\n-c : Circle size sticker\n-r : Rounded size sticker\n\nBy Default the size is crop\n\n-h : High res sticker\n-m : Medium res sticker\n-l : Low res sticker\n-q-[number] : Manually choosing the quality level , with a range from 1 to 100\n\nBy Default the is quality low~med res`,
                });
            } catch (err) {
                await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
            }
            // // await sleep(0.5);
        }

        if (m.bcommand === prefix + "gpt") {
            await sock.sendPresenceUpdate("composing", m.chatId);
            if (!m.isGroupMsg) {
                await sock.sendMessage(m.chatId, { text: `for now ${prefix}gpt is only available in *GROUP CHAT*` }, { quoted: m });
                return;
            }
            if (!m.argument) {
                await sock.sendMessage(m.chatId, { text: "❓To proceed on your request, please add a second argument." }, { quoted: m });
                return;
            }
            let filteredGroups = Object.values(ListAllGroup)
                .filter((group) => group.participants.some((participant) => participant.id === m.owner))
                .map((group) => group.id);
            const GPT_JSON = path.normalize(__dirname + Chat_GPT_allowed);
            if (!fs.existsSync(GPT_JSON)) {
                // console.log("not exist");
                fs.writeFileSync(GPT_JSON, JSON.stringify(filteredGroups));
            }
            let jsonContent: any = fs.readFileSync(GPT_JSON);
            const GPT_allowed: string[] = JSON.parse(jsonContent);
            let jsonNow = GPT_allowed.concat(filteredGroups.filter((item) => !GPT_allowed.includes(item)));
            const jsonData = JSON.stringify(jsonNow);
            fs.writeFileSync(GPT_JSON, jsonData);
            if (!jsonNow.includes(m.chatId)) {
                await sock.sendMessage(
                    m.chatId,
                    {
                        text: `⚠️[ERROR] : Access to ${prefix}gpt is limited to certain whitelisted groups. To see if your group is eligible, please contact wa.me/6281382519681 and politely request inclusion.\nYour Group ID: ${m.chatId}`,
                    },
                    { quoted: m }
                );
                return;
            }
            try {
                await sock.sendMessage(
                    m.chatId,
                    {
                        text: "🔃 [CHATGPT] : Please bear with me as ChatGPT processes your request it may take a moment. Please Note that ChatGPT is a reliable AI assistant that answers your propmts and queries and also provides suggestion.\n\n*Knowledge cutoff: 2021-09-01.*",
                    },
                    { quoted: m }
                );
                const GPT = await ChatGpt(m);
                // console.log(GPT);
                await sock.sendMessage(m.chatId, { text: "🗣️ [CHATGPT] 🟢 : \n" + GPT.choices[0].message.content }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
            }
        }
        if (m.bcommand === prefix + "anime") {
            await sock.sendPresenceUpdate("composing", m.chatId);
            await sock.sendMessage(
                m.chatId,
                { text: `ℹ️[INFO] : Attention!!, ${prefix}gpt  command is still in development and might be remove` },
                { quoted: m }
            );
            return;
            try {
                // await sock.sendMessage(m.chatId, { text: "🗣️[CHATGPT] : " + chatgpt.text }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
            }
        }
        if (m.bcommand === prefix + "ping") {
            await sock.sendPresenceUpdate("composing", m.chatId);
            // await sleep(0.5);
            await sock.sendMessage(m.chatId, { text: "What's Up 👋" }, { quoted: m });
        }
        if (m.bcommand === prefix + "everyone" && m.isGroupMsg) {
            await sock.sendPresenceUpdate("composing", m.chatId);
            // await sleep(0.5);
            if (m.isGroupMsg && m.groupMetadata && typeof m.groupMetadata === "object") {
                if (!m.argument) {
                    const people_tag = participants.map((item) => "@" + item.match(/\d+/g).join(" ")).join(" ");
                    sock.sendMessage(
                        m.chatId,
                        {
                            text: people_tag,
                            mentions: participants,
                        },
                        { quoted: m }
                    );
                } else {
                    sock.sendMessage(
                        m.chatId,
                        {
                            text: `Everyone is Tag By: @${sender_num}\n\n${m.argument}`,
                            mentions: participants,
                        },
                        { quoted: m }
                    );
                }
            }
        }
        // bcommand is the command of the body trimmed
        if (m.bcommand === prefix + "run") {
            if (m.sender === m.owner) {
                if (!m.argument) {
                    await sock.sendPresenceUpdate("composing", m.chatId);
                    await sock.sendMessage(m.chatId, { text: "❓Please put an argument sire" }, { quoted: m });
                } else {
                    try {
                        await eval(m.argument);
                    } catch (err) {
                        await sock.sendPresenceUpdate("composing", m.chatId);
                        await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                    }
                }
            }
        }
    });
}
// run in main file
function sleep(s: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

keepAlive(3000);
connectToWhatsApp();
