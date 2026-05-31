Документация мессенджера на Go + Vue 3

1. Обзор проекта

Данный проект — это минималистичный, но полностью рабочий мессенджер реального времени. Он состоит из:

· Backend на Go (Gin, WebSocket, GORM, PostgreSQL)
· Frontend на Vue 3 (Composition API, Pinia, Vue Router, Axios)

Функциональность:

· Регистрация и аутентификация (JWT)
· Отправка и получение сообщений через REST API и WebSocket
· Просмотр истории переписки

Архитектура построена на принципах масштабируемости: WebSocket Hub управляет подключениями, JWT защищает API и WS, сообщения хранятся в PostgreSQL.

2. Требования к окружению

· Go 1.21+
· Node.js 18+ и npm
· PostgreSQL 15+ (или Docker)
· (опционально) Redis для кеша/брокера, но в базовой версии не используется

3. Структура проекта

```
messenger/
├── backend/
│   ├── main.go                 # точка входа, инициализация
│   ├── go.mod / go.sum
│   ├── .env                    # переменные окружения
│   └── internal/
│       ├── models/             # GORM-модели (User, Message)
│       ├── database/           # подключение к БД, миграции
│       ├── handlers/           # HTTP-обработчики (auth, message, websocket)
│       ├── middleware/         # JWT-проверка
│       └── websocket/          # Hub + Client структуры
├── frontend/
│   ├── src/
│   │   ├── components/         # Login.vue, Chat.vue
│   │   ├── stores/             # Pinia store (auth, chat)
│   │   ├── router/             # маршруты
│   │   ├── App.vue
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml          # запуск PostgreSQL
```

4. Установка и запуск

4.1 Клонирование и настройка БД

```bash
git clone <repository>
cd messenger
docker-compose up -d   # запускает PostgreSQL:5432
```

Если нет Docker — установите PostgreSQL локально и создайте БД messenger.

4.2 Backend (Go)

```bash
cd backend
cp .env.example .env   # создайте файл .env с вашими переменными
go mod download
go run main.go
```

Содержимое .env:

```
PORT=8080
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=messenger
JWT_SECRET=your-secret-key-change-it
```

Сервер запустится на http://localhost:8080.

4.3 Frontend (Vue)

```bash
cd frontend
npm install
npm run dev
```

Фронтенд будет доступен на http://localhost:5173.

5. API Endpoints (REST)

Все эндпоинты, кроме регистрации и логина, требуют заголовок Authorization: Bearer <JWT>.

Метод URL Описание Тело запроса (JSON)
POST /api/register Регистрация нового пользователя {"username":"alice","password":"123"}
POST /api/login Аутентификация, получение JWT {"username":"alice","password":"123"}
POST /api/messages Отправка сообщения (REST) {"receiverId":2,"content":"Hi!"}
GET /api/messages/:userId Получить историю диалога с userId –
GET /api/ws WebSocket-соединение (с токеном) Параметр ?token=<JWT> в URL

Пример ответа логина:

```json
{
  "token": "eyJhbGciOiJIUzI1...",
  "userID": 1,
  "username": "alice"
}
```

6. WebSocket протокол

6.1 Подключение

Клиент устанавливает соединение:

```javascript
const ws = new WebSocket(`ws://localhost:8080/api/ws?token=${token}`);
```

При успешной аутентификации (JWT из query-параметра) сервер регистрирует клиента в Hub.

6.2 Формат сообщений

· От клиента к серверу (ожидается JSON):

```json
{
  "to": 2,
  "content": "Привет!"
}
```

При получении сервер может:

· Сохранить сообщение в БД,
· Отправить его конкретному пользователю через Hub.SendToUser().

(В текущей упрощённой версии сервер просто рассылает broadcast всем — для теста. В production нужно парсить to.)

· От сервера к клиенту (при отправке сообщения или широковещательно):

```json
{
  "id": 123,
  "content": "Привет!",
  "senderId": 1,
  "receiverId": 2,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

7. Основные компоненты фронтенда

7.1 Авторизация (Pinia store auth)

· Состояние: user, token
· Действия: login(), logout()
· При входе токен сохраняется в localStorage и добавляется в заголовки Axios.

7.2 Чат (Pinia store chat)

· Состояние: messages (массив), ws (WebSocket-объект)


· Действия:
  · initWebSocket(userId) – открывает WS‑соединение
  · sendMessage(to, content) – REST‑запрос на отправку
  · fetchMessages(otherUserId) – загружает историю

7.3 Компоненты

· Login.vue – форма входа/регистрации (регистрация добавлена отдельно, но в примере нет? Можно расширить)
· Chat.vue – основной интерфейс:
  · Поле ввода ID собеседника
  · Список сообщений
  · Поле ввода текста и кнопка отправки

8. Модели базы данных (GORM)

User

```go
type User struct {
    gorm.Model
    Username string `gorm:"unique;not null"`
    Password string `gorm:"not null"` // bcrypt hash
}
```

Message

```go
type Message struct {
    gorm.Model
    Content    string
    SenderID   uint
    ReceiverID uint
    // ChatID   uint  (для групповых чатов)
}
```

9. Запуск тестов (пример)

```bash
cd backend
go test ./...
```

(В проекте нет готовых тестов, но вы можете добавить unit-тесты для хэндлеров и WebSocket.)

10. Возможные улучшения

· Групповые чаты: добавить модель Chat с участниками, Message.ChatID.
· Статус «онлайн» – через WebSocket heartbeat и список активных пользователей.
· Индикатор набора текста – отдельный тип WS-сообщения.
· Сквозное шифрование (E2EE) – интеграция библиотек типа openpgp или signal‑протокола.
· Redis Pub/Sub для горизонтального масштабирования нескольких серверов.
· Docker-образы для бэкенда и фронтенда с Nginx.
