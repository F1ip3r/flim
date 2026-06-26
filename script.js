const socket = io();

let currentUser = null;
let currentChat = null;
let allUsers = [];
let onlineUsers = [];
let allGroups = [];
let chatMessages = {};
let unreadCounts = {};
let userAvatars = {};
let pendingFiles = [];

// DOM
const chatsList = document.getElementById('chats-list');
const messagesList = document.getElementById('messages-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const chatTitle = document.getElementById('chat-title');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const userAvatar = document.getElementById('avatar');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const createGroupBtn = document.getElementById('create-group-btn');
const groupModal = document.getElementById('group-modal');
const groupNameInput = document.getElementById('group-name');
const groupMembersList = document.getElementById('group-members-list');
const groupCreateConfirm = document.getElementById('group-create-confirm');
const groupModalClose = document.getElementById('group-modal-close');
const profileModal = document.getElementById('profile-modal');
const profileAvatarImg = document.getElementById('profile-avatar-img');
const profileBio = document.getElementById('profile-bio');
const profileSave = document.getElementById('profile-save');
const profileClose = document.getElementById('profile-close');
const avatarUpload = document.getElementById('avatar-upload');
const fileInput = document.getElementById('file-input');
const fileIndicator = document.getElementById('file-indicator');

// ---- Авторизация ----
async function getCurrentUser() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      return data.username;
    } else {
      window.location.href = '/login';
      return null;
    }
  } catch(e) {
    console.error(e);
    window.location.href = '/login';
    return null;
  }
}

// ---- Вспомогательные ----
function getAvatar(name) {
  if (!name) return '?';
  if (userAvatars[name]) return userAvatars[name];
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getChatId(chat) {
  return (chat.type === 'user' ? 'user:' : 'group:') + chat.name;
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString();
}

async function loadUserAvatar(username) {
  if (userAvatars[username]) return;
  try {
    const res = await fetch(`/api/profile/${username}`);
    if (res.ok) {
      const data = await res.json();
      if (data.avatar) {
        userAvatars[username] = data.avatar;
        renderChats();
        if (currentChat && currentChat.type === 'user' && currentChat.name === username) {
          chatAvatar.textContent = '';
          chatAvatar.style.backgroundImage = `url(${data.avatar})`;
          chatAvatar.style.backgroundSize = 'cover';
        }
      }
    }
  } catch(e) {}
}

function parseMessage(msg) {
  if (msg.files && typeof msg.files === 'string') {
    try {
      msg.files = JSON.parse(msg.files);
    } catch(e) {
      msg.files = [];
    }
  }
  return msg;
}

// ---- Рендеринг ----
function renderMessages(chatId) {
  messagesList.innerHTML = '';
  const msgs = chatMessages[chatId] || [];
  let lastDate = null;
  msgs.forEach(msg => {
    const date = new Date(msg.timestamp).toDateString();
    if (date !== lastDate) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'message system';
      dateDiv.textContent = formatDate(msg.timestamp);
      messagesList.appendChild(dateDiv);
      lastDate = date;
    }
    const div = document.createElement('div');
    div.className = 'message';
    if (msg.from === currentUser) div.classList.add('self');
    else div.classList.add('other');

    if (msg.text) {
      const textSpan = document.createElement('span');
      textSpan.textContent = msg.text;
      div.appendChild(textSpan);
    }

    if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
      msg.files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.style.marginTop = '6px';
        if (file.type === 'image') {
          const img = document.createElement('img');
          img.src = file.path;
          img.style.maxWidth = '200px';
          img.style.borderRadius = '12px';
          img.style.marginRight = '6px';
          fileDiv.appendChild(img);
        } else if (file.type === 'video') {
          const video = document.createElement('video');
          video.src = file.path;
          video.controls = true;
          video.style.maxWidth = '200px';
          video.style.borderRadius = '12px';
          video.style.marginRight = '6px';
          fileDiv.appendChild(video);
        } else {
          const link = document.createElement('a');
          link.href = file.path;
          link.target = '_blank';
          link.textContent = '📎 ' + file.name;
          link.style.display = 'block';
          fileDiv.appendChild(link);
        }
        div.appendChild(fileDiv);
      });
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = formatTime(msg.timestamp);
    div.appendChild(timeSpan);
    messagesList.appendChild(div);
  });
  messagesList.scrollTop = messagesList.scrollHeight;
}

function renderChats() {
  const chatItems = [];
  allUsers.forEach(user => {
    if (user === currentUser) return;
    const chatId = 'user:' + user;
    const msgs = chatMessages[chatId] || [];
    const lastMsg = msgs.length ? msgs[msgs.length-1] : null;
    chatItems.push({
      id: chatId,
      type: 'user',
      name: user,
      lastMsg: lastMsg,
      unread: unreadCounts[chatId] || 0,
      online: onlineUsers.includes(user)
    });
  });
  allGroups.forEach(group => {
    const chatId = 'group:' + group;
    const msgs = chatMessages[chatId] || [];
    const lastMsg = msgs.length ? msgs[msgs.length-1] : null;
    chatItems.push({
      id: chatId,
      type: 'group',
      name: group,
      lastMsg: lastMsg,
      unread: unreadCounts[chatId] || 0,
      online: true
    });
  });

  chatItems.sort((a,b) => {
    const tA = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
    const tB = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
    return tB - tA;
  });

  chatsList.innerHTML = '';
  chatItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChat && getChatId(currentChat) === item.id) div.classList.add('active');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (item.type === 'user') {
      if (userAvatars[item.name]) {
        avatar.style.backgroundImage = `url(${userAvatars[item.name]})`;
        avatar.style.backgroundSize = 'cover';
        avatar.textContent = '';
      } else {
        avatar.textContent = getAvatar(item.name);
        loadUserAvatar(item.name);
      }
    } else {
      avatar.textContent = '👥';
    }
    div.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'name';
    nameDiv.textContent = item.type === 'user' ? item.name : '👥 ' + item.name;
    if (item.unread > 0) {
      const badge = document.createElement('span');
      badge.style.cssText = 'background:#6c8cff; color:white; border-radius:10px; padding:0 8px; margin-left:8px; font-size:12px;';
      badge.textContent = item.unread;
      nameDiv.appendChild(badge);
    }
    info.appendChild(nameDiv);
    const lastMsgDiv = document.createElement('div');
    lastMsgDiv.className = 'last-message';
    if (item.lastMsg) {
      let text = item.lastMsg.text || '';
      if (item.lastMsg.files && item.lastMsg.files.length) {
        text += (text ? ' ' : '') + `📎 ${item.lastMsg.files.length} файл(а)`;
      }
      if (item.lastMsg.from === currentUser) text = 'Вы: ' + text;
      else if (item.type === 'group') text = item.lastMsg.from + ': ' + text;
      lastMsgDiv.textContent = text;
    } else {
      lastMsgDiv.textContent = 'Нет сообщений';
    }
    info.appendChild(lastMsgDiv);
    div.appendChild(info);

    if (item.lastMsg) {
      const timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      timeDiv.textContent = formatTime(item.lastMsg.timestamp);
      div.appendChild(timeDiv);
    }

    if (item.type === 'user') {
      const dot = document.createElement('span');
      dot.className = item.online ? 'online-dot' : 'offline-dot';
      div.prepend(dot);
    }

    div.dataset.chatId = item.id;
    div.addEventListener('click', () => selectChat(item.id));
    chatsList.appendChild(div);
  });
}

function selectChat(chatId) {
  const parts = chatId.split(':');
  const type = parts[0];
  const name = parts.slice(1).join(':');
  currentChat = { type, name };
  chatTitle.textContent = type === 'user' ? name : '👥 ' + name;
  chatAvatar.textContent = '';
  if (type === 'user' && userAvatars[name]) {
    chatAvatar.style.backgroundImage = `url(${userAvatars[name]})`;
    chatAvatar.style.backgroundSize = 'cover';
  } else if (type === 'user') {
    chatAvatar.textContent = getAvatar(name);
    chatAvatar.style.backgroundImage = '';
  } else {
    chatAvatar.textContent = '👥';
    chatAvatar.style.backgroundImage = '';
  }
  chatStatus.textContent = type === 'user' ? (onlineUsers.includes(name) ? 'В сети' : 'Не в сети') : 'Группа';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
  unreadCounts[chatId] = 0;
  renderChats();
  renderMessages(chatId);

  // Если личный чат и нет сообщений – запросим историю
  if (type === 'user' && (!chatMessages[chatId] || chatMessages[chatId].length === 0)) {
    socket.emit('get personal history', { withUser: name });
  }
  // Если группа – запросим историю группы
  if (type === 'group' && (!chatMessages[chatId] || chatMessages[chatId].length === 0)) {
    socket.emit('get group history', name);
  }
}

function addMessageToUI(chatId, msg, prepend = false) {
  if (!chatMessages[chatId]) chatMessages[chatId] = [];
  const msgObj = { ...msg, timestamp: msg.timestamp || Date.now() };
  if (prepend) chatMessages[chatId].unshift(msgObj);
  else chatMessages[chatId].push(msgObj);
  if (currentChat && getChatId(currentChat) === chatId) {
    renderMessages(chatId);
  }
}

function sendMessage() {
  const text = messageInput.value.trim();
  if ((!text && pendingFiles.length === 0) || !currentChat || !currentUser) return;
  const chatId = getChatId(currentChat);
  const payload = { text: text || '' };
  if (pendingFiles.length > 0) {
    payload.files = pendingFiles;
  }
  if (currentChat.type === 'user') {
    socket.emit('private message', { ...payload, to: currentChat.name });
  } else if (currentChat.type === 'group') {
    socket.emit('group message', { ...payload, group: currentChat.name });
  }
  messageInput.value = '';
  pendingFiles = [];
  fileIndicator.style.display = 'none';
  fileIndicator.textContent = '';
}

// ---- Загрузка файлов ----
fileInput.addEventListener('change', async function(e) {
  const files = this.files;
  if (!files.length) return;
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  try {
    const res = await fetch('/upload', {
      method: 'POST',body: formData
    });
    if (res.ok) {
      const data = await res.json();
      pendingFiles = data.files;
      if (pendingFiles.length > 0) {
        fileIndicator.textContent = `📎 ${pendingFiles.length} файл(а) готово`;
        fileIndicator.style.display = 'inline';
      } else {
        fileIndicator.style.display = 'none';
      }
    } else {
      alert('Ошибка загрузки файлов');
    }
  } 
    catch(e) {
    console.error(e);
  }
  this.value = '';
});

// ---- Поиск ----
searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const users = await res.json();
    searchResults.innerHTML = '';
    if (users.length === 0) {
      searchResults.style.display = 'none';
      return;
    }
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = getAvatar(u.username);
      div.appendChild(avatar);
      const name = document.createElement('span');
      name.textContent = u.username;
      div.appendChild(name);
      div.addEventListener('click', () => {
        const chatId = 'user:' + u.username;
        if (!chatMessages[chatId]) chatMessages[chatId] = [];
        if (!allUsers.includes(u.username)) allUsers.push(u.username);
        selectChat(chatId);
        searchResults.style.display = 'none';
        searchInput.value = '';
        renderChats();
      });
      searchResults.appendChild(div);
    });
    searchResults.style.display = 'block';
  } catch(e) {
    console.error(e);
  }
});

// ---- Профиль ----
userAvatar.addEventListener('click', openProfile);
chatAvatar.addEventListener('click', openProfile);

async function openProfile() {
  try {
    const res = await fetch(`/api/profile/${currentUser}`);
    const data = await res.json();
    if (data.avatar) {
      profileAvatarImg.src = data.avatar;
    } else {
      profileAvatarImg.src = '';
    }
    profileBio.value = data.bio || '';
    profileModal.style.display = 'flex';
  } catch(e) {}
}

profileClose.addEventListener('click', () => {
  profileModal.style.display = 'none';
});

profileSave.addEventListener('click', async () => {
  const avatar = profileAvatarImg.src;
  const bio = profileBio.value;
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar, bio })
    });
    if (res.ok) {
      userAvatars[currentUser] = avatar;
      userAvatar.style.backgroundImage = avatar ? `url(${avatar})` : '';
      userAvatar.style.backgroundSize = 'cover';
      userAvatar.textContent = avatar ? '' : getAvatar(currentUser);
      profileModal.style.display = 'none';
      renderChats();
    }
  } catch(e) {}
});

avatarUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    profileAvatarImg.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ---- Группа ----
createGroupBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    groupMembersList.innerHTML = '';
    users.forEach(u => {
      const label = document.createElement('label');
      label.className = 'member-checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = u;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(u));
      groupMembersList.appendChild(label);
    });
    groupModal.style.display = 'flex';
  } catch(e) {}
});

groupModalClose.addEventListener('click', () => {
  groupModal.style.display = 'none';
});

groupCreateConfirm.addEventListener('click', () => {
  const name = groupNameInput.value.trim();
  if (!name) return alert('Введите название');
  const checkboxes = groupMembersList.querySelectorAll('input[type="checkbox"]:checked');
  const members = Array.from(checkboxes).map(cb => cb.value);
  socket.emit('create group', { name, members });
  groupModal.style.display = 'none';
  groupNameInput.value = '';
});

// ---- Socket.IO ----
socket.on('login success', (name) => {
  currentUser = name;
  userAvatar.textContent = getAvatar(name);
  usernameDisplay.textContent = name;
  loadUserAvatar(name).then(() => {
    if (userAvatars[name]) {
      userAvatar.style.backgroundImage = `url(${userAvatars[name]})`;
      userAvatar.style.backgroundSize = 'cover';
      userAvatar.textContent = '';
    }
  });
});

socket.on('user list', (users) => {
  allUsers = users;
  renderChats();
});

socket.on('users update', (online) => {
  onlineUsers = online;
  renderChats();
  if (currentChat && currentChat.type === 'user') {
    chatStatus.textContent = onlineUsers.includes(currentChat.name) ? 'В сети' : 'Не в сети';
  }
});

socket.on('history', (msgs) => {
  msgs = msgs.map(parseMessage);
  msgs.forEach(msg => {
    const other = msg.from === currentUser ? msg.to : msg.from;
    if (!other) return;
    const chatId = 'user:' + other;
    if (!chatMessages[chatId]) chatMessages[chatId] = [];
    chatMessages[chatId].push(msg);
  });
  Object.keys(chatMessages).forEach(key => {
    if (key.startsWith('user:')) {
      chatMessages[key].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
  });
  renderChats();
  if (currentChat && currentChat.type === 'user') {
    renderMessages(getChatId(currentChat));
  }
});

socket.on('personal history', ({ withUser, messages }) => {
  messages = messages.map(parseMessage);
  const chatId = 'user:' + withUser;
  if (!chatMessages[chatId]) chatMessages[chatId] = [];
  chatMessages[chatId] = messages;
  if (currentChat && currentChat.type === 'user' && currentChat.name === withUser) {
    renderMessages(chatId);
    renderChats();
  }
});

socket.on('new message', (msg) => {
  msg = parseMessage(msg);
  const other = msg.from === currentUser ? msg.to : msg.from;
  if (!other) return;
  const chatId = 'user:' + other;
  addMessageToUI(chatId, msg);
  if (msg.from !== currentUser && currentChat && getChatId(currentChat) !== chatId) {
    unreadCounts[chatId] = (unreadCounts[chatId] || 0) + 1;
  }
  renderChats();
  if (currentChat && getChatId(currentChat) === chatId) {
    renderMessages(chatId);
  }
});

socket.on('new group message', (msg) => {
  msg = parseMessage(msg);
  const chatId = 'group:' + msg.group;
  addMessageToUI(chatId, msg);
  if (msg.from !== currentUser && currentChat && getChatId(currentChat) !== chatId) {
    unreadCounts[chatId] = (unreadCounts[chatId] || 0) + 1;
  }
  renderChats();
  if (currentChat && getChatId(currentChat) === chatId) {
    renderMessages(chatId);
  }
});

socket.on('group created', (name) => {
  allGroups.push(name);
  chatMessages['group:' + name] = [];
  renderChats();
});

socket.on('group list', (groups) => {
  allGroups = groups;
  groups.forEach(g => {
    if (!chatMessages['group:' + g]) chatMessages['group:' + g] = [];
  });
  renderChats();
});

socket.on('group history', (msgs) => {
  msgs = msgs.map(parseMessage);
  if (currentChat && currentChat.type === 'group') {
    const chatId = getChatId(currentChat);
    chatMessages[chatId] = msgs;
    renderMessages(chatId);
    renderChats();
  }
});

// ---- UI ----
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

logoutBtn.addEventListener('click', () => {
  window.location.href = '/logout';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#search')) {
    searchResults.style.display = 'none';
  }
});

// ---- Инициализация ----
async function init() {
  const username = await getCurrentUser();
  if (!username) return;
  socket.emit('user login', username);
}

init();


