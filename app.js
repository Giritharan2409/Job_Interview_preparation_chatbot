// Gemini API Configuration
const GEMINI_API_KEY = 'AIzaSyAfECe8OQyO6NAN6MK21hL2-evugNJ4v6Y';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Application State
let currentDomain = '';
let currentQuestion = '';
let questionCount = 0;
let questionType = 'text'; // 'text' or 'mcq'
let correctAnswer = '';
let selectedOption = '';

// DOM Elements
const domainSelection = document.getElementById('domainSelection');
const chatInterface = document.getElementById('chatInterface');
const chatBox = document.getElementById('chatBox');
const currentDomainDisplay = document.getElementById('currentDomain');
const userAnswerInput = document.getElementById('userAnswer');
const getQuestionBtn = document.getElementById('getQuestion');
const submitAnswerBtn = document.getElementById('submitAnswer');
const getModelAnswerBtn = document.getElementById('getModelAnswer');
const changeDomainBtn = document.getElementById('changeDomain');
const loadingIndicator = document.getElementById('loadingIndicator');

// Domain Selection Event Listeners
document.querySelectorAll('.domain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentDomain = btn.dataset.domain;
        questionType = btn.dataset.type === 'mcq' ? 'mcq' : 'text';
        startInterview();
    });
});

// Button Event Listeners
changeDomainBtn.addEventListener('click', resetTodomainSelection);
getQuestionBtn.addEventListener('click', getNewQuestion);
submitAnswerBtn.addEventListener('click', submitAnswer);
getModelAnswerBtn.addEventListener('click', getModelAnswer);

// Start Interview
function startInterview() {
    domainSelection.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    currentDomainDisplay.textContent = `📚 ${currentDomain}`;
    questionCount = 0;
    
    // Clear chat except welcome message
    chatBox.innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <p>Great! You've selected <strong>${currentDomain}</strong>. Click "Get Question" to receive your first interview question!</p>
            </div>
        </div>
    `;
}

// Reset to Domain Selection
function resetTodomainSelection() {
    chatInterface.classList.add('hidden');
    domainSelection.classList.remove('hidden');
    currentDomain = '';
    currentQuestion = '';
    questionCount = 0;
    questionType = 'text';
    correctAnswer = '';
    selectedOption = '';
    userAnswerInput.value = '';
    userAnswerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    getModelAnswerBtn.disabled = true;
}

// Get New Question from Gemini API
async function getNewQuestion() {
    try {
        showLoading(true);
        disableButtons(true);
        
        questionCount++;
        selectedOption = '';
        
        let prompt;
        
        if (questionType === 'mcq') {
            prompt = `You are an expert in ${currentDomain}. Generate ONE multiple-choice question.

${currentDomain === 'Aptitude' ? 'Generate a challenging aptitude question covering topics like: logical reasoning, numerical ability, data interpretation, verbal reasoning, or problem-solving.' : 'Generate a common HR interview question with scenario-based options.'}

Provide your response in EXACTLY this JSON format (no markdown, no code blocks, just pure JSON):
{
  "question": "The question text here",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correct": "A",
  "explanation": "Brief explanation of why this is the correct answer"
}`;
        } else {
            prompt = `You are an expert interviewer for ${currentDomain} positions. Generate ONE realistic and challenging interview question for a ${currentDomain} professional. The question should be:
- Relevant to ${currentDomain} domain
- Appropriate for mid-level professionals
- Clear and specific
- Commonly asked in real interviews

Only provide the question, nothing else. Do not include any preamble like "Here's a question" or numbering.`;
        }

        const response = await callGeminiAPI(prompt);
        
        if (questionType === 'mcq') {
            const questionData = parseQuestionJSON(response);
            currentQuestion = questionData.question;
            correctAnswer = questionData.correct;
            
            displayMCQQuestion(questionCount, questionData);
            
            submitAnswerBtn.disabled = false;
            getModelAnswerBtn.disabled = false;
            getQuestionBtn.disabled = true;
        } else {
            currentQuestion = response;
            addMessage('bot', `<h3>Question ${questionCount}:</h3><p>${currentQuestion}</p>`);
            
            userAnswerInput.disabled = false;
            userAnswerInput.value = '';
            userAnswerInput.focus();
            submitAnswerBtn.disabled = false;
            getModelAnswerBtn.disabled = false;
            getQuestionBtn.disabled = true;
        }
        
    } catch (error) {
        console.error('Error getting question:', error);
        addMessage('bot', `❌ Sorry, I encountered an error generating a question. Error: ${error.message}. Please check the console for more details.`);
        getQuestionBtn.disabled = false;
    } finally {
        showLoading(false);
        disableButtons(false);
    }
}

// Parse JSON response from API
function parseQuestionJSON(response) {
    try {
        // Remove markdown code blocks if present
        let cleaned = response.trim();
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('JSON parse error:', error);
        console.log('Response:', response);
        throw new Error('Failed to parse question format');
    }
}

// Display MCQ Question with Options
function displayMCQQuestion(qNum, questionData) {
    const optionsHTML = Object.entries(questionData.options)
        .map(([key, value]) => `
            <div class="mcq-option" data-option="${key}">
                <input type="radio" name="mcq-answer" id="option-${key}" value="${key}">
                <label for="option-${key}">
                    <span class="option-label">${key}.</span>
                    <span class="option-text">${value}</span>
                </label>
            </div>
        `).join('');
    
    const messageHTML = `
        <h3>Question ${qNum}:</h3>
        <p class="question-text">${questionData.question}</p>
        <div class="mcq-options">
            ${optionsHTML}
        </div>
    `;
    
    addMessage('bot', messageHTML);
    
    // Add click listeners to options
    setTimeout(() => {
        document.querySelectorAll('.mcq-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.mcq-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input[type="radio"]').checked = true;
                selectedOption = this.dataset.option;
            });
        });
    }, 100);
}

// Submit Answer for Evaluation
async function submitAnswer() {
    if (questionType === 'mcq') {
        submitMCQAnswer();
    } else {
        submitTextAnswer();
    }
}

// Submit MCQ Answer
function submitMCQAnswer() {
    if (!selectedOption) {
        alert('Please select an option before submitting.');
        return;
    }
    
    // Display user's selection
    const isCorrect = selectedOption === correctAnswer;
    const resultIcon = isCorrect ? '✅' : '❌';
    const resultText = isCorrect ? 'Correct!' : 'Incorrect!';
    const resultClass = isCorrect ? 'correct-answer' : 'wrong-answer';
    
    addMessage('user', `Selected: <strong>${selectedOption}</strong>`);
    
    const feedbackHTML = `
        <h3>${resultIcon} ${resultText}</h3>
        <p><strong>Your Answer:</strong> ${selectedOption}</p>
        <p><strong>Correct Answer:</strong> ${correctAnswer}</p>
        <p class="explanation-text">The correct answer provides the best response to the question.</p>
    `;
    
    addMessage(resultClass, feedbackHTML);
    
    // Disable all options
    document.querySelectorAll('.mcq-option').forEach(opt => {
        opt.style.pointerEvents = 'none';
        if (opt.dataset.option === correctAnswer) {
            opt.classList.add('correct');
        } else if (opt.dataset.option === selectedOption && !isCorrect) {
            opt.classList.add('wrong');
        }
    });
    
    // Reset for next question
    submitAnswerBtn.disabled = true;
    getModelAnswerBtn.disabled = true;
    getQuestionBtn.disabled = false;
    selectedOption = '';
}

// Submit Text Answer
async function submitTextAnswer() {
    const userAnswer = userAnswerInput.value.trim();
    
    if (!userAnswer) {
        alert('Please provide an answer before submitting.');
        return;
    }
    
    try {
        showLoading(true);
        disableButtons(true);
        
        // Display user's answer
        addMessage('user', userAnswer);
        
        const prompt = `You are an expert interviewer for ${currentDomain} positions. 

Question asked: "${currentQuestion}"

Candidate's answer: "${userAnswer}"

Evaluate this answer and provide:
1. Overall assessment (Good/Average/Needs Improvement)
2. Strengths of the answer (2-3 points)
3. Areas for improvement (2-3 points)
4. A score out of 10

Format your response clearly with these sections.`;

        const feedback = await callGeminiAPI(prompt);
        
        addMessage('feedback', `<h3>📊 Feedback:</h3>${feedback}`);
        
        // Reset for next question
        userAnswerInput.value = '';
        userAnswerInput.disabled = true;
        submitAnswerBtn.disabled = true;
        getModelAnswerBtn.disabled = true;
        getQuestionBtn.disabled = false;
        
    } catch (error) {
        console.error('Error evaluating answer:', error);
        addMessage('bot', `❌ Sorry, I encountered an error evaluating your answer. Error: ${error.message}`);
        userAnswerInput.disabled = false;
        submitAnswerBtn.disabled = false;
        getModelAnswerBtn.disabled = false;
    } finally {
        showLoading(false);
    }
}

// Get Model Answer
async function getModelAnswer() {
    try {
        showLoading(true);
        disableButtons(true);
        
        const prompt = `You are an expert in ${currentDomain}. 

Question: "${currentQuestion}"

Provide a comprehensive model answer that demonstrates:
1. Deep understanding of the topic
2. Structured and clear explanation
3. Practical examples or scenarios
4. Key points that interviewers look for

Make the answer detailed but concise (150-200 words).`;

        const modelAnswer = await callGeminiAPI(prompt);
        
        addMessage('model-answer', `<h3>✅ Model Answer:</h3>${modelAnswer}`);
        
        // Reset for next question
        userAnswerInput.value = '';
        userAnswerInput.disabled = true;
        submitAnswerBtn.disabled = true;
        getModelAnswerBtn.disabled = true;
        getQuestionBtn.disabled = false;
        
    } catch (error) {
        console.error('Error getting model answer:', error);
        addMessage('bot', `❌ Sorry, I encountered an error generating the model answer. Error: ${error.message}`);
        userAnswerInput.disabled = false;
        submitAnswerBtn.disabled = false;
        getModelAnswerBtn.disabled = false;
    } finally {
        showLoading(false);
    }
}

// Call Gemini API
async function callGeminiAPI(prompt) {
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        }
    };
    
    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                // If error response is not JSON, use status text
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error('Invalid API response:', data);
            throw new Error('Invalid response format from API. The API may have blocked the content or returned an unexpected format.');
        }
        
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to Gemini API. Please check your internet connection.');
        }
        throw error;
    }
}

// Add Message to Chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;
    
    messageDiv.appendChild(messageContent);
    chatBox.appendChild(messageDiv);
    
    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Show/Hide Loading Indicator
function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

// Disable/Enable Buttons
function disableButtons(disable) {
    getQuestionBtn.disabled = disable;
    submitAnswerBtn.disabled = disable;
    getModelAnswerBtn.disabled = disable;
    userAnswerInput.disabled = disable;
}

// Allow Enter key to submit (Ctrl+Enter for newline)
userAnswerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (!submitAnswerBtn.disabled) {
            submitAnswer();
        }
    }
});
