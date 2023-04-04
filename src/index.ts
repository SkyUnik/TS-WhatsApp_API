import makeWASocket, {
    DisconnectReason,
    SignalDataSet,
    SignalDataTypeMap,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
} from "@adiwajshing/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import keepAlive from "./server";

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
        keepAlive(3000);
    });
    sock.ev.on("messages.upsert", async (m_raw) => {
        let m = m_raw.messages[0];
        // console.log(JSON.stringify(m, undefined, 2));
        // console.log("replying to", m.messages[0].key.remoteJid);
        // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: "Hello there!" });
        if (m == undefined) return;
        if (m?.message == undefined) return;
        if (!m) return;
        if (m.key && m.key.remoteJid == "status@broadcast") return;
        if (m.key.fromMe == true) return;
        if (!m.message) return;

        // Format
        const owner: string = "6281382519681@s.whatsapp.net";
        const type: any = Object.keys(m?.message)[0];
        const isGroupMsg: boolean = m.key.remoteJid.endsWith("@g.us");
        const sender: string = isGroupMsg ? m.key.participant : m.key.remoteJid;
        const chatId: string = m.key.remoteJid;
        const sender_num = sender.split("@s.whatsapp.net");
        const body: string =
            m.message?.conversation ||
            m.message[type]?.text ||
            m.message[type]?.caption ||
            m.message[type]?.selectedDisplayText ||
            m.message[type]?.description ||
            m.message[type]?.contentText ||
            m.message[type]?.title;
        let words: string[] = body?.replace(/^\s+|\s+$/g, "").split(/\s+/);
        words = words?.slice(1);
        let argument: string = words?.join(" ");
        // let bcommand = body?.split(" ")[0].toLowerCase();
        let bcommand = body
            ?.replace(/^\s+|\s+$/g, "")
            .split(/\s+/)[0]
            .toLowerCase();
        const quotedMsg = m.message[type]?.contextInfo?.quotedMessage ? m.message[type]?.contextInfo.quotedMessage : false;
        const groupMetadata = isGroupMsg ? await sock.groupMetadata(chatId) : undefined;
        let mediaType: string[] = ["imageMessage", "videoMessage", "stickerMessage", "audioMessage"];
        const isMedia: boolean = quotedMsg === false ? mediaType.includes(type) : mediaType.includes(quotedMsg.Message);

        // console.log(m);
        console.log(`[New Message] : --isGroupMsg:'${isGroupMsg}' --message:'${body}' --sender:'${sender}' --user:'${m.pushName}'`);
        // bcommand is the command of the body trimmed
        if (bcommand === prefix + "ping") {
            await sock.readMessages([m.key]);
            await sock.sendPresenceUpdate("composing", chatId);
            // await sleep(0.5);
            await sock.sendMessage(chatId, { text: "What's Up 👋" }, { quoted: m });
        }
        if (bcommand === prefix + "everyone" && isGroupMsg) {
            await sock.readMessages([m.key]);
            await sock.sendPresenceUpdate("composing", chatId);
            // await sleep(0.5);
            const participants = groupMetadata.participants.map((i) => i.id);
            if (!argument) {
                const people_tag = participants.map((item) => "@" + item.match(/\d+/g).join(" ")).join(" ");
                sock.sendMessage(
                    chatId,
                    {
                        text: people_tag,
                        mentions: participants,
                    },
                    { quoted: m }
                );
            } else {
                sock.sendMessage(chatId, {
                    text: `Everyone is Tag By: @${sender_num}\n\n${argument}`,
                    mentions: participants,
                });
            }
        }
        // bcommand is the command of the body trimmed
        if (bcommand === prefix + "run") {
            await sock.readMessages([m.key]);
            if (sender === owner) {
                await sock.sendPresenceUpdate("composing", chatId);
                if (!argument) {
                    await sock.sendMessage(chatId, { text: "❓Please put an argument sire" }, { quoted: m });
                } else {
                    try {
                        await eval(argument);
                    } catch (err) {
                        await sock.sendMessage(chatId, { text: "⚠️[ERROR] : " + err }, { quoted: m });
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

connectToWhatsApp();
