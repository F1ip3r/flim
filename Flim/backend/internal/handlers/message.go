package handlers

import (
    "net/http"
    "messenger/internal/database"
    "messenger/internal/models"
    "github.com/gin-gonic/gin"
)

type SendMessageInput struct {
    ReceiverID uint   `json:"receiverId"`
    Content    string `json:"content"`
}

func SendMessage(c *gin.Context) {
    senderID := c.GetUint("userID")
    var input SendMessageInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    msg := models.Message{
        SenderID:   senderID,
        ReceiverID: input.ReceiverID,
        Content:    input.Co
Current Time Now
Current Time Now
time.now


ntent,
    }
    database.DB.Create(&msg)
    // WebSocket отправка будет вызываться отдельно через hub
    c.JSON(http.StatusOK, msg)
}

func GetMessages(c *gin.Context) {
    userID := c.GetUint("userID")
    otherID := c.Param("userId")
    var messages []models.Message
    database.DB.Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", userID, otherID, otherID, userID).
        Order("created_at asc").Find(&messages)
    c.JSON(http.StatusOK, messages)
}