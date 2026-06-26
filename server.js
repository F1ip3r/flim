const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
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
} = require('./database');

const db = require('./database').db;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'flim-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Хранилище активных пользователей
const activeUsers = {};

// Middleware авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// ------------------- Роуты страниц -------------------
app.get('/', requireAuth, (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const error = req.query.error === 'invalid' ? 'Неверный логин или пароль' : '';
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Вход в flim</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Roboto, system-ui, sans-serif; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #6c8cff, #4a6cf7);
      padding: 20px;
    }
    .auth-card {
      background: white;
      border-radius: 32px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    .auth-card:hover { transform: translateY(-4px); }
    .auth-logo { text-align: center; font-size: 32px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; letter-spacing: -0.5px; }
    .auth-logo span { color: #6c8cff; }
    .auth-sub { text-align: center; color: #6b6f76; font-size: 16px; margin-bottom: 32px; }
    .auth-error { background: #fee2e2; color: #dc2626; padding: 10px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 20px; display: ${error ? 'block' : 'none'}; }
    .auth-field { position: relative; margin-bottom: 20px; }
    .auth-field .icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #8e9299; font-size: 18px; }
    .auth-field input {
      width: 100%;
      padding: 14px 16px 14px 48px;
      border: 2px solid #e8eaed;
      border-radius: 16px;
      font-size: 16px;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s;
      background: #f8f9fb;
    }
    .auth-field input:focus {
      border-color: #6c8cff;
      box-shadow: 0 0 0 4px rgba(108,140,255,0.15);
      background: white;
    }
    .auth-btn {
      width: 100%;
      padding: 16px;
      background: #6c8cff;
      color: white;
      border: none;
      border-radius: 16px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px;
    }
    .auth-btn:hover { background: #5a7ae0; }
    .auth-btn:active { transform: scale(0.98); }
    .auth-footer { text-align: center; margin-top: 24px; color: #6b6f76; font-size: 15px; }
    .auth-footer a { color: #6c8cff; text-decoration: none; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
    max-width: 480px { .auth-card { padding: 32px 24px; } }
  </style>
</head>
<body>
  <d


iv class="auth-card">
    <div class="auth-logo">flim<span>.</span></div>
    <div class="auth-sub">Добро пожаловать! Войдите в аккаунт</div>
    <div class="auth-error">${error}</div>
    <form action="/login" method="post">
      <div class="auth-field">
        <span class="icon">👤</span>
        <input type="text" name="username" placeholder="Имя пользователя" required autofocus>
      </div>
      <div class="auth-field">
        <span class="icon">🔒</span>
        <input type="password" name="password" placeholder="Пароль" required>
      </div>
      <button class="auth-btn" type="submit">Войти</button>
    </form>
    <div class="auth-footer">
      Нет аккаунта? <a href="/register">Зарегистрироваться</a>
    </div>
  </div>
</body>
</html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = getUser.get(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.redirect('/login?error=invalid');
  }
  req.session.user = username;
  res.redirect('/');
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const error = req.query.error === 'exists' ? 'Пользователь с таким именем уже существует' : '';
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Регистрация в flim</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Roboto, system-ui, sans-serif; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #6c8cff, #4a6cf7);
      padding: 20px;
    }
    .auth-card {
      background: white;
      border-radius: 32px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    .auth-card:hover { transform: translateY(-4px); }
    .auth-logo { text-align: center; font-size: 32px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; letter-spacing: -0.5px; }
    .auth-logo span { color: #6c8cff; }
    .auth-sub { text-align: center; color: #6b6f76; font-size: 16px; margin-bottom: 32px; }
    .auth-error { background: #fee2e2; color: #dc2626; padding: 10px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 20px; display: ${error ? 'block' : 'none'}; }
    .auth-field { position: relative; margin-bottom: 20px; }
    .auth-field .icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #8e9299; font-size: 18px; }
    .auth-field input {
      width: 100%;
      padding: 14px 16px 14px 48px;
      border: 2px solid #e8eaed;
      border-radius: 16px;
      font-size: 16px;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s;
      background: #f8f9fb;
    }
    .auth-field input:focus {
      border-color: #6c8cff;
      box-shadow: 0 0 0 4px rgba(108,140,255,0.15);
      background: white;
    }
    .auth-btn {
      width: 100%;
      padding: 16px;
      background: #6c8cff;
      color: white;
      border: none;
      border-radius: 16px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px;
    }
    .auth-btn:hover { background: #5a7ae0; }
    .auth-btn:active { transform: scale(0.98); }
    .auth-footer { text-align: center; margin-top: 24px; color: #6b6f76; font-size: 15px; }
    .auth-footer a { color: #6c8cff; text-decoration: none; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
    max-width: 480px { .auth-card { padding: 32px 24px; } }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="auth-logo">flim<span>.</span></div>
    <div class="auth-sub">Создайте аккаунт для работы в flim</div>
    <div class="auth-error">${error}</div>
    <form acti


on="/register" method="post">
      <div class="auth-field">
        <span class="icon">👤</span>
        <input type="text" name="username" placeholder="Придумайте логин" required autofocus>
      </div>
      <div class="auth-field">
        <span class="icon">🔒</span>
        <input type="password" name="password" placeholder="Придумайте пароль" required>
      </div>
      <button class="auth-btn" type="submit">Зарегистрироваться</button>
    </form>
    <div class="auth-footer">
      Уже есть аккаунт? <a href="/login">Войти</a>
    </div>
  </div>
</body>
</html>
  `);
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const existing = getUser.get(username);
  if (existing) return res.redirect('/register?error=exists');
  const hash = bcrypt.hashSync(password, 10);
  createUser.run(username, hash);
  req.session.user = username;
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ------------------- API -------------------
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.session.user });
});

app.get('/api/profile/:username', requireAuth, (req, res) => {
  const username = req.params.username;
  const profile = getUserProfile.get(username);
  if (!profile) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ username, ...profile });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const { avatar, bio } = req.body;
  const username = req.session.user;
  updateProfile.run(avatar || null, bio || null, username);
  res.json({ success: true });
});

app.get('/api/search', requireAuth, (req, res) => {
  const query = req.query.q || '';
  if (query.length < 2) return res.json([]);
  const users = searchUsers.all(`%${query}%`);
  const result = users.filter(u => u.username !== req.session.user);
  res.json(result);
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT username FROM users').all();
  res.json(users.map(u => u.username).filter(u => u !== req.session.user));
});

// ------------------- Загрузка файлов -------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/upload', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Файлы не загружены' });
  }
  const fileInfos = req.files.map(file => ({
    path: '/uploads/' + file.filename,
    type: file.mimetype.startsWith('image/') ? 'image' :
          file.mimetype.startsWith('video/') ? 'video' : 'file',
    name: file.originalname
  }));
  res.json({ files: fileInfos });
});

app.use('/uploads', express.static('uploads'));

// ------------------- Socket.IO -------------------
io.on('connection', (socket) => {
  let username = null;

  socket.on('user login', (name) => {
    const user = getUser.get(name);
    if (!user) return;
    username = name;
    activeUsers[socket.id] = name;
    socket.emit('login success', name);

    // Полный список всех пользователей
    const allUsers = db.prepare('SELECT username FROM users').all().map(row => row.username);
    socket.emit('user list', allUsers);

    // История всех личных сообщений
    const personal = getAllMessagesForUser.all(name, name);
    socket.emit('history', personal);

    // Список групп
    const allGroups = getAllGroups.all();
    const userGroups = allGroups
      .filter(g => JSON.parse(g.members).includes(name))
      .map(g => g.name);
    socket.emit('group list', userGroups);

    // Обновить онлайн-список для всех
    io.emit('users update', Object.values(activeUsers));
  });

  // Запрос истории личных сообщений с конкретным пользователем
  socket.on('get personal history', ({ withUser }) => {
    if (!username) return;
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?)
      ORDER BY timestamp ASC
    `).all(username, withUser, withUser, username);
    socket.emit('personal history', { withUser, messages });
  });

  // Личное сообщение
  socket.on('private message', ({ to, text, files }) => {
    if (!username) return;
    const filesJSON = files ? JSON.stringify(files) : null;
    const msgText = text || '';
    insertMessage.run(username, to, null, msgText, filesJSON);
    const msg = { from: username, to, text: msgText, files, timestamp: new Date().toISOString() };
    const recipientSocket = Object.keys(activeUsers).find(id => activeUsers[id] === to);
    if (recipientSocket) io.to(recipientSocket).emit('new message', msg);
    socket.emit('new message', msg);
  });

  // Групповое сообщение
  socket.on('group message', ({ group, text, files }) => {
    if (!username) return;
    const groupDoc = getGroup.get(group);
    if (!groupDoc) return;
    const members = JSON.parse(groupDoc.members);
    if (!members.includes(username)) return;
    const filesJSON = files ? JSON.stringify(files) : null;
    const msgText = text || '';
    insertMessage.run(username, null, group, msgText, filesJSON);
    const msg = { from: username, group, text: msgText, files, timestamp: new Date().toISOString() };
    members.forEach(member => {
      const memberSocket = Object.keys(activeUsers).find(id => activeUsers[id] === member);
      if (memberSocket) io.to(memberSocket).emit('new group message', msg);
    });
  });

  // Создание группы
  socket.on('create group', ({ name, members }) => {
    if (!username) return;
    const existing = getGroup.get(name);
    if (existing) return socket.emit('error', 'Группа уже существует');
    const allMembers = [...new Set([username, ...members])];
    createGroup.run(name, JSON.stringify(allMembers));
    allMembers.forEach(member => {
      const memberSocket = Object.keys(activeUsers).find(id => activeUsers[id] === member);
      if (memberSocket) io.to(memberSocket).emit('group created', name);
    });
    const allGroups = getAllGroups.all();
    io.emit('group list', allGroups.map(g => g.name));
  });

  // Получение истории группы
  socket.on('get group history', (group) => {
    if (!username) return;
    const groupDoc = getGroup.get(group);
    if (!groupDoc) return;
    const members = JSON.parse(groupDoc.members);
    if (!members.includes(username)) return;
    const messages = getGroupMessages.all(group);
    socket.emit('group history', messages);
  });

  // Отключение
  socket.on('disconnect', () => {
    if (activeUsers[socket.id]) {
      delete activeUsers[socket.id];
      io.emit('users update', Object.values(activeUsers));
    }
  });
});

// ------------------- Запуск -------------------
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 flim запущен на http://localhost:${PORT}`);
});