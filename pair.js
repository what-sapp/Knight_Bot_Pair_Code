import express from 'express';
import fs from 'fs';
import pino from 'pino';
import zlib from 'zlib';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// Media URLs and content arrays
const media = {
    audioUrls: [
        "https://files.catbox.moe/hpwsi2.mp3",
        "https://files.catbox.moe/xci982.mp3",
        "https://files.catbox.moe/1n7f78.mp3",
        "https://files.catbox.moe/2b5k9q.mp3",
        "https://files.catbox.moe/3c8d4r.mp3",
        "https://files.catbox.moe/4e9f5s.mp3",
        "https://files.catbox.moe/5g0h6t.mp3",
        "https://files.catbox.moe/6i1j7u.mp3",
        "https://files.catbox.moe/7k2l8v.mp3",
        "https://files.catbox.moe/8m3n9w.mp3"
    ],
    videoUrls: [
        "https://i.imgur.com/Zuun5CJ.mp4",
        "https://i.imgur.com/tz9u2RC.mp4",
        "https://i.imgur.com/1a2b3c.mp4",
        "https://i.imgur.com/4d5e6f.mp4",
        "https://i.imgur.com/7g8h9i.mp4",
        "https://i.imgur.com/j0k1l2.mp4",
        "https://i.imgur.com/m3n4o5.mp4",
        "https://i.imgur.com/p6q7r8.mp4",
        "https://i.imgur.com/s9t0u1.mp4",
        "https://i.imgur.com/v2w3x4.mp4"
    ],
    factsAndQuotes: [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
        "Believe you can and you're halfway there. - Theodore Roosevelt",
        "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
        "It does not matter how slowly you go as long as you do not stop. - Confucius",
        "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb",
        "In the middle of difficulty lies opportunity. - Albert Einstein",
        "The only impossible journey is the one you never begin. - Tony Robbins",
        "Your limitation—it's only your imagination.",
        "Push yourself, because no one else is going to do it for you."
    ]
};

// Helper functions
const helpers = {
    getRandomItem: (array) => array[Math.floor(Math.random() * array.length)],
    makeid: (num = 4) => {
        let result = "";
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let characters9 = characters.length;
        for (let i = 0; i < num; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters9));
        }
        return result;
    },
    removeFile: (FilePath) => {
        try {
            if (!fs.existsSync(FilePath)) return false;
            fs.rmSync(FilePath, { recursive: true, force: true });
            return true;
        } catch (e) {
            console.error('Error removing file:', e);
            return false;
        }
    }
};

// Ensure temp directory exists
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    const sessionId = helpers.makeid(8);
    const dirs = `./temp/${sessionId}`;

    // Ensure session directory exists
    if (!fs.existsSync(dirs)) {
        fs.mkdirSync(dirs, { recursive: true });
    }

    // Clean the phone number - remove any non-digit characters
    num = num.replace(/[^0-9]/g, '');

    // Validate the phone number using awesome-phonenumber
    const phone = pn('+' + num);
    if (!phone.isValid()) {
        helpers.removeFile(dirs);
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, 84987654321 for Vietnam, etc.) without + or spaces.' });
        }
        return;
    }
    // Use the international number format (E.164, without '+')
    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            KnightBot.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;

                if (connection === 'open') {
                    console.log("✅ Connected successfully!");
                    console.log("📱 Sending session file to user...");
                    
                    try {
                        await delay(5000);
                        
                        // Read session file
                        let data = fs.readFileSync(`${dirs}/creds.json`);
                        await delay(8000);

                        // Compress and encode session data
                        let sessionData = zlib.gzipSync(data).toString('base64');

                        // Get user JID
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        // Send compressed session data
                        await KnightBot.sendMessage(userJid, {
                            text: 'KNIGHT;;;' + sessionData
                        });
                        console.log("📄 Compressed session data sent successfully");

                        await delay(2000);

                        // Send random video with caption
                        await KnightBot.sendMessage(userJid, { 
                            video: { url: helpers.getRandomItem(media.videoUrls) },
                            caption: helpers.getRandomItem(media.factsAndQuotes)
                        });
                        console.log("🎬 Video sent successfully");

                        await delay(2000);

                        // Send random audio
                        await KnightBot.sendMessage(userJid, { 
                            audio: { url: helpers.getRandomItem(media.audioUrls) },
                            mimetype: 'audio/mp4',
                            ptt: true,
                            waveform: [100, 0, 100, 0, 100, 0, 100],
                            contextInfo: {
                                mentionedJid: [userJid],
                                externalAdReply: {
                                    title: 'Thanks for choosing Knight Bot 🛡️',
                                    body: 'Regards Mr Unique Hacker',
                                    thumbnailUrl: 'https://i.imgur.com/vTs9acV.jpeg',
                                    sourceUrl: 'https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A',
                                    mediaType: 1,
                                    renderLargerThumbnail: true,
                                },
                            },
                        });
                        console.log("🎵 Audio sent successfully");

                        // Send warning message
                        await KnightBot.sendMessage(userJid, {
                            text: `⚠️ Do not share this file with anybody ⚠️\n 
┌┤✑  Thanks for using Knight Bot
│└────────────┈ ⳹        
│©2025 Mr Unique Hacker 
└─────────────────┈ ⳹\n\n`
                        });
                        console.log("⚠️ Warning message sent successfully");

                        // Close connection and clean up
                        await delay(1000);
                        await KnightBot.ws.close();
                        helpers.removeFile(dirs);
                        console.log("✅ Session cleaned up successfully");
                        console.log("🎉 Process completed successfully!");

                    } catch (error) {
                        console.error("❌ Error sending messages:", error);
                        // Still clean up session even if sending fails
                        helpers.removeFile(dirs);
                    }
                }

                if (isNewLogin) {
                    console.log("🔐 New login via pair code");
                }

                if (isOnline) {
                    console.log("📶 Client is online");
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        console.log("❌ Logged out from WhatsApp. Need to generate new pair code.");
                        helpers.removeFile(dirs);
                    } else {
                        console.log("🔄 Connection closed — restarting...");
                        await delay(10000);
                        initiateSession();
                    }
                }
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000);
                num = num.replace(/[^\d+]/g, '');
                if (num.startsWith('+')) num = num.substring(1);

                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        console.log({ num, code });
                        await res.send({ code });
                    }
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to get pairing code. Please check your phone number and try again.' });
                    }
                    helpers.removeFile(dirs);
                }
            }

            KnightBot.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
            helpers.removeFile(dirs);
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    if (e.includes("Stream Errored")) return;
    if (e.includes("Stream Errored (restart required)")) return;
    if (e.includes("statusCode: 515")) return;
    if (e.includes("statusCode: 503")) return;
    console.log('Caught exception: ', err);
});

export default router;
