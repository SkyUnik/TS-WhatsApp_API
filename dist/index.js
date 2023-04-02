"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baileys_1 = __importStar(require("@adiwajshing/baileys"));
const pino_1 = __importDefault(require("pino"));
const server_1 = __importDefault(require("./server"));
const prefix = "!"; // Prefix to be use can be '!' or '.' etc
async function connectToWhatsApp() {
    const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)("auth_info");
    console.log(`[VERSION] : ${version.join(".")}`);
    console.log(`[isLatest] : ${isLatest}`);
    const sock = (0, baileys_1.default)({
        printQRInTerminal: true,
        auth: state,
        logger: (0, pino_1.default)({ level: "silent" }),
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log("connection closed due to ", lastDisconnect.error, ", reconnecting ", shouldReconnect);
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
        else if (connection === "open") {
            console.log("Established Connection");
        }
    });
    sock.ev.on("messages.upsert", async (m_raw) => {
        const m_ril = m_raw.messages[0];
        let m = m_raw.messages[0];
        // console.log(JSON.stringify(m, undefined, 2));
        // console.log("replying to", m.messages[0].key.remoteJid);
        // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: "Hello there!" });
        if (!m)
            return;
        if (m.key && m.key.remoteJid == "status@broadcast")
            return;
        if (m.key.fromMe == true)
            return;
        if (!m.message)
            return;
        // Format
        m = require("./Message_format")(sock, m_ril);
        console.log(m);
        // const body: string =
        //     m.message?.conversation ||
        //     m.message[Object.keys(m?.message)[0]]?.text ||
        //     m.message[Object.keys(m?.message)[0]]?.caption ||
        //     m.message[Object.keys(m?.message)[0]]?.selectedDisplayText ||
        //     m.message[Object.keys(m?.message)[0]]?.description ||
        //     m.message[Object.keys(m?.message)[0]]?.contentText ||
        //     m.message[Object.keys(m?.message)[0]]?.title;
        // const from: string = m.key.remoteJid;
        // let words: string[] = body?.replace(/^\s+|\s+$/g, "").split(/\s+/);
        // words = words?.slice(1);
        // let argument: string = words?.join(" ");
        // // let bcommand = body?.split(" ")[0].toLowerCase();
        // let bcommand = body
        //     ?.replace(/^\s+|\s+$/g, "")
        //     .split(/\s+/)[0]
        //     .toLowerCase();
        // bcommand is the command of the body trimmed
        // if (bcommand === prefix + "ping") {
        //     await sock.readMessages([m.key]);
        //     await sock.sendMessage(from, { text: "What's Up 👋" });
        // }
        // // bcommand is the command of the body trimmed
        // if (bcommand === prefix + "run") {
        //     await sock.readMessages([m.key]);
        //     console.log(body);
        //     console.log(argument);
        //     await eval(argument);
        // }
    });
}
// run in main file
(0, server_1.default)();
connectToWhatsApp();
