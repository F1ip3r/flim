package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "messenger/internal/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}
var HubInstance *websocket.Hub

func InitWebSocketHub() {
    HubInstance = websocket.NewHub()
    go HubInstance.Run()
}

func HandleWebSocket(c *gin.Context) {
    userID := c.GetUint("userID")
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }
    client := &websocket.Client{
        UserID: userID,
        Conn:   conn,
        Send:   make(chan []byte, 256),
    }
    HubInstance.Register <- client

    // горутина чтения
    go func() {
        defer func() {
            HubInstance.Unregister <- userID
            conn.Close()
        }()
        for {
            _, message, err := conn.ReadMessage()
            if err != nil {
                break
            }
            // ожидаем JSON: {"to": userID, "content": "text"}
            // можно парсить и отправлять через HubInstance.SendToUser(...)
            // упростим: broadcast всем (для теста)
            HubInstance.Broadcast <- message
        }
    }()

    // горутина записи
    go func() {
        for msg := range client.Send {
            if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
                break
            }
        }
    }()
}