package main

import (
    "log"
    "os"
    "github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
    "messenger/internal/database"
    "messenger/internal/handlers"
    "messenger/internal/middleware"
)

func main() {
    godotenv.Load()
    database.InitDB()
    handlers.InitWebSocketHub()

    r := gin.Default()
    r.POST("/api/register", handlers.Register)
    r.POST("/api/login", handlers.Login)

    api := r.Group("/api")
    api.Use(middleware.AuthMiddleware())
    {
        api.GET("/ws", handlers.HandleWebSocket)
        api.POST("/messages", handlers.SendMessage)
        api.GET("/messages/:userId", handlers.GetMessages)
    }

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Fatal(r.Run(":" + port))
}