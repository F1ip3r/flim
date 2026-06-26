const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'flim.db');
const db = new Database(dbPath);

// Создание таблиц по отдельности (исправлено)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fromUser TEXT NOT NULL,
    toUser TEXT,
    groupName TEXT,
    text TEXT,
    files TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    members TEXT NOT NULL
  )
`);

// Функция для добавления колонки, если её нет
function addColumnIfNotExists(tableName, columnDef) {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const columnNames = tableInfo.map(row => row.name);
  const columnName = columnDef.split(' ')[0];
  if (!columnNames.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
    console.log(`✅ Добавлена колонка ${columnName} в таблицу ${tableName}`);
  }
}

// Добавляем колонки для пользователей (если их нет)
addColumnIfNotExists('users', 'avatar TEXT');
addColumnIfNotExists('users', 'bio TEXT');

// Для сообщений колонка files уже есть, но добавим на всякий случай
addColumnIfNotExists('messages', 'files TEXT');

// ---- Подготовка запросов ----
const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
const createUser = db.prepare('INSERT INTO users (username, passwordHash) VALUES (?, ?)');
const updateProfile = db.prepare('UPDATE users SET avatar = ?, bio = ? WHERE username = ?');
const getUserProfile = db.prepare('SELECT avatar, bio FROM users WHERE username = ?');
const searchUsers = db.prepare('SELECT username, avatar FROM users WHERE username LIKE ?');
const getAllMessagesForUser = db.prepare(`
  SELECT * FROM messages 
  WHERE fromUser = ? OR toUser = ?
  ORDER BY timestamp ASC
`);
const insertMessage = db.prepare(`
  INSERT INTO messages (fromUser, toUser, groupName, text, files) 
  VALUES (?, ?, ?, ?, ?)
`);
const getGroupMessages = db.prepare(`
  SELECT * FROM messages 
  WHERE groupName = ?
  ORDER BY timestamp ASC
`);
const getGroup = db.prepare('SELECT * FROM groups WHERE name = ?');
const createGroup = db.prepare('INSERT INTO groups (name, members) VALUES (?, ?)');
const getAllGroups = db.prepare('SELECT * FROM groups');

module.exports = {
  db,
  getUser,
  createUser,
  updateProfile,
  getUserProfile,
  searchUsers,
  getAllMessagesForUser,
  insertMessage,
  getGroupMessages,
  getGroup,
  createGroup,
  getAllGroups
};