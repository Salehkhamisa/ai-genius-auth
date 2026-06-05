// Global Session State
let accessToken = null;
let user = null;
let expiryTime = null;
let countdownInterval = null;
let currentAuthTab = 'login';
let activeDashboardTab = 'playground';
let selectedModelKey = 'free-model';

// SaaS Credits State
let currentCredits = 10;
let maxCredits = 10;
let isInfiniteCredits = false;

// Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authRole = document.getElementById('auth-role');
const registerRoleGroup = document.getElementById('register-role-group');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const userStatusCard = document.getElementById('user-status-card');

const statusAvatarRole = document.getElementById('status-avatar-role');
const statusEmail = document.getElementById('status-email');
const statusRole = document.getElementById('status-role');

const accessTokenStatus = document.getElementById('access-token-status');
const jwtPayloadDisplay = document.getElementById('jwt-payload-display');
const btnExpireToken = document.getElementById('btn-expire-token');
const btnTamperToken = document.getElementById('btn-tamper-token');
const countdownProgress = document.getElementById('countdown-progress');
const countdownText = document.getElementById('countdown-text');

const refreshTokenStatus = document.getElementById('refresh-token-status');
const btnManualRefresh = document.getElementById('btn-manual-refresh');

const apiResponseBody = document.getElementById('api-response-body');
const responseStatusBadge = document.getElementById('response-status-badge');
const terminalLogs = document.getElementById('terminal-logs');

// Playground Specific Elements
const selectedModelTitle = document.getElementById('selected-model-title');
const selectedModelRoute = document.getElementById('selected-model-route');
const promptInputContainer = document.getElementById('prompt-input-container');
const modelPromptInput = document.getElementById('model-prompt-input');

// Canvas Chat & Billing Elements
const chatOutputCanvas = document.getElementById('chat-output-canvas');
const chatPlaceholder = document.getElementById('chat-placeholder');
const creditProgress = document.getElementById('credit-progress');
const creditText = document.getElementById('credit-text');
const creditTier = document.getElementById('credit-tier');
const rawJsonCollapse = document.getElementById('raw-json-collapse');
const toggleIndicatorSymbol = document.getElementById('toggle-indicator-symbol');

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  addLog('info', 'Platform Security Portal initialized. Accounts ready.');
  selectModel('free-model'); // Set default playground state
  updateUI();
});

// Write to visual terminal console
function addLog(type, message) {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  if (terminalLogs) {
    terminalLogs.appendChild(entry);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
}

function clearConsoleLogs() {
  terminalLogs.innerHTML = '';
  addLog('info', 'Event logger cleared.');
}

// Switch Auth Tabs (Login / Register)
function switchAuthTab(tab) {
  currentAuthTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  
  if (tab === 'register') {
    registerRoleGroup.classList.remove('hidden');
    authSubmitBtn.textContent = 'Create Account';
  } else {
    registerRoleGroup.classList.add('hidden');
    authSubmitBtn.textContent = 'Authenticate';
  }
}

// Switch Dashboard Tabs (Playground, Security Vault, Event Logs)
function switchDashboardTab(tab) {
  activeDashboardTab = tab;
  
  // Toggle nav buttons
  document.getElementById('nav-playground').classList.toggle('active', tab === 'playground');
  document.getElementById('nav-security').classList.toggle('active', tab === 'security');
  document.getElementById('nav-logs').classList.toggle('active', tab === 'logs');
  
  // Toggle view panels
  document.getElementById('panel-playground').classList.toggle('active', tab === 'playground');
  document.getElementById('panel-security').classList.toggle('active', tab === 'security');
  document.getElementById('panel-logs').classList.toggle('active', tab === 'logs');
  
  addLog('info', `Switched workspace view to: ${tab.toUpperCase()}`);
}

// AI Playground: Select which model we are talking to
function selectModel(modelKey) {
  selectedModelKey = modelKey;
  
  // Toggle active class on sidebar listing cards
  document.getElementById('card-free-model').classList.toggle('active', modelKey === 'free-model');
  document.getElementById('card-premium-model').classList.toggle('active', modelKey === 'premium-model');
  document.getElementById('card-purge-cache').classList.toggle('active', modelKey === 'purge-cache');
  
  // Clear previous response outputs
  apiResponseBody.textContent = '// Response payload will appear here...';
  responseStatusBadge.textContent = '---';
  responseStatusBadge.className = 'response-status';

  // Customize layout based on Model specs
  if (modelKey === 'free-model') {
    selectedModelTitle.textContent = 'Basic Text Model (Free-Text v1)';
    selectedModelRoute.textContent = 'GET /api/ai/free-model';
    promptInputContainer.classList.add('hidden');
  } else if (modelKey === 'premium-model') {
    selectedModelTitle.textContent = 'Ultra Image & Text Generation (Premium-GPT4x)';
    selectedModelRoute.textContent = 'POST /api/ai/premium-model';
    promptInputContainer.classList.remove('hidden');
    modelPromptInput.value = 'Generate a premium cybersecurity architecture design for a fintech startup.';
  } else if (modelKey === 'purge-cache') {
    selectedModelTitle.textContent = 'Purge System Weight Cache (Cluster Action)';
    selectedModelRoute.textContent = 'DELETE /api/ai/purge-cache';
    promptInputContainer.classList.add('hidden');
  }
}

// Quick login using seed buttons
async function loginSeeded(email, password) {
  authEmail.value = email;
  authPassword.value = password;
  switchAuthTab('login');
  addLog('info', `Using quick-login credentials for: ${email}`);
  await executeLogin(email, password);
}

// Handle Form Submit (Login / Register)
async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmail.value;
  const password = authPassword.value;

  if (currentAuthTab === 'login') {
    addLog('info', `Initiating standard login request for ${email}...`);
    await executeLogin(email, password);
  } else {
    const role = authRole.value;
    addLog('info', `Initiating registration request for ${email}...`);
    await executeRegister(email, password, role);
  }
}

// Register API call
async function executeRegister(email, password, role) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      addLog('success', `Registration succeeded! Creating session...`);
      await executeLogin(email, password);
    } else {
      addLog('error', `Registration rejected: ${data.message || 'Unknown error'}`);
      alert(`Registration Failed: ${data.message}`);
    }
  } catch (error) {
    addLog('error', `Registration request error: ${error.message}`);
  }
}

// Login API call
async function executeLogin(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      accessToken = data.accessToken;
      user = data.user;
      
      addLog('success', `Session established. User authenticated as: ${user.role}`);
      addLog('info', 'Refresh Token placed in secure Cookie storage.');
      
      // Initialize credits based on user role
      initializeSaaSCredits(user.role);
      
      // Clear visual chat canvas
      clearChatCanvas();

      // Parse token expiry & update screens
      decodeAndInspectJWT(accessToken);
      updateUI();
      showApiResponse(response.status, data);
      
      // Reset fields
      authEmail.value = '';
      authPassword.value = '';
    } else {
      addLog('error', `Auth rejected: ${data.message || 'Invalid credentials'}`);
      alert(`Login Failed: ${data.message || 'Invalid credentials'}`);
    }
  } catch (error) {
    addLog('error', `Login request error: ${error.message}`);
  }
}

// Decode and set timer for access token
function decodeAndInspectJWT(token) {
  try {
    if (token.startsWith('SIMULATED_')) {
      jwtPayloadDisplay.textContent = JSON.stringify({
        simulation: true,
        tokenType: token,
        note: 'This access token is overridden for verification tests.'
      }, null, 2);
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    jwtPayloadDisplay.textContent = JSON.stringify(payload, null, 2);

    // Set countdown timer
    expiryTime = new Date(payload.exp * 1000);
    startCountdown();
  } catch (err) {
    addLog('error', `JWT Decoding error: ${err.message}`);
    jwtPayloadDisplay.textContent = '{ "error": "Decoding Failure" }';
  }
}

// Token expiry countdown loop
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  const updateTimer = () => {
    if (!expiryTime) return;
    
    const now = new Date();
    const diffMs = expiryTime - now;
    const totalDuration = 15 * 60 * 1000; // 15 mins
    
    if (diffMs <= 0) {
      clearInterval(countdownInterval);
      countdownText.textContent = '00:00';
      countdownProgress.setAttribute('stroke-dasharray', '0, 100');
      accessTokenStatus.textContent = 'Expired';
      accessTokenStatus.className = 'status-indicator expired';
      addLog('warn', 'Access Token expired.');
      return;
    }

    const seconds = Math.floor(diffMs / 1000);
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    countdownText.textContent = `${m}:${s}`;

    // Update circular progress bar
    const percentage = Math.min(100, (diffMs / totalDuration) * 100);
    countdownProgress.setAttribute('stroke-dasharray', `${percentage}, 100`);

    accessTokenStatus.textContent = 'Active';
    accessTokenStatus.className = 'status-indicator active';
  };

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

// Initialize SaaS Credits based on role membership
function initializeSaaSCredits(role) {
  if (role === 'Admin') {
    isInfiniteCredits = true;
    maxCredits = 9999;
    currentCredits = 9999;
    creditTier.textContent = 'Admin (Unlimited)';
  } else if (role === 'Premium_User') {
    isInfiniteCredits = false;
    maxCredits = 500;
    currentCredits = 500;
    creditTier.textContent = 'Premium Tier';
  } else {
    isInfiniteCredits = false;
    maxCredits = 10;
    currentCredits = 10;
    creditTier.textContent = 'Free Tier';
  }
  updateCreditsUI();
}

function updateCreditsUI() {
  if (isInfiniteCredits) {
    creditText.textContent = '∞';
    creditProgress.setAttribute('stroke-dasharray', '100, 100');
    creditProgress.setAttribute('stroke', '#ef4444'); // Admin Neon Orange/Red
  } else {
    creditText.textContent = `${currentCredits}/${maxCredits}`;
    const percentage = (currentCredits / maxCredits) * 100;
    creditProgress.setAttribute('stroke-dasharray', `${percentage}, 100`);
    if (percentage > 30) {
      creditProgress.setAttribute('stroke', '#10b981'); // Safe Green
    } else {
      creditProgress.setAttribute('stroke', '#f59e0b'); // Warning Orange
    }
  }
}

// Update UI elements based on session state
function updateUI() {
  if (accessToken) {
    // Session Active
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    statusEmail.textContent = user.email;
    statusRole.textContent = user.role;
    statusAvatarRole.textContent = user.role.charAt(0);
    statusRole.className = `badge-role role-${user.role.toLowerCase()}`;
    
    btnExpireToken.removeAttribute('disabled');
    btnTamperToken.removeAttribute('disabled');
    btnManualRefresh.removeAttribute('disabled');
    
    refreshTokenStatus.textContent = 'Cookie Ready';
    refreshTokenStatus.className = 'status-indicator active';
  } else {
    // No Session
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    
    jwtPayloadDisplay.textContent = '{ "status": "Offline" }';
    accessTokenStatus.textContent = 'No Session';
    accessTokenStatus.className = 'status-indicator expired';
    
    refreshTokenStatus.textContent = 'Cookie Missing';
    refreshTokenStatus.className = 'status-indicator expired';
    
    countdownText.textContent = '--:--';
    countdownProgress.setAttribute('stroke-dasharray', '100, 100');
    
    btnExpireToken.setAttribute('disabled', 'true');
    btnTamperToken.setAttribute('disabled', 'true');
    btnManualRefresh.setAttribute('disabled', 'true');
    
    if (countdownInterval) clearInterval(countdownInterval);
  }
}

// Logout
async function handleLogout() {
  addLog('info', 'Terminating active session...');
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await response.json();
    addLog('success', 'Session destroyed. Cookie cleared.');
  } catch (error) {
    addLog('error', `Logout request failed: ${error.message}`);
  } finally {
    handleLogoutState();
  }
}

function handleLogoutState() {
  accessToken = null;
  user = null;
  expiryTime = null;
  switchDashboardTab('playground');
  updateUI();
}

// Force Expire Token (Developer simulation)
function forceExpireAccessToken() {
  accessToken = 'SIMULATED_EXPIRED_TOKEN';
  accessTokenStatus.textContent = 'Sim. Expired';
  accessTokenStatus.className = 'status-indicator expired';
  countdownText.textContent = '00:00';
  countdownProgress.setAttribute('stroke-dasharray', '0, 100');
  jwtPayloadDisplay.textContent = JSON.stringify({
    simulation: true,
    status: "EXPIRED",
    message: "This token is simulated as EXPIRED. The next API call will trigger silent refresh."
  }, null, 2);
  if (countdownInterval) clearInterval(countdownInterval);
  addLog('warn', 'Access Token manually flagged as EXPIRED (Simulated).');
}

// Force Tamper Token (Developer simulation)
function forceTamperAccessToken() {
  accessToken = 'SIMULATED_TAMPERED_TOKEN';
  accessTokenStatus.textContent = 'Sim. Tampered';
  accessTokenStatus.className = 'status-indicator tampered';
  countdownText.textContent = '--:--';
  countdownProgress.setAttribute('stroke-dasharray', '100, 100');
  jwtPayloadDisplay.textContent = JSON.stringify({
    simulation: true,
    status: "TAMPERED",
    message: "This token is simulated as TAMPERED. The next API call will result in HTTP 401 Unauthorized."
  }, null, 2);
  if (countdownInterval) clearInterval(countdownInterval);
  addLog('warn', 'Access Token manually flagged as TAMPERED (Simulated).');
}

// Generative Output Canvas helpers
function clearChatCanvas() {
  chatOutputCanvas.innerHTML = '';
  chatPlaceholder.classList.remove('hidden');
  chatOutputCanvas.appendChild(chatPlaceholder);
}

// Render message card with a typewriter effect
function appendChatMessage(sender, text, imageUrl = null) {
  // Hide placeholder
  chatPlaceholder.classList.add('hidden');

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;

  const avatarDiv = document.createElement('div');
  avatarDiv.className = `chat-avatar ${sender}`;
  avatarDiv.textContent = sender === 'user' ? 'U' : 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chat-content';

  const messageText = document.createElement('p');
  contentDiv.appendChild(messageText);

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  chatOutputCanvas.appendChild(messageDiv);
  chatOutputCanvas.scrollTop = chatOutputCanvas.scrollHeight;

  if (sender === 'user') {
    messageText.textContent = text;
  } else {
    // Typewriter effect for AI
    let i = 0;
    const speed = 10; // ms per char
    
    function typeChar() {
      if (i < text.length) {
        messageText.textContent += text.charAt(i);
        i++;
        chatOutputCanvas.scrollTop = chatOutputCanvas.scrollHeight;
        setTimeout(typeChar, speed);
      } else {
        // Typing finished, append image if provided
        if (imageUrl) {
          const img = document.createElement('img');
          img.className = 'gen-image';
          img.src = imageUrl;
          img.alt = 'AI Generated Artwork';
          contentDiv.appendChild(img);
          
          // Animate scrolling to see image load
          img.onload = () => {
            chatOutputCanvas.scrollTop = chatOutputCanvas.scrollHeight;
          };
        }
      }
    }
    typeChar();
  }
}

// Collapsible Raw JSON Handler
function toggleRawJson() {
  rawJsonCollapse.classList.toggle('collapsed');
  const isCollapsed = rawJsonCollapse.classList.contains('collapsed');
  toggleIndicatorSymbol.textContent = isCollapsed ? '▼' : '▲';
}

// API Call Wrapper with Interceptor for Silent Refresh
async function apiCall(url, method = 'GET', body = null) {
  addLog('api', `Calling protected resource: ${method} ${url}`);

  const headers = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers,
    credentials: 'include' // include cookie
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    let response = await fetch(url, options);
    let data = await response.json();

    // Intercept 401 token expired
    if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
      addLog('warn', 'Access Token expired! Intercepting response...');
      
      const refreshSuccess = await performSilentRefresh();
      
      if (refreshSuccess) {
        addLog('info', 'Retrying original resource call with new verified Access Token...');
        options.headers['Authorization'] = `Bearer ${accessToken}`;
        
        response = await fetch(url, options);
        data = await response.json();
      } else {
        addLog('error', 'Silent refresh failed. Refresh Token revoked. Logging out...');
        handleLogoutState();
        showApiResponse(response.status, data);
        return { response, data };
      }
    }

    // Success or RBAC 403 Forbidden
    if (response.ok) {
      addLog('success', `API Request succeeded! Status: ${response.status}`);
    } else {
      addLog('error', `API Request failed! Status: ${response.status} (${data.message || 'Forbidden'})`);
    }

    showApiResponse(response.status, data);
    return { response, data };
  } catch (error) {
    addLog('error', `Network connection failed: ${error.message}`);
    showApiResponse(500, { success: false, message: error.message });
  }
}

// Perform silent refresh
async function performSilentRefresh() {
  try {
    addLog('info', 'Querying Silent Refresh endpoint POST /api/auth/refresh...');
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      accessToken = data.accessToken;
      addLog('success', 'Silent refresh success! Clean Access Token issued.');
      decodeAndInspectJWT(accessToken);
      updateUI();
      return true;
    } else {
      addLog('error', `Refresh verification failed: ${data.message || 'Token Revoked'}`);
      return false;
    }
  } catch (err) {
    addLog('error', `Silent refresh call failed: ${err.message}`);
    return false;
  }
}

// Manual Silent Refresh trigger from UI button
async function triggerManualRefresh() {
  addLog('info', 'Manually invoking Silent Refresh...');
  const success = await performSilentRefresh();
  if (success) {
    updateUI();
  }
}

// Execute prompt generation on the active model
async function runSelectedModel() {
  let cost = 1;
  if (selectedModelKey === 'premium-model') cost = 10;
  if (selectedModelKey === 'purge-cache') cost = 50;

  // Check credits
  if (!isInfiniteCredits && currentCredits < cost) {
    addLog('error', `Execution Blocked: Insufficient Credits. Need ${cost} tokens, only have ${currentCredits}.`);
    alert(`Insufficient Credits! This operation requires ${cost} tokens, but you only have ${currentCredits}. Please logout and use a higher-tier profile.`);
    return;
  }

  // Visualizing the User query in the chat canvas
  let promptText = '';
  if (selectedModelKey === 'free-model') {
    promptText = 'Triggering Basic Text Model (GET request)...';
  } else if (selectedModelKey === 'premium-model') {
    promptText = modelPromptInput.value;
  } else {
    promptText = 'Requesting system cache purge (DELETE request)...';
  }

  appendChatMessage('user', promptText);

  // Animate loading placeholder
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message ai';
  loadingDiv.innerHTML = `
    <div class="chat-avatar ai">AI</div>
    <div class="chat-content">
      <p style="font-style:italic; color:var(--text-muted);">Processing request... Running JWT Verification...</p>
    </div>
  `;
  chatOutputCanvas.appendChild(loadingDiv);
  chatOutputCanvas.scrollTop = chatOutputCanvas.scrollHeight;

  // Execute API Request
  let apiResult;
  if (selectedModelKey === 'free-model') {
    apiResult = await apiCall('/api/ai/free-model', 'GET');
  } else if (selectedModelKey === 'premium-model') {
    apiResult = await apiCall('/api/ai/premium-model', 'POST', { prompt: promptText });
  } else if (selectedModelKey === 'purge-cache') {
    apiResult = await apiCall('/api/ai/purge-cache', 'DELETE');
  }

  // Remove loading div
  chatOutputCanvas.removeChild(loadingDiv);

  if (apiResult && apiResult.response.ok) {
    // Deduct credits
    if (!isInfiniteCredits) {
      currentCredits -= cost;
      updateCreditsUI();
    }

    let responseString = '';
    let imageAsset = null;

    if (selectedModelKey === 'free-model') {
      responseString = apiResult.data.data.response;
    } else if (selectedModelKey === 'premium-model') {
      responseString = apiResult.data.data.response;
      // Select which image asset to load based on keywords or choice
      const lowerText = promptText.toLowerCase();
      if (lowerText.includes('brain') || lowerText.includes('cyber') || lowerText.includes('auth')) {
        imageAsset = '/assets/brain.png';
      } else {
        imageAsset = '/assets/city.png';
      }
    } else if (selectedModelKey === 'purge-cache') {
      responseString = apiResult.data.message;
    }

    appendChatMessage('ai', responseString, imageAsset);
  } else {
    // Error Response (e.g. 403 Forbidden or 401 Tampered)
    const errMessage = (apiResult && apiResult.data && apiResult.data.message) 
      ? apiResult.data.message 
      : 'Network error or connection rejected by API gateway.';
    
    appendChatMessage('ai', `⚠️ Access Blocked: ${errMessage}`);
  }
}
