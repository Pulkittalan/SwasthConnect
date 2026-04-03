import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import './Chat.css';

const Chat = ({ chatId, currentUser, otherUser, userType, onVideoCall }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat if it doesn't exist
  const initializeChat = useCallback(async () => {
    if (!chatId || !currentUser || !otherUser) return;
    
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, otherUser.id],
          participantNames: {
            [currentUser.uid]: currentUser.displayName || userType,
            [otherUser.id]: otherUser.name
          },
          participantTypes: {
            [currentUser.uid]: userType,
            [otherUser.id]: otherUser.id?.startsWith('doc') ? 'doctor' : 'patient'
          },
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [otherUser.id]: 0
          }
        });
        console.log('Chat initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }, [chatId, currentUser, otherUser, userType]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  useEffect(() => {
    if (!chatId) return;
    
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setMessages(messagesList);
      
      // Mark messages as read
      const unreadMessages = messagesList.filter(m => 
        m.senderId !== currentUser.uid && !m.read
      );
      
      unreadMessages.forEach(async (msg) => {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
          read: true
        });
      });
      
      // Update unread count in chat document
      if (unreadMessages.length > 0 && otherUser) {
        updateDoc(doc(db, 'chats', chatId), {
          [`unreadCount.${currentUser.uid}`]: 0
        });
      }
    });

    return () => unsubscribe();
  }, [chatId, currentUser.uid, otherUser]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const messageData = {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || userType,
        senderType: userType,
        timestamp: serverTimestamp(),
        read: false
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
        lastSenderId: currentUser.uid,
        [`unreadCount.${otherUser?.id}`]: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return '';
    const today = new Date();
    const msgDate = new Date(date);
    if (msgDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (msgDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return msgDate.toLocaleDateString();
  };

  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {otherUser?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h3>{otherUser?.name || 'User'}</h3>
          </div>
        </div>
        {onVideoCall && (
          <button className="video-call-btn" onClick={onVideoCall}>
            📹 Video Call
          </button>
        )}
      </div>

      <div className="chat-messages">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            <div className="date-divider">
              <span>{date}</span>
            </div>
            {dateMessages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  <p>{message.text}</p>
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                    {message.senderId === currentUser.uid && (
                      <span className="message-status">
                        {message.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={sendMessage}>
        <div className="chat-input-wrapper">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="chat-input"
          />
          <button type="submit" className="send-btn" disabled={sending}>
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;