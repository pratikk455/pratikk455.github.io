// State Management
let apiKey = '';
let conversations = {};
let currentConversationId = 'default';
let messages = [];
let isGenerating = false;

// Settings
let settings = {
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant.',
    theme: 'light',
    saveApiKey: false,
    voiceEnabled: true,
    autoSpeak: true,
    voiceRate: 1.0,
    voicePitch: 1.0,
    listeningMode: 'click'
};

// Voice-related variables
let recognition = null;
let synthesis = null;
let isListening = false;
let isSpeaking = false;
let currentUtterance = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadApiKey();
    initializeVoice();
    initializeEventListeners();
    initializeConversation();
    updateCharCounter();
});

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('chatSettings');
    if (savedSettings) {
        settings = { ...settings, ...JSON.parse(savedSettings) };
        applySettings();
    }
}

// Load API key from localStorage
function loadApiKey() {
    const savedKey = localStorage.getItem('openaiApiKey');
    if (savedKey) {
        apiKey = savedKey;
        document.getElementById('api-key-input').value = apiKey;
        document.getElementById('save-key-checkbox').checked = true;
        // Auto-login if key exists
        setTimeout(() => startChat(), 500);
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('chatSettings', JSON.stringify(settings));
}

// Apply settings
function applySettings() {
    document.getElementById('model-select').value = settings.model;
    document.getElementById('max-tokens').value = settings.maxTokens;
    document.getElementById('tokens-value').textContent = settings.maxTokens;
    document.getElementById('temperature').value = settings.temperature;
    document.getElementById('temp-value').textContent = settings.temperature;
    document.getElementById('system-prompt').value = settings.systemPrompt;
    document.getElementById('model-info').textContent = settings.model.toUpperCase();

    // Voice settings
    document.getElementById('voice-enabled').checked = settings.voiceEnabled;
    document.getElementById('auto-speak').checked = settings.autoSpeak;
    document.getElementById('voice-rate').value = settings.voiceRate;
    document.getElementById('voice-rate-value').textContent = settings.voiceRate;
    document.getElementById('voice-pitch').value = settings.voicePitch;
    document.getElementById('voice-pitch-value').textContent = settings.voicePitch;
    document.getElementById('listening-mode').value = settings.listeningMode;

    if (settings.theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('theme-toggle').textContent = '☀️';
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // API Key
    const apiKeySubmit = document.getElementById('api-key-submit');
    const apiKeyInput = document.getElementById('api-key-input');
    const showKeyBtn = document.getElementById('show-key');
    const saveKeyCheckbox = document.getElementById('save-key-checkbox');

    apiKeySubmit.addEventListener('click', startChat);
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startChat();
    });

    showKeyBtn.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        showKeyBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });

    saveKeyCheckbox.addEventListener('change', (e) => {
        settings.saveApiKey = e.target.checked;
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Settings Panel
    document.getElementById('settings-toggle').addEventListener('click', toggleSettings);

    // Settings Controls
    document.getElementById('model-select').addEventListener('change', (e) => {
        settings.model = e.target.value;
        document.getElementById('model-info').textContent = e.target.value.toUpperCase();
        saveSettings();
    });

    document.getElementById('max-tokens').addEventListener('input', (e) => {
        settings.maxTokens = parseInt(e.target.value);
        document.getElementById('tokens-value').textContent = e.target.value;
        saveSettings();
    });

    document.getElementById('temperature').addEventListener('input', (e) => {
        settings.temperature = parseFloat(e.target.value);
        document.getElementById('temp-value').textContent = e.target.value;
        saveSettings();
    });

    document.getElementById('system-prompt').addEventListener('change', (e) => {
        settings.systemPrompt = e.target.value;
        messages[0] = { role: 'system', content: settings.systemPrompt };
        saveSettings();
    });

    document.getElementById('clear-storage').addEventListener('click', clearAllData);

    // Voice Settings
    document.getElementById('voice-enabled').addEventListener('change', (e) => {
        settings.voiceEnabled = e.target.checked;
        if (!settings.voiceEnabled) {
            stopListening();
            stopSpeaking();
        }
        updateVoiceStatus();
        saveSettings();
    });

    document.getElementById('auto-speak').addEventListener('change', (e) => {
        settings.autoSpeak = e.target.checked;
        saveSettings();
    });

    document.getElementById('voice-rate').addEventListener('input', (e) => {
        settings.voiceRate = parseFloat(e.target.value);
        document.getElementById('voice-rate-value').textContent = e.target.value;
        saveSettings();
    });

    document.getElementById('voice-pitch').addEventListener('input', (e) => {
        settings.voicePitch = parseFloat(e.target.value);
        document.getElementById('voice-pitch-value').textContent = e.target.value;
        saveSettings();
    });

    document.getElementById('listening-mode').addEventListener('change', (e) => {
        settings.listeningMode = e.target.value;
        if (isListening) {
            stopListening();
        }
        updateVoiceStatus();
        saveSettings();
    });

    // Chat Actions
    document.getElementById('clear-chat').addEventListener('click', clearChat);
    document.getElementById('export-chat').addEventListener('click', exportChat);
    document.getElementById('new-chat').addEventListener('click', newChat);

    // Message Input
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message');

    messageInput.addEventListener('input', (e) => {
        updateCharCounter();
        autoResizeTextarea(e.target);
        sendButton.disabled = !e.target.value.trim() || isGenerating;
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);

    // Voice Input
    document.getElementById('voice-input').addEventListener('click', toggleListening);
    document.getElementById('stop-listening').addEventListener('click', stopListening);
    document.getElementById('stop-speaking').addEventListener('click', stopSpeaking);

    // Example Prompts
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('prompt-chip')) {
            const messageInput = document.getElementById('message-input');
            messageInput.value = e.target.textContent;
            updateCharCounter();
            autoResizeTextarea(messageInput);
            document.getElementById('send-message').disabled = false;
            messageInput.focus();
        }
    });
}

// Start chat
function startChat() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) {
        showToast('Please enter a valid API key');
        return;
    }

    apiKey = key;

    if (document.getElementById('save-key-checkbox').checked) {
        localStorage.setItem('openaiApiKey', apiKey);
    } else {
        localStorage.removeItem('openaiApiKey');
    }

    document.getElementById('api-key-section').style.display = 'none';
    document.getElementById('chat-section').style.display = 'flex';

    initializeConversation();
    showToast('Chat initialized successfully!');
}

// Initialize conversation
function initializeConversation() {
    if (!conversations[currentConversationId]) {
        conversations[currentConversationId] = {
            id: currentConversationId,
            title: `Chat ${Object.keys(conversations).length + 1}`,
            messages: [{ role: 'system', content: settings.systemPrompt }],
            timestamp: Date.now()
        };
    }
    messages = conversations[currentConversationId].messages;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const userInput = messageInput.value.trim();

    if (!userInput || isGenerating) return;

    isGenerating = true;
    document.getElementById('send-message').disabled = true;
    document.getElementById('chat-status').textContent = 'Generating...';

    // Clear welcome message if exists
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // Add user message
    addMessage('user', userInput);
    messages.push({ role: 'user', content: userInput });

    // Clear input
    messageInput.value = '';
    updateCharCounter();
    autoResizeTextarea(messageInput);

    // Show typing indicator
    showTypingIndicator();

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: settings.model,
            messages: messages,
            max_tokens: settings.maxTokens,
            temperature: settings.temperature
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        const reply = response.data.choices[0].message.content.trim();

        // Hide typing indicator
        hideTypingIndicator();

        // Add AI message
        addMessage('ai', reply);
        messages.push({ role: 'assistant', content: reply });

        // Save conversation
        conversations[currentConversationId].messages = messages;
        saveConversations();

        // Auto-speak AI response if enabled
        if (settings.voiceEnabled && settings.autoSpeak) {
            speakText(reply);
        }

    } catch (error) {
        hideTypingIndicator();
        console.error('Error:', error);

        let errorMessage = 'An error occurred while sending the message.';
        if (error.response) {
            if (error.response.status === 401) {
                errorMessage = 'Invalid API key. Please check your key and try again.';
            } else if (error.response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (error.response.data && error.response.data.error) {
                errorMessage = error.response.data.error.message;
            }
        }

        addMessage('error', errorMessage);
        showToast(errorMessage);
    } finally {
        isGenerating = false;
        document.getElementById('send-message').disabled = false;
        document.getElementById('chat-status').textContent = 'Ready';
    }
}

// Add message to chat
function addMessage(type, content) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">👤</div>
                <div class="message-info">
                    <span class="message-sender">You</span>
                    <span class="message-time">${timestamp}</span>
                </div>
            </div>
            <div class="message-content">${escapeHtml(content)}</div>
        `;
    } else if (type === 'ai') {
        const renderedContent = renderMarkdown(content);
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">🤖</div>
                <div class="message-info">
                    <span class="message-sender">Assistant</span>
                    <span class="message-time">${timestamp}</span>
                </div>
            </div>
            <div class="message-content">${renderedContent}</div>
            <div class="message-actions">
                <button class="message-action-btn copy-btn" data-content="${escapeHtml(content)}">📋 Copy</button>
                <button class="message-action-btn regenerate-btn">🔄 Regenerate</button>
            </div>
        `;

        // Add event listeners for message actions
        setTimeout(() => {
            const copyBtn = messageDiv.querySelector('.copy-btn');
            const regenerateBtn = messageDiv.querySelector('.regenerate-btn');

            copyBtn.addEventListener('click', () => copyToClipboard(content));
            regenerateBtn.addEventListener('click', () => regenerateLastMessage());

            // Highlight code blocks
            messageDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        }, 0);
    } else if (type === 'error') {
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">⚠️</div>
                <div class="message-info">
                    <span class="message-sender">System</span>
                    <span class="message-time">${timestamp}</span>
                </div>
            </div>
            <div class="message-content" style="color: #ed4245;">${escapeHtml(content)}</div>
        `;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render markdown
function renderMarkdown(content) {
    // Configure marked options
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true
    });

    // Render markdown and sanitize
    const rawHtml = marked.parse(content);
    return DOMPurify.sanitize(rawHtml);
}

// Show/hide typing indicator
function showTypingIndicator() {
    document.getElementById('typing-indicator').style.display = 'flex';
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    document.getElementById('typing-indicator').style.display = 'none';
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    } catch (err) {
        showToast('Failed to copy to clipboard');
    }
}

// Regenerate last message
async function regenerateLastMessage() {
    if (isGenerating) return;

    // Remove last AI message
    const lastAiMessage = [...document.querySelectorAll('.ai-message')].pop();
    if (lastAiMessage) {
        lastAiMessage.remove();
    }

    // Remove last assistant message from messages array
    const lastAssistantIndex = messages.findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIndex > -1) {
        messages.splice(lastAssistantIndex, 1);
    }

    // Resend the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
        messages.pop(); // Remove the last user message
        const messageInput = document.getElementById('message-input');
        messageInput.value = lastUserMessage.content;
        sendMessage();
    }
}

// Clear chat
function clearChat() {
    if (!confirm('Are you sure you want to clear this chat?')) return;

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <h3>👋 Hello! I'm your AI assistant</h3>
            <p>Here are some things you can ask me:</p>
            <div class="example-prompts">
                <button class="prompt-chip">Explain quantum computing simply</button>
                <button class="prompt-chip">Write a Python function to sort a list</button>
                <button class="prompt-chip">What are the benefits of meditation?</button>
                <button class="prompt-chip">Help me debug my code</button>
            </div>
        </div>
    `;

    messages = [{ role: 'system', content: settings.systemPrompt }];
    conversations[currentConversationId].messages = messages;
    saveConversations();
    showToast('Chat cleared');
}

// Export chat
function exportChat() {
    const conversation = conversations[currentConversationId];
    const exportData = {
        title: conversation.title,
        timestamp: new Date(conversation.timestamp).toISOString(),
        messages: conversation.messages.filter(m => m.role !== 'system'),
        settings: {
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${conversation.title}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Chat exported successfully!');
}

// New chat
function newChat() {
    const chatId = `chat-${Date.now()}`;
    currentConversationId = chatId;
    initializeConversation();
    clearChat();
    updateConversationList();
    showToast('New chat created');
}

// Update conversation list
function updateConversationList() {
    const convList = document.getElementById('conversation-list');
    convList.innerHTML = '';

    Object.values(conversations).forEach(conv => {
        const convItem = document.createElement('div');
        convItem.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        convItem.setAttribute('data-id', conv.id);

        const timeAgo = getTimeAgo(conv.timestamp);
        convItem.innerHTML = `
            <span class="conv-title">${conv.title}</span>
            <span class="conv-time">${timeAgo}</span>
        `;

        convItem.addEventListener('click', () => switchConversation(conv.id));
        convList.appendChild(convItem);
    });
}

// Switch conversation
function switchConversation(convId) {
    currentConversationId = convId;
    messages = conversations[convId].messages;

    // Update UI
    updateConversationList();
    displayConversation();
}

// Display conversation
function displayConversation() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    const filteredMessages = messages.filter(m => m.role !== 'system');

    if (filteredMessages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <h3>👋 Hello! I'm your AI assistant</h3>
                <p>Here are some things you can ask me:</p>
                <div class="example-prompts">
                    <button class="prompt-chip">Explain quantum computing simply</button>
                    <button class="prompt-chip">Write a Python function to sort a list</button>
                    <button class="prompt-chip">What are the benefits of meditation?</button>
                    <button class="prompt-chip">Help me debug my code</button>
                </div>
            </div>
        `;
    } else {
        filteredMessages.forEach(msg => {
            addMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
        });
    }
}

// Save conversations
function saveConversations() {
    try {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    } catch (e) {
        console.error('Failed to save conversations:', e);
        showToast('Storage quota exceeded. Consider exporting old chats.');
    }
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', newTheme);
    document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';

    settings.theme = newTheme;
    saveSettings();
}

// Toggle settings panel
function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('active');
}

// Clear all data
function clearAllData() {
    if (!confirm('This will delete all conversations and settings. Are you sure?')) return;

    localStorage.clear();
    apiKey = '';
    conversations = {};
    currentConversationId = 'default';
    messages = [];

    location.reload();
}

// Update character counter
function updateCharCounter() {
    const input = document.getElementById('message-input');
    const counter = document.getElementById('char-counter');
    counter.textContent = input.value.length;
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Get time ago string
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Load saved conversations on startup
document.addEventListener('DOMContentLoaded', () => {
    const savedConversations = localStorage.getItem('conversations');
    if (savedConversations) {
        conversations = JSON.parse(savedConversations);
        updateConversationList();
    }
});

// ===== VOICE FUNCTIONALITY =====

// Initialize voice features
function initializeVoice() {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English

        recognition.onstart = () => {
            isListening = true;
            updateVoiceUI();
            updateVoiceStatus('🎤 Listening...');
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            const messageInput = document.getElementById('message-input');
            if (finalTranscript) {
                messageInput.value = finalTranscript;
                updateCharCounter();
                autoResizeTextarea(messageInput);
                document.getElementById('send-message').disabled = false;

                if (settings.listeningMode === 'click') {
                    stopListening();
                    // Auto-send if we have a complete sentence
                    if (finalTranscript.trim().endsWith('.') || finalTranscript.trim().endsWith('?') || finalTranscript.trim().endsWith('!')) {
                        setTimeout(() => sendMessage(), 500);
                    }
                }
            } else if (interimTranscript) {
                // Show interim results
                updateVoiceStatus(`🎤 "${interimTranscript}"`);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            updateVoiceUI();

            let errorMessage = 'Speech recognition error';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected';
                    break;
                case 'audio-capture':
                    errorMessage = 'No microphone found';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied';
                    break;
                case 'network':
                    errorMessage = 'Network error occurred';
                    break;
            }

            showToast(errorMessage);
            updateVoiceStatus('🎤 Click mic for voice input');
        };

        recognition.onend = () => {
            isListening = false;
            updateVoiceUI();

            if (settings.listeningMode === 'continuous' && settings.voiceEnabled) {
                // Restart continuous listening after a short delay
                setTimeout(() => {
                    if (settings.voiceEnabled && !isGenerating) {
                        startListening();
                    }
                }, 1000);
            } else {
                updateVoiceStatus('🎤 Click mic for voice input');
            }
        };
    } else {
        console.warn('Speech recognition not supported');
        showToast('Voice input not supported in this browser');
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
        synthesis = window.speechSynthesis;
    } else {
        console.warn('Speech synthesis not supported');
        showToast('Voice output not supported in this browser');
    }

    updateVoiceStatus();
}

// Toggle listening
function toggleListening() {
    if (!settings.voiceEnabled) {
        showToast('Voice features are disabled. Enable them in settings.');
        return;
    }

    if (!recognition) {
        showToast('Speech recognition not available');
        return;
    }

    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

// Start listening
function startListening() {
    if (!recognition || isListening || isGenerating) return;

    try {
        recognition.start();
    } catch (error) {
        console.error('Failed to start recognition:', error);
        showToast('Failed to start voice input');
    }
}

// Stop listening
function stopListening() {
    if (!recognition || !isListening) return;

    try {
        recognition.stop();
    } catch (error) {
        console.error('Failed to stop recognition:', error);
    }

    isListening = false;
    updateVoiceUI();
    updateVoiceStatus('🎤 Click mic for voice input');
}

// Speak text with Indian English accent
function speakText(text) {
    if (!synthesis || !settings.voiceEnabled) return;

    // Stop any current speech
    stopSpeaking();

    // Clean text for better speech
    const cleanText = text
        .replace(/```[\s\S]*?```/g, ' code block ')
        .replace(/`([^`]+)`/g, ' $1 ')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, ' ')
        .trim();

    if (!cleanText) return;

    currentUtterance = new SpeechSynthesisUtterance(cleanText);

    // Try to find Indian English voice
    const voices = synthesis.getVoices();
    let selectedVoice = null;

    // Preferred Indian English voices
    const indianVoices = voices.filter(voice =>
        voice.lang.includes('en-IN') ||
        voice.name.toLowerCase().includes('indian') ||
        voice.name.toLowerCase().includes('ravi') ||
        voice.name.toLowerCase().includes('neel')
    );

    if (indianVoices.length > 0) {
        selectedVoice = indianVoices[0];
    } else {
        // Fallback to any English voice
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        if (englishVoices.length > 0) {
            selectedVoice = englishVoices[0];
        }
    }

    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
    }

    currentUtterance.rate = settings.voiceRate;
    currentUtterance.pitch = settings.voicePitch;
    currentUtterance.volume = 1.0;

    currentUtterance.onstart = () => {
        isSpeaking = true;
        updateVoiceUI();
        updateVoiceStatus('🔊 Speaking...');
    };

    currentUtterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        updateVoiceUI();
        updateVoiceStatus('🎤 Click mic for voice input');

        // Resume continuous listening if enabled
        if (settings.listeningMode === 'continuous' && settings.voiceEnabled && !isGenerating) {
            setTimeout(() => startListening(), 500);
        }
    };

    currentUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        isSpeaking = false;
        currentUtterance = null;
        updateVoiceUI();
        updateVoiceStatus('🎤 Click mic for voice input');
        showToast('Speech output error');
    };

    try {
        synthesis.speak(currentUtterance);
    } catch (error) {
        console.error('Failed to speak:', error);
        showToast('Failed to speak text');
    }
}

// Stop speaking
function stopSpeaking() {
    if (!synthesis) return;

    try {
        synthesis.cancel();
    } catch (error) {
        console.error('Failed to stop speech:', error);
    }

    isSpeaking = false;
    currentUtterance = null;
    updateVoiceUI();
    updateVoiceStatus('🎤 Click mic for voice input');
}

// Update voice UI elements
function updateVoiceUI() {
    const voiceBtn = document.getElementById('voice-input');
    const stopListenBtn = document.getElementById('stop-listening');
    const stopSpeakBtn = document.getElementById('stop-speaking');

    // Reset classes
    voiceBtn.classList.remove('listening', 'speaking');

    if (isListening) {
        voiceBtn.classList.add('listening');
        voiceBtn.title = 'Stop listening';
        stopListenBtn.style.display = 'flex';
    } else {
        voiceBtn.title = 'Start voice input';
        stopListenBtn.style.display = 'none';
    }

    if (isSpeaking) {
        voiceBtn.classList.add('speaking');
        stopSpeakBtn.style.display = 'flex';
    } else {
        stopSpeakBtn.style.display = 'none';
    }
}

// Update voice status message
function updateVoiceStatus(message) {
    const statusElement = document.getElementById('voice-status');
    if (statusElement) {
        if (message) {
            statusElement.textContent = message;
        } else if (!settings.voiceEnabled) {
            statusElement.textContent = '🔇 Voice disabled';
        } else if (settings.listeningMode === 'continuous') {
            statusElement.textContent = '🎤 Continuous listening mode';
        } else {
            statusElement.textContent = '🎤 Click mic for voice input';
        }
    }
}