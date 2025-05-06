document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatMessages = document.getElementById('chatMessages');
    const micButton = document.getElementById('micButton');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const voiceSelector = document.getElementById('voiceSelector');
    const restartButton = document.getElementById('restartButton');
    
    // App State
    let recognition;
    let currentVoice = 'alloy';
    let conversationHistory = [
        {
            role: "system",
            content: "You are an English evaluation assistant. Assess the user's spoken English according to CEFR standards (A1-C2). Ask one question at a time. After 5 questions, provide a detailed evaluation including: 1) CEFR level, 2) Strengths, 3) Areas for improvement, 4) Specific examples from their answers. Use professional but encouraging tone. Begin by welcoming the user and explaining you'll ask 5 questions."
        }
    ];
    let questionCount = 0;
    const maxQuestions = 5;
    let isSpeaking = false;

    // Initialize speech recognition
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            showError("Speech recognition not supported in your browser. Please use Chrome or Edge.");
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
        
        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            addMessage('user', transcript);
            await processUserResponse(transcript);
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
            showLoader();
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
            
            // Check if this was a question
            if (aiResponse.includes('?') && questionCount < maxQuestions) {
                questionCount++;
            }
            
            // Speak the response
            await speakResponse(aiResponse);
            
            // If we've reached max questions, show evaluation complete
            if (questionCount >= maxQuestions) {
                showEvaluationComplete();
            }
        } catch (error) {
            console.error('Error:', error);
            addMessage('system', "Sorry, there was an error processing your response. Please try again.");
            await speakResponse("Sorry, there was an error processing your response. Please try again.");
        } finally {
            hideLoader();
        }
    }

    // Text-to-speech function with OpenAI TTS
    async function speakResponse(text) {
        if (isSpeaking) return;
        isSpeaking = true;
        
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text,
                    voice: currentVoice 
                }),
            });

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            await new Promise((resolve) => {
                audio.onended = resolve;
                audio.play().catch(e => {
                    console.error('Audio play failed:', e);
                    // Fallback to browser speech
                    const utterance = new SpeechSynthesisUtterance(text);
                    speechSynthesis.speak(utterance);
                    resolve();
                });
            });
        } catch (error) {
            console.error('TTS Error:', error);
            // Fallback to browser speech
            const utterance = new SpeechSynthesisUtterance(text);
            speechSynthesis.speak(utterance);
        } finally {
            isSpeaking = false;
        }
    }

    // UI Helpers
    function showLoader() {
        const loader = document.createElement('div');
        loader.className = 'message system';
        loader.innerHTML = `
            <div class="message-content loading">
                <div class="loader"></div>
                <p>Evaluating your response...</p>
            </div>
        `;
        chatMessages.appendChild(loader);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideLoader() {
        const loaders = document.querySelectorAll('.loading');
        loaders.forEach(loader => loader.parentElement.parentElement.remove());
    }

    function showError(message) {
        addMessage('system', message);
    }

    function showEvaluationComplete() {
        micButton.disabled = true;
        micButton.style.opacity = '0.5';
        
        const completeDiv = document.createElement('div');
        completeDiv.className = 'evaluation-complete';
        completeDiv.innerHTML = `
            <h3>Evaluation Complete</h3>
            <p>You've completed all 5 questions. Review your results above.</p>
            <button id="restartButton" class="restart-button">Start New Evaluation</button>
        `;
        chatMessages.appendChild(completeDiv);
        
        document.getElementById('restartButton').addEventListener('click', restartEvaluation);
    }

    function restartEvaluation() {
        conversationHistory = conversationHistory.slice(0, 1); // Keep system message
        questionCount = 0;
        chatMessages.innerHTML = '';
        micButton.disabled = false;
        micButton.style.opacity = '1';
        document.querySelector('.evaluation-complete')?.remove();
        addMessage('system', "Welcome to a new English evaluation. I'll ask you 5 questions to assess your spoken English level.");
        speakResponse("Welcome to a new English evaluation. I'll ask you 5 questions to assess your spoken English level.");
    }

    // Event Listeners
    micButton.addEventListener('click', () => {
        if (questionCount >= maxQuestions) return;
        
        if (!recognition) {
            initSpeechRecognition();
        }
        
        recognition.start();
    });

    voiceSelector?.addEventListener('change', (e) => {
        currentVoice = e.target.value;
    });

    // Initialize
    addMessage('system', "Welcome to your English evaluation. I'll ask you 5 questions to assess your spoken English level according to CEFR standards. Please answer naturally as you would in a professional setting.");
    speakResponse("Welcome to your English evaluation. I'll ask you 5 questions to assess your spoken English level according to CEFR standards. Please answer naturally as you would in a professional setting.");
});
