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
    });
    sock.ev.on("messages.upsert", async (m_raw) => {
        let m = m_raw.messages[0];
        // console.log(JSON.stringify(m, undefined, 2));
        // console.log("replying to", m.messages[0].key.remoteJid);
        // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: "Hello there!" });
        if (!m) return;
        if (m.key && m.key.remoteJid == "status@broadcast") return;
        if (m.key.fromMe == true) return;

        // Format
        const body: string =
            m.message.conversation ||
            m.message[Object.keys(m?.message)[0]].text ||
            m.message[Object.keys(m?.message)[0]].caption ||
            m.message[Object.keys(m?.message)[0]].selectedDisplayText ||
            m.message[Object.keys(m?.message)[0]].description ||
            m.message[Object.keys(m?.message)[0]].contentText ||
            m.message[Object.keys(m?.message)[0]].title;
        const from: string = m.key.remoteJid;
        let words: string[] = body?.replace(/^\s+|\s+$/g, "").split(/\s+/);
        words = words?.slice(1);
        let argument: string = words?.join(" ");
        // let bcommand = body?.split(" ")[0].toLowerCase();
        let bcommand = body
            ?.replace(/^\s+|\s+$/g, "")
            .split(/\s+/)[0]
            .toLowerCase();

        // bcommand is the command of the body trimmed
        if (bcommand === prefix + "ping") {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { text: "What's Up 👋" });
        }
        // bcommand is the command of the body trimmed
        if (bcommand === prefix + "run") {
            await sock.readMessages([m.key]);
            console.log(body);
            console.log(argument);
            await eval(argument);
        }
    });
}
// run in main file
keepAlive();
connectToWhatsApp();
