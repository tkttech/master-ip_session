const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const router = express.Router();

function removeFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    const tempDir = path.join(__dirname, 'temp', id);
    const phoneNumber = (req.query.number || '').replace(/\D/g, '');

    if (!phoneNumber) {
        return res.status(400).send({ error: "Please provide a valid phone number" });
    }

    async function createSocketSession() {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        const logger = pino({ level: "fatal" }).child({ level: "fatal" });

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            generateHighQualityLinkPreview: true,
            logger,
            syncFullHistory: false,
            browser: Browsers.macOS("Safari")
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                await delay(5000);

                try {
                    const credsPath = path.join(tempDir, 'creds.json');
                    const sessionData = fs.readFileSync(credsPath, 'utf8');
                    const base64 = Buffer.from(sessionData).toString('base64');
                    const sessionId = "MASTER-IP~" + base64;

                    await sock.sendMessage(sock.user.id, { text: sessionId });

                    const successMsg = {
                        text:
                            `🚀 *MASTER-IP_MD Session Created!*\n\n` +
                            `▸ *Never share* your session ID WITH ANY PUNK\n` +
                            `▸ Join our WhatsApp Channel\n` +
                            `▸ Report bugs on GitHub\n\n` +
                            `_Powered by  𝐓𝐄𝐂𝐇-𝐃𝐄𝐕-𝐈𝐍𝐂🇿🇼\n\n` +
                            `🔗 *Useful Links:*\n` +
                            `▸ GitHub: https://github.com/tkttech/MASTER-IP_MD\n` +
                            `▸ https://whatsapp.com/channel/0029Vb5vbMM0LKZJi9k4ED1a`+
                               `▸
                               *BOT-CONNECTED!*

┏━━━━━━━━━━━━━━━━━━
┃ 🤖 Bot Name: MASTER-IP_MD
┃ 
┃ 👨‍💻 Owner: MASTER-IP
┗━━━━━━━━━━━━━━━━━━

▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💚 𝙼𝙰𝚂𝚃𝙴𝚁-𝙸𝙿_𝙼𝙳 𝙽𝙴𝚇𝚃-𝙶𝙴𝙽 𝙱𝙾𝚃
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
𝐃𝐎𝐍'𝐓 𝐅𝐎𝐑𝐆𝐄𝐓 𝐓𝐎 𝐅𝐎𝐑𝐊 𝐀𝐍𝐃 𝐒𝐓𝐀𝐑 𝐌𝐘 𝐁𝐎𝐓 𝐑𝐄𝐏𝐎 
https://github.com/tkttech/MASTER-IP_MD


> *𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘  𝐓𝐄𝐂𝐇-𝐃𝐄𝐕𝐒-𝐈𝐍𝐂🇿🇼*\n ,
                        contextInfo: {
                            mentionedJid: [sock.user.id],
                            forwardingScore: 1000,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: "120363418027651738@newsletter",
                                newsletterName: " 𝐓𝐄𝐂𝐇-𝐃𝐄𝐕-𝐈𝐍𝐂🇿🇼",
                                serverMessageId: 143
                            }
                        }
                    };

                    await sock.sendMessage(sock.user.id, successMsg);

                } catch (err) {
                    console.error("❌ Session Error:", err.message);
                    await sock.sendMessage(sock.user.id, {
                        text: `⚠️ Error: ${err.message.includes('rate limit') ? 'Server is busy. Try later.' : err.message}`
                    });
                } finally {
                    await delay(1000);
                    await sock.ws.close();
                    removeFolder(tempDir);
                    console.log(`✅ ${sock.user.id} session completed`);
                    process.exit();
                }

            } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                console.log("🔁 Reconnecting...");
                await delay(10);
                createSocketSession();
            }
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            const pairingCode = await sock.requestPairingCode(phoneNumber, "EDITH123");
            if (!res.headersSent) {
                return res.send({ code: pairingCode });
            }
        }
    }

    try {
        await createSocketSession();
    } catch (err) {
        console.error("🚨 Fatal Error:", err.message);
        removeFolder(tempDir);
        if (!res.headersSent) {
            res.status(500).send({ code: "Service Unavailable. Try again later." });
        }
    }
});

module.exports = router;
