import { defineStore } from 'pinia'
import axios from 'axios'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    ws: null
  }),
  actions: {
    initWebSocket(userId) {
      this.ws = new WebSocket(`ws://localhost:8080/api/ws?token=${localStorage.getItem('token')}`)
      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        this.messages.push(data)
      }
    },
    sendMessage(to, content) {
      axios.post('http://localhost:8080/api/messages', { receiverId: to, content })
    },
    async fetchMessages(otherUserId) {
      const res = await axios.get(`http://localhost:8080/api/messages/${otherUserId}`)
      this.messages = res.data
    }
  }
})