package models

import "gorm.io/gorm"

type Message struct {
    gorm.Model
    Content   string `gorm:"not null"`
    SenderID  uint
    ReceiverID uint
    ChatID    uint // для групповых чатов, опционально
}