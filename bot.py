import asyncio
import json
import logging
import time
import re # Added for regex parsing
import math
import os
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command # Добавил импорт Command
from aiogram.utils.keyboard import ReplyKeyboardBuilder
from aiogram.client.session.aiohttp import AiohttpSession

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

TOKEN = "8569798233:AAFwGBEapb9OALjfce8Uly-FTUshH3xXMyE"
ADMIN_ID = 6278269178
APP_URL = "https://a10nn-git-hub.github.io/A10m/"

session = AiohttpSession(proxy="http://proxy.server:3128")
bot = Bot(token=TOKEN, session=session)
dp = Dispatcher()

# Файл для хранения забаненных
BANS_FILE = "bans.json"

def load_bans():
    if not os.path.exists(BANS_FILE):
        return {}
    try:
        with open(BANS_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_bans(bans):
    with open(BANS_FILE, "w") as f:
        json.dump(bans, f)

# Список явно фейковых ID для бана
FAKE_IDS = ["12345678", "123456789", "99999999", "999999999", "11111111", "111111111", "00000000", "000000000", "66666666", "77777777", "123123123", "222222222", "333333334", "444444444", "987987987"]

@dp.message(F.text.lower() == "статус")
async def check_status(message: types.Message):
    await message.answer("🚀 Я на связи! Система банов активна.")

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    user_id = str(message.from_user.id)
    bans = load_bans()
    
    # Проверка на бан при старте
    if user_id in bans:
        unban_time = bans[user_id].get("unban_time", 0)
        if time.time() < unban_time:
            remaining_days = math.ceil((unban_time - time.time()) / (24 * 3600)) # Расчет оставшихся дней бана
            await message.answer(f"🚫 <b>ВЫ ЗАБАНЕНЫ ЗА ОБМАН НА {remaining_days} СУТОК.</b>\nОБЖАЛОВАТЬ - @A10mic", parse_mode="HTML")
            return # Не показываем кнопку

    builder = ReplyKeyboardBuilder()
    builder.row(types.KeyboardButton(
        text="📝 Подать заявку в A10m",
        web_app=types.WebAppInfo(url=APP_URL)
    ))
    
    # ИЗМЕНЕНИЕ: Убрали лишние примеры из текста, оставили только предупреждение
    await message.answer(
        "Привет! Нажми на кнопку ниже, чтобы заполнить анкету в клан [A10m].\n\n<i>⚠️ Внимание: Заполнение анкеты неверными/шуточными данными приведет к автоматической блокировке.</i>",
        reply_markup=builder.as_markup(resize_keyboard=True),
        parse_mode="HTML"
    )

# --- НОВОЕ: СЕКРЕТНАЯ КОМАНДА /bannedusers ---
@dp.message(Command("bannedusers"))
async def cmd_bannedusers(message: types.Message):
    # Работает ТОЛЬКО для админа
    if message.from_user.id != ADMIN_ID:
        return
        
    bans = load_bans()
    current_time = time.time()
    
    # Отфильтруем только тех, у кого бан еще не истек
    active_bans = {uid: data for uid, data in bans.items() if data.get("unban_time", 0) > current_time}
    
    if not active_bans:
        await message.answer("Список заблокированных пользователей пуст.")
        return
        
    text = "🛑 <b>Список заблокированных:</b>\n\n"
    for uid, data in active_bans.items():
        remaining_days = math.ceil((data['unban_time'] - current_time) / (24 * 3600))
        user_first_name = data.get("first_name", "Неизвестно")
        user_username = data.get("username")
        user_display_name = f"@{user_username}" if user_username else user_first_name
        text += f"👤 {user_display_name} (ID: <code>{uid}</code>) (Осталось: {remaining_days} дн.)\n🔓 Разблокировать: /unban_{uid}\n\n"
        
    await message.answer(text, parse_mode="HTML")

# --- НОВОЕ: ОБРАБОТЧИК РАЗБЛОКИРОВКИ ---
@dp.message(F.text.startswith("/unban_"))
async def cmd_unban(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
        
    try:
        target_id = message.text.split("_")[1]
    except IndexError:
        return
        
    bans = load_bans()
    
    if target_id in bans:
        del bans[target_id]
        save_bans(bans)
        await message.answer(f"✅ Пользователь с ID <code>{target_id}</code> успешно разблокирован!", parse_mode="HTML")
    else:
        await message.answer("⚠️ Этот пользователь не найден в списке забаненных.")

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        user_id = str(message.from_user.id)
        
        game_id = str(data.get('game_id', ''))
        age = int(data.get('age', 0))
        play_hours = int(data.get('play_hours', -1))
        rank_8 = str(data.get('rank_8', '')).lower() # Для проверки звания 8 сезона
        
        VALID_RANKS = ["бронза", "сильвер", "голд", "феникс", "рейнджер", "чемпион", "мастер", "элита", "легенда"]
        is_valid_rank_8 = any(rank_8.startswith(valid_r) for valid_r in VALID_RANKS)
        
        # --- СИСТЕМА БАНОВ (ЛОВУШКА ДЛЯ ТРОЛЛЕЙ) ---
        is_troll = False
        
        if play_hours == 0:
            is_troll = True
        elif age >= 90: # Баним дедов
            is_troll = True
        elif data.get('fname', '').lower() == 'иван' and data.get('lname', '').lower() == 'иванов': # Баним Ивана Иванова
            is_troll = True
        elif not is_valid_rank_8: # Баним за некорректное звание 8 сезона
            is_troll = True
        elif play_hours > 50: # Баним за слишком большое время игры
            is_troll = True
        elif game_id in FAKE_IDS or len(game_id) < 6: # Баним фейковые и слишком короткие ID
            is_troll = True
        elif rank_8.isdigit(): # Баним, если звание 8 сезона указано цифрами
            is_troll = True

        if is_troll:
            bans = load_bans()
            # Узнаем, сколько раз он уже косячил
            user_data = bans.get(user_id, {"offense_count": 0})
            new_count = user_data["offense_count"] + 1
            
            # Формула: 1-й раз = 14 дней, 2-й = 28 дней, 3-й = 56 дней...
            ban_days = 14 * (2 ** (new_count - 1)) 
            unban_time = time.time() + (ban_days * 24 * 3600)
            
            bans[user_id] = {
                "unban_time": unban_time,
                "offense_count": new_count, # Добавлена запятая
                "first_name": message.from_user.first_name,
                "username": message.from_user.username
            }
            save_bans(bans)
            
            logging.info(f"ПОЛЬЗОВАТЕЛЬ {user_id} ЗАБАНЕН НА {ban_days} ДНЕЙ ЗА ОБМАН.")
            await message.answer(f"🚫 <b>ВЫ ЗАБАНЕНЫ ЗА ОБМАН НА {ban_days} СУТОК.</b>\nОБЖАЛОВАТЬ - @A10mic", parse_mode="HTML")
            return # Прерываем функцию, админу ничего не отправляем!
        # -------------------------------------------

        # Если проверку прошел, формируем заявку
        user = message.from_user
        username = f"@{user.username}" if user.username else f"<a href='tg://user?id={user.id}'>{user.first_name}</a>"
        ds = "✅ Да" if data.get('discord') else "❌ Нет"
        days_str = ", ".join(data.get('days', []))
        
        text = (
            f"🚨 <b>НОВАЯ ЗАЯВКА В [A10m]</b> 🚨\n\n"
            f"👤 <b>Кандидат:</b> {data.get('fname')} {data.get('lname')}\n"
            f"🎂 <b>Возраст:</b> {data.get('age')}\n\n"
            
            f"🎮 <b>Айди в игре:</b> <code>{data.get('game_id')}</code>\n"
            f"🏆 <b>Макс. звание 10 сезон:</b> {data.get('rank')}\n"
            f"🏅 <b>Макс. звание 8 сезон:</b> {data.get('rank_8')}\n\n"
            
            f"🎧 <b>Дискорд:</b> {ds}\n"
            f"⏱ <b>Время игры:</b> {data.get('play_hours')} ч. в неделю\n"
            f"📅 <b>Дни игры:</b> {days_str}\n\n"
            
            f"💬 <b>Связь:</b> {username}"
            f"\n\n🆔 <b>ID пользователя для бана:</b> <code>{user_id}</code>" # Added user ID for manual ban
        )
        
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="HTML")
        await message.answer("✅ Отлично! Твоя заявка отправлена лидеру. Ожидай ответа.")
        
    except Exception as e:
        logging.error(f"ОШИБКА ПРИ ОБРАБОТКЕ ЗАЯВКИ: {e}")
        await message.answer("Произошла ошибка при отправке. Напиши лидеру напрямую.")

# --- НОВОЕ: КОМАНДА /ban ДЛЯ РУЧНОЙ БЛОКИРОВКИ ---
@dp.message(Command("ban"))
async def cmd_ban(message: types.Message):
    # Работает ТОЛЬКО для админа
    if message.from_user.id != ADMIN_ID:
        return

    if not message.reply_to_message:
        await message.answer("Эта команда должна быть использована в ответ на заявку пользователя, чтобы получить его ID.")
        return

    # Пытаемся извлечь ID пользователя из текста отвеченного сообщения
    replied_text = message.reply_to_message.html_text
    match = re.search(r"ID пользователя для бана: <code>(\d+)</code>", replied_text)

    if not match:
        await message.answer("Не удалось найти ID пользователя в отвеченном сообщении. Убедитесь, что это заявка.")
        return

    target_user_id = match.group(1)

    bans = load_bans()
    
    try:
        chat_info = await bot.get_chat(target_user_id)
        banned_user_first_name = chat_info.first_name
        banned_user_username = chat_info.username
    except Exception as e:
        logging.warning(f"Не удалось получить информацию о чате для пользователя {target_user_id}: {e}")
        banned_user_first_name = "Неизвестно"
        banned_user_username = None

    user_data = bans.get(target_user_id, {"offense_count": 0, "first_name": banned_user_first_name, "username": banned_user_username})
    new_count = user_data["offense_count"] + 1

    # Формула: 1-й раз = 14 дней, 2-й = 28 дней, 3-й = 56 дней...
    ban_days = 14 * (2 ** (new_count - 1))
    unban_time = time.time() + (ban_days * 24 * 3600)

    bans[target_user_id] = {
        "unban_time": unban_time,
        "offense_count": new_count,
        "first_name": banned_user_first_name,
        "username": banned_user_username
    }
    save_bans(bans)

    logging.info(f"АДМИН ЗАБАНИЛ ПОЛЬЗОВАТЕЛЯ {target_user_id} НА {ban_days} ДНЕЙ ВРУЧНУЮ.")
    await message.answer(f"✅ Пользователь с ID <code>{target_user_id}</code> успешно забанен на {ban_days} суток.", parse_mode="HTML")

    # Уведомляем забаненного пользователя
    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=f"🚫 <b>ВЫ ЗАБАНЕНЫ ЗА ОБМАН НА {ban_days} СУТОК.</b>\nОБЖАЛОВАТЬ - @A10mic",
            parse_mode="HTML"
        )
    except Exception as e:
        logging.error(f"Не удалось уведомить забаненного пользователя {target_user_id}: {e}")

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    logging.info("Бот запущен, система банов включена!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())