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
import { Sticker, createSticker, StickerTypes } from "wa-sticker-formatter";

const prefix = "!"; // Prefix to be use can be '!' or '.' etc

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

        // type MegaMsgConstructor = proto.IMessage & {

        // }
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
        m.quotedMsg = m.message[m.type.msg]?.contextInfo.quotedMessage ? m.message[m.type.msg]?.contextInfo.quotedMessage : false;
        // const type_quoted: any = Object.keys(quotedMsg);
        if (m.quotedMsg != false) {
            m.type.quotedMsg = Object.keys(m.quotedMsg)[0];
            // const quote: any = m.quotedMsg;
            m.quotedMsg = {
                key: {
                    remoteJid: m.chatId,
                    id: m.message[m.type.msg]?.contextInfo?.stanzaId,
                    participant: m.message[m.type.msg]?.contextInfo?.participant,
                },
                message: new proto.Message(m.message[m.type.msg]?.contextInfo.quotedMessage),
            };
        }

        m.groupMetadata = m.isGroupMsg ? await sock.groupMetadata(m.chatId) : false;
        let mediaType = ["imageMessage", "videoMessage", "stickerMessage", "audioMessage"];
        m.isMedia = m.quotedMsg === false ? mediaType.includes(m.type.msg) : mediaType.includes(m.type.quotedMsg);

        // console.log(m);
        // console.log(m);
        console.log(`[New Message] : --isGroupMsg:'${m.isGroupMsg}' --message:'${m.body}' --sender:'${m.sender}' --user:'${m.pushName}'`);
        // bcommand is the command of the body trimmed
        if (m.bcommand === prefix + "sticker") {
            await sock.sendPresenceUpdate("composing", m.chatId);
            if (!m.isMedia) {
                await sock.sendMessage(m.chatId, { text: "❓Please give a media to convert to sticker" }, { quoted: m });
            }
            try {
                const buffer_img: any = await downloadMediaMessage(
                    !m.quotedMsg ? m : m.quotedMsg,
                    "buffer",
                    {},
                    {
                        logger: pino({ level: "silent" }),
                        reuploadRequest: sock.updateMediaMessage,
                    }
                );
                const stickerimg = new Sticker(buffer_img, {
                    pack: "Bot Wwjs - Fatih", // pack name
                    author: m.argument ? m.argument : null, // author name
                    type: m.argument.includes("-f") ? StickerTypes.FULL : StickerTypes.CROPPED, // sticker type
                    quality: 1, // quality of the output file
                });
                await sock.sendMessage(m.chatId, await stickerimg.toMessage(), { quoted: m });
                // // await sleep(0.5);
            } catch (err) {
                await sock.sendMessage(m.chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
                console.log(err);
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
                const participants = m.groupMetadata.participants.map((i) => i.id);
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
                    sock.sendMessage(m.chatId, {
                        text: `Everyone is Tag By: @${sender_num}\n\n${m.argument}`,
                        mentions: participants,
                    });
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
