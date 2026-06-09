const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const DB_URL = "https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app/app_version.json";

let geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        try {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const idx = trimmed.indexOf('=');
                    if (idx !== -1) {
                        const key = trimmed.substring(0, idx).trim();
                        const val = trimmed.substring(idx + 1).trim();
                        if (key === 'GEMINI_API_KEY') {
                            geminiApiKey = val.replace(/^["']|["']$/g, '');
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Предупреждение: Не удалось прочитать локальный файл .env:", e.message);
        }
    }
}
const GEMINI_API_KEY = geminiApiKey;

// Helper to make HTTPS requests
function makeRequest(url, method, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(body ? JSON.parse(body) : null);
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

function incrementVersionString(vStr) {
    vStr = String(vStr).trim();
    let match = vStr.match(/^(\d+)\.(\d+)$/);
    if (!match) {
        let num = parseFloat(vStr);
        if (isNaN(num)) return "1.0";
        return (num + 0.1).toFixed(1);
    }
    let major = parseInt(match[1]);
    let minorStr = match[2];
    let numDigits = minorStr.length;
    let minor = parseInt(minorStr);
    minor += 1;
    let nextMinorStr = String(minor).padStart(numDigits, '0');
    return `${major}.${nextMinorStr}`;
}

async function main() {
    console.log("=== Автоматизация версий и патчноутов ===");

    // Parse command line arguments for manual override
    let manualVersion = null;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--version' || args[i] === '-v') {
            manualVersion = args[i + 1];
            break;
        } else if (!args[i].startsWith('-') && /^\d+\.\d+$/.test(args[i])) {
            manualVersion = args[i];
            break;
        }
    }

    // 1. Get current version from Firebase DB
    let currentVer = "1.0";
    try {
        console.log("Получение текущей версии из Firebase...");
        const dbData = await makeRequest(DB_URL, "GET");
        if (dbData && dbData.version) {
            currentVer = dbData.version;
            console.log(`Текущая версия в Firebase: ${currentVer}`);
        } else {
            console.log("Версия в Firebase не найдена, используем 1.0 как базу.");
        }
    } catch (err) {
        console.warn("Предупреждение: Не удалось получить текущую версию из Firebase, используем fallback 1.0.", err.message);
    }

    // 2. Determine target version
    let targetVer;
    if (manualVersion) {
        targetVer = manualVersion;
        console.log(`Используется ручное переопределение версии: ${targetVer}`);
    } else {
        targetVer = incrementVersionString(currentVer);
        console.log(`Авто-инкремент версии: ${currentVer} -> ${targetVer}`);
    }

    // 3. Read Update_plan.md locally
    const planPath = path.join(__dirname, 'Update_plan.md');
    if (!fs.existsSync(planPath)) {
        console.error("Ошибка: Файл Update_plan.md не найден в текущей папке.");
        process.exit(1);
    }
    const planText = fs.readFileSync(planPath, 'utf8');

    // 4. Generate patchnote with Gemini API
    let patchnote = "Автоматическое обновление версии.";
    if (!GEMINI_API_KEY) {
        console.warn("Предупреждение: Переменная окружения GEMINI_API_KEY не установлена. Пропускаем генерацию ИИ патчноута.");
    } else {
        try {
            console.log("Генерация патчноута через Gemini API...");
            const prompt = `Проанализируй данный документ Update_plan.md и составь очень краткий список изменений (патчноут) на русском языке для версии ${targetVer}. Верни только сам список изменений в виде текста или маркированного списка (максимум 4-5 коротких пунктов), без лишних предисловий или мета-комментариев. Документ:\n\n${planText}`;
            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }]
            };
            const response = await makeRequest(geminiUrl, "POST", requestBody);
            const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedText) {
                patchnote = generatedText.trim();
                console.log("Сгенерированный патчноут:\n" + patchnote);
            } else {
                console.warn("Ответ от Gemini API пустой или некорректный. Используем стандартное описание.");
            }
        } catch (err) {
            console.error("Ошибка при генерации патчноута через Gemini API:", err.message);
        }
    }

    // 5. Write back to Firebase DB
    try {
        console.log("Запись новой версии и патчноута в Firebase...");
        const updatePayload = {
            version: targetVer,
            patchnote: patchnote
        };
        await makeRequest(DB_URL, "PUT", updatePayload);
        console.log(`Успешно обновлено! Новая версия: ${targetVer}`);
    } catch (err) {
        console.error("Ошибка при записи версии в Firebase:", err.message);
        process.exit(1);
    }
}

main();
