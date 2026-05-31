package websocket

import (
    "sync"
    "github.com/gorilla/websocket"
)

type Client struct {
    UserID uint
    Conn   *websocket.Conn
    Send   chan []byte
}

type Hub struct {
    clients    map[uint]@club226027682 (*Client)
    broadcast  chan []byte          // сообщение для всех
    register   chan @club226027682 (*Client)
    unregister chan uint
    mu         sync.Mutex
}

func NewHub() *Hub {
    return &Hub{
        clients:    mak


e(map[uint]@club226027682 (*Client)),
        broadcast:  make(chan []byte),
        register:   make(chan @club226027682 (*Client)),
        unregister: make(chan uint),
    }
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client.UserID] = client
            h.mu.Unlock()
        case userID := <-h.unregister:
            h.mu.Lock()
            if client, ok := h.clients[userID]; ok {
                close(client.Send)
                delete(h.clients, userID)
            }
            h.mu.Unlock()
        case message := <-h.broadcast:
            h.mu.Lock()
            for _, client := range h.clients {
                select {
                case client.Send <- message:
                default:
                    close(client.Send)
                    delete(h.clients, client.UserID)
                }
            }
            h.mu.Unlock()
        }
    }
}

func (h *Hub) SendToUser(userID uint, message []byte) {
    h.mu.Lock()
    client, ok := h.clients[userID]
    h.mu.Unlock()
    if ok {
        select {
        case client.Send <- message:
        default:
            close(client.Send)
            h.mu.Lock()
            delete(h.clients, userID)
            h.mu.Unlock()
        }
    }
}