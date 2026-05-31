package handlers

import (
    "net/http"
    "os"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "golang.org/x/crypto/bcrypt"
    "messenger/internal/database"
    "messenger/internal/models"
)

type LoginInput struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type RegisterInput struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

func Register(c *gin.Context) {
    var input RegisterInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
    user := models.User{Username: input.Username, Password: string(hashed)}
    if err := database.DB.Create(&user).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "username already exists"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"message": "user created"})
}

func Login(c *gin.Context) {
    var input LoginInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    var user models.User
    if err := database.DB.Where("username = ?", input.Username).First(&user).Error; err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }
    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "userID": user.ID,
        "exp":    time.Now().Add(time.Hour * 72).Unix(),
    })
    tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
    c.JSON(http.StatusOK, gin.H{"token": tokenString, "userID": user.ID, "username": user.Username})
}