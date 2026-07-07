const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const BIN_DIR = path.join(__dirname, 'src-tauri', 'bin');
const MODELS_DIR = path.join(__dirname, 'src-tauri', 'models');

if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin';
const MODEL_DEST = path.join(MODELS_DIR, 'ggml-large-v3-q5_0.bin');

const WHISPER_ZIP_URL = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.6.2/whisper-cublas-12.4.0-bin-x64.zip';
const ZIP_DEST = path.join(BIN_DIR, 'whisper-cublas.zip');

function download(url, dest, name) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`[${name}] Already exists, skipping download.`);
            return resolve();
        }
        console.log(`[${name}] Downloading from ${url}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return download(response.headers.location, dest, name).then(resolve).catch(reject);
            }
            
            const total = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;
            
            response.pipe(file);
            response.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = ((downloaded / total) * 100).toFixed(2);
                process.stdout.write(`\r[${name}] Progress: ${percent}% (${(downloaded/1024/1024).toFixed(2)} MB)`);
            });
            
            file.on('finish', () => {
                file.close();
                console.log(`\n[${name}] Download complete!`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}

async function main() {
    try {
        await download(WHISPER_ZIP_URL, ZIP_DEST, 'Whisper Binary');
        
        console.log('Extracting Whisper Binary...');
        try {
            execSync(`powershell -command "Expand-Archive -Force -Path '${ZIP_DEST}' -DestinationPath '${BIN_DIR}'"`);
            console.log('Extraction complete.');
            // Copy server.exe to root of bin for easy access, and rename for Tauri sidecar pattern
            // Tauri sidecar requires the binary name to be `<name>-<target-triple>.exe`
            // We will just call it `whisper-server-x86_64-pc-windows-msvc.exe`
            const serverSrc = path.join(BIN_DIR, 'whisper-cublas-12.4.0-bin-x64', 'server.exe');
            const serverDest = path.join(BIN_DIR, 'whisper-server-x86_64-pc-windows-msvc.exe');
            if (fs.existsSync(serverSrc)) {
                fs.copyFileSync(serverSrc, serverDest);
                console.log(`Copied server.exe to ${serverDest}`);
            }
            // Need to copy DLLs as well to the same directory
            const extractDir = path.join(BIN_DIR, 'whisper-cublas-12.4.0-bin-x64');
            const files = fs.readdirSync(extractDir);
            for (const f of files) {
                if (f.endsWith('.dll')) {
                    fs.copyFileSync(path.join(extractDir, f), path.join(BIN_DIR, f));
                }
            }
        } catch (e) {
            console.error('Extraction failed', e.message);
        }

        await download(MODEL_URL, MODEL_DEST, 'Whisper Model (large-v3-q5_0)');
        console.log('All downloads finished successfully!');
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
