document.addEventListener('DOMContentLoaded', () => {
    // Navigation logic
    const navItems = document.querySelectorAll('.nav-links .nav-item');
    const viewTitle = document.getElementById('currentViewTitle');
    const viewContainers = document.querySelectorAll('.view-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            const target = e.currentTarget;
            target.classList.add('active');
            
            // Update view
            const view = target.getAttribute('data-view');
            const capitalizedView = view.charAt(0).toUpperCase() + view.slice(1);
            
            viewContainers.forEach(container => {
                container.classList.remove('active-view');
                container.classList.add('hidden');
            });
            const activeContainer = document.getElementById(`${view}View`);
            if (activeContainer) {
                activeContainer.classList.remove('hidden');
                activeContainer.classList.add('active-view');
            }
            
            viewTitle.textContent = capitalizedView;
        });
    });

    // Chat Logic
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');
    const providerSelect = document.getElementById('providerSelect');
    const modelSelect = document.getElementById('modelSelect');
    const toolStatusIndicator = document.getElementById('toolStatusIndicator');
    
    let ws = null;
    let currentSessionId = null;
    
    async function initChat() {
        try {
            // Create a new session
            const response = await fetch('/chat/sessions', { method: 'POST' });
            if (response.ok) {
                const session = await response.json();
                currentSessionId = session.id;
                connectWebSocket();
            }
        } catch (e) {
            console.error("Failed to init chat", e);
        }
    }
    
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/chat/ws/${currentSessionId}`);
        
        let currentAssistantMessageDiv = null;
        let currentAssistantContent = "";
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === "content") {
                if (!currentAssistantMessageDiv) {
                    currentAssistantMessageDiv = createMessageDiv('assistant');
                    chatHistory.appendChild(currentAssistantMessageDiv);
                }
                currentAssistantContent += data.content;
                currentAssistantMessageDiv.querySelector('.message-content').innerHTML = DOMPurify.sanitize(marked.parse(currentAssistantContent));
                scrollToBottom();
            } else if (data.type === "tool_status") {
                toolStatusIndicator.textContent = data.status;
                toolStatusIndicator.classList.remove('hidden');
            } else if (data.type === "done") {
                toolStatusIndicator.classList.add('hidden');
                currentAssistantMessageDiv = null;
                currentAssistantContent = "";
            } else if (data.error) {
                console.error("WS Error:", data.error);
                const errorDiv = createMessageDiv('assistant', `**Error:** ${data.error}`);
                errorDiv.style.color = "red";
                chatHistory.appendChild(errorDiv);
                scrollToBottom();
                toolStatusIndicator.classList.add('hidden');
            }
        };
        
        ws.onclose = () => {
            console.log("WebSocket disconnected");
            // Retry logic could go here
        };
    }
    
    function createMessageDiv(role, content = '') {
        const div = document.createElement('div');
        div.className = `message message-${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        if (content) {
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
        }
        
        div.appendChild(contentDiv);
        return div;
    }
    
    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message || !ws) return;
        
        // Add user message to UI
        const userMsg = createMessageDiv('user', message);
        chatHistory.appendChild(userMsg);
        scrollToBottom();
        
        // Send via WebSocket
        ws.send(JSON.stringify({
            message: message,
            provider: providerSelect.value,
            model: modelSelect.value
        }));
        
        chatInput.value = '';
    });
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Initialize chat on load
    initChat();

    // Research Logic
    const researchForm = document.getElementById('researchForm');
    const researchInput = document.getElementById('researchInput');
    const researchBtn = document.getElementById('researchBtn');
    const researchStatus = document.getElementById('researchStatus');
    const researchResult = document.getElementById('researchResult');
    
    let researchWs = null;

    function connectResearchWebSocket(query) {
        if (researchWs) {
            researchWs.close();
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        researchWs = new WebSocket(`${protocol}//${window.location.host}/research/ws`);
        
        let reportContent = "";
        let resultDiv = null;
        
        researchWs.onopen = () => {
            researchWs.send(JSON.stringify({
                query: query,
                provider: providerSelect.value,
                model: modelSelect.value
            }));
        };
        
        researchWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === "content") {
                if (!resultDiv) {
                    resultDiv = document.createElement('div');
                    resultDiv.className = 'message-content';
                    researchResult.innerHTML = ''; // clear previous
                    researchResult.appendChild(resultDiv);
                }
                reportContent += data.content;
                resultDiv.innerHTML = DOMPurify.sanitize(marked.parse(reportContent));
                researchResult.scrollTop = researchResult.scrollHeight;
            } else if (data.type === "tool_status") {
                researchStatus.textContent = data.status;
                researchStatus.classList.remove('hidden');
            } else if (data.type === "done") {
                researchStatus.textContent = "Research complete.";
                setTimeout(() => researchStatus.classList.add('hidden'), 3000);
                researchBtn.disabled = false;
                researchBtn.textContent = 'Research';
                researchWs.close();
            } else if (data.error) {
                console.error("Research WS Error:", data.error);
                researchStatus.textContent = "Error: " + data.error;
                researchBtn.disabled = false;
                researchBtn.textContent = 'Research';
            }
        };
        
        researchWs.onclose = () => {
            console.log("Research WebSocket disconnected");
        };
    }

    researchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = researchInput.value.trim();
        if (!query) return;
        
        researchBtn.disabled = true;
        researchBtn.textContent = 'Working...';
        researchStatus.textContent = 'Initializing research agent...';
        researchStatus.classList.remove('hidden');
        
        researchResult.innerHTML = `<div class="system-message">Gathering research for: "${query}"</div>`;
        
        connectResearchWebSocket(query);
    });

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login';
                }
            } catch (err) {
                console.error('Logout failed', err);
            }
        });
    }
});
