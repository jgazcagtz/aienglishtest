// script.js
document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const micButton = document.getElementById('micButton');
    const recordingIndicator = document.getElementById('recordingIndicator');
    
    let recognition;
    let conversationHistory = [
        {
            role: "system",
            content: "You are an English evaluation assistant. Assess the user's spoken English according to CEFR standards (A1-C2). Ask one question at a time. After 5 questions, provide a detailed evaluation including: 1) CEFR level, 2) Strengths, 3) Areas for improvement, 4) Specific examples from their answers. Use professional but encouraging tone. Begin by welcoming the user and explaining you'll ask 5 questions."
        }
    ];
    let questionCount = 0;
    const maxQuestions = 5;
    
    // Initialize speech recognition
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in your browser. Please use Chrome or Edge.");
            return;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
            micButton.classList.add('recording');
            recordingIndicator.style.display = 'flex';
        };
        
        recognition.onend = () => {
            micButton.classList.remove('recording');
            recordingIndicator.style.display = 'none';
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            addMessage('user', transcript);
            processUserResponse(transcript);
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            addMessage('system', "Sorry, I didn't catch that. Please try again.");
            speakResponse("Sorry, I didn't catch that. Please try again.");
        };
    }
    
    // Add message to chat UI
    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
            </div>
            <div class="message-time">${timeString}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Process user response and get next question/result
    async function processUserResponse(userAnswer) {
        conversationHistory.push({ role: 'user', content: userAnswer });
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: conversationHistory }),
            });
            
            const data = await response.json();
            const aiResponse = data.reply;
            
            conversationHistory.push({ role: 'assistant', content: aiResponse });
            addMessage('system', aiResponse);
            
            // Check if this was a question (simple heuristic)
            if (aiResponse.includes('?')) {
                questionCount++;
            }
            
            // Speak the response
            speakResponse(aiResponse);
            
            // If we've reached max questions, disable the mic
            if (questionCount >= maxQuestions) {
                micButton.disabled = true;
                micButton.style.opacity = '0.5';
            }
        } catch (error) {
            console.error('Error:', error);
            addMessage('system', "Sorry, there was an error processing your response. Please try again.");
        }
    }
    
    // Text-to-speech function
    function speakResponse(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang.includes('en'));
            speechSynthesis.speak(utterance);
        }
    }
    
    // Event listeners
    micButton.addEventListener('click', () => {
        if (questionCount >= maxQuestions) return;
        
        if (!recognition) {
            initSpeechRecognition();
        }
        
        recognition.start();
    });
    
    // Initialize with welcome message
    speakResponse("Welcome to your English evaluation. I'll ask you 5 questions to assess your spoken English level according to CEFR standards. Please answer naturally as you would in a professional setting.");
});
