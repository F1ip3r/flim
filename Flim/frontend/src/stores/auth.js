import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || ''
  }),
  actions: {
    async login(username, password) {
      const res = await axios.post('http://localhost:8080/api/login', { username, password })
      this.token = res.data.token
      this.user = { id: res.data.userID, username: res.data.username }
      localStorage.setItem('token', this.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
    }
  }
})