<template>
  <div>
    <h2>Chat as {{ auth.user?.username }}</h2>
    <div>
      <input v-model="otherUserId" placeholder="Receiver ID" />
      <button @click="loadMessages">Load chat</button>
    </div>
    <div v-for="msg in chat.messages" :key="msg.id">
      <b>{{ msg.senderID === auth.user?.id ? 'Me' : 'Other' }}:</b> {{ msg.content }}
    </div>
    <input v-model="newMessage" @keyup.enter="send" />
    <button @click="send">Send</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'

const auth = useAuthStore()
const chat = useChatStore()
const otherUserId = ref('')
const newMessage = ref('')

onMounted(() => {
  chat.initWebSocket(auth.user.id)
})

function loadMessages() {
  chat.fetchMessages(otherUserId.value)
}

function send() {
  if (!otherUserId.value) return
  chat.sendMessage(parseInt(otherUserId.value), newMessage.value)
  newMessage.value = ''
}
</script>