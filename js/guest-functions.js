/**
 * 参与者功能模块
 * 包含加入房间、提问和互动等功能
 */

/**
 * 加入房间
 */
function joinRoom() {
    // 获取表单数据
    const roomId = document.getElementById('room-id').value.trim().toUpperCase();
    userName = document.getElementById('guest-name').value.trim();
    
    // 验证输入
    if (!roomId || !userName) {
        alert('请填写房间ID和昵称');
        return;
    }
    
    // 验证房间ID格式（4-10位字母数字）
    if (!/^[A-Z0-9]{4,10}$/.test(roomId)) {
        alert('房间ID格式不正确，应为4-10位大写字母和数字');
        return;
    }
    
    // 显示连接中状态
    showScreen('guest-room-screen');
    document.getElementById('guest-room-name').textContent = '正在连接...';
    showSystemMessage('正在连接到房间...', 'guest-chat-messages');
    updateConnectionStatus('connecting', false);
    
    // 初始化参与者
    isHost = false;
    
    // 重置服务器索引
    resetPeerServerIndex();
    
    // 尝试加入房间
    tryJoinRoom(roomId);
}

/**
 * 尝试使用当前服务器加入房间
 * @param {string} roomId - 房间ID
 */
function tryJoinRoom(roomId) {
    // 获取当前服务器配置
    const serverConfig = getCurrentPeerServer();
    
    // 更新服务器状态指示器
    for (let i = 0; i < peerServerOptions.length; i++) {
        if (i < currentServerIndex) {
            updateServerStatus(i, 'failed');
        } else if (i === currentServerIndex) {
            updateServerStatus(i, 'connecting');
        }
    }
    
    // 更新连接状态
    updateConnectionStatus('connecting', '连接服务器中...', 'connection-status');
    
    showSystemMessage(`正在连接到PeerJS服务器 (${serverConfig.host})...`, 'guest-chat-messages');
    
    try {
        // 如果已有Peer实例，先销毁
        if (peer) {
            peer.destroy();
            peer = null;
        }
        
        // 初始化PeerJS
        peer = new Peer(null, {
            debug: 2,
            config: {
                'iceServers': getStunServers()
            },
            pingInterval: 5000,
            host: serverConfig.host,
            port: serverConfig.port,
            path: serverConfig.path,
            secure: serverConfig.secure,
            key: serverConfig.key
        });
        
        // 连接成功事件
        peer.on('open', id => {
            // 更新服务器状态
            updateServerStatus(currentServerIndex, 'connected');
            
            showSystemMessage(`已连接到服务器，正在尝试加入房间...`, 'guest-chat-messages');
            
            // 连接到主持人
            connectToHost(roomId);
        });
        
        // 连接错误事件
        peer.on('error', error => {
            console.error('PeerJS 错误:', error);
            
            // 更新服务器状态
            updateServerStatus(currentServerIndex, 'failed');
            
            if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
                // 网络/服务器错误，尝试下一个服务器
                showSystemMessage(`服务器 ${serverConfig.host} 连接失败，正在尝试其他服务器...`, 'guest-chat-messages');
                
                // 尝试下一个服务器
                currentServerIndex = (currentServerIndex + 1) % peerServerOptions.length;
                tryJoinRoom(roomId);
            } else if (error.type === 'peer-unavailable') {
                // 房间不存在
                updateConnectionStatus('disconnected', '房间不存在', 'connection-status');
                showSystemMessage(`房间 ${roomId} 不存在或已关闭，请检查房间ID`, 'guest-chat-messages');
            } else {
                // 其他错误
                updateConnectionStatus('disconnected', '连接失败', 'connection-status');
                showSystemMessage(`连接错误: ${error.type}`, 'guest-chat-messages');
            }
        });
        
        // 连接断开事件
        peer.on('disconnected', () => {
            updateConnectionStatus('disconnected', '已断开', 'connection-status');
            showSystemMessage('与服务器的连接已断开，尝试重新连接...', 'guest-chat-messages');
            
            // 尝试重新连接
            peer.reconnect();
        });
        
    } catch (error) {
        console.error('初始化PeerJS失败:', error);
        showSystemMessage(`初始化连接失败: ${error.message}`, 'guest-chat-messages');
    }
}

/**
 * 连接到主持人
 * @param {string} hostId - 主持人的PeerJS ID
 */
function connectToHost(hostId) {
    // 更新连接状态
    updateConnectionStatus('connecting', '连接房间中...', 'connection-status');
    
    // 建立到主持人的连接
    conn = peer.connect(hostId, {
        reliable: true,
        metadata: {
            name: guestName,
            type: 'guest'
        }
    });
    
    // 连接打开事件
    conn.on('open', () => {
        // 更新连接状态
        updateConnectionStatus('connected', '已连接', 'connection-status');
        
        // 发送加入消息
        conn.send({
            type: 'join',
            name: guestName
        });
        
        showSystemMessage(`成功连接到房间 ${hostId}`, 'guest-chat-messages');
    });
    
    // 连接错误事件
    conn.on('error', error => {
        console.error('连接错误:', error);
        updateConnectionStatus('disconnected', '连接失败', 'connection-status');
        showSystemMessage(`连接错误: ${error.message || '未知错误'}`, 'guest-chat-messages');
    });
    
    // 连接关闭事件
    conn.on('close', () => {
        updateConnectionStatus('disconnected', '已断开', 'connection-status');
        showSystemMessage('与主持人的连接已断开', 'guest-chat-messages');
    });
    
    // 收到数据事件
    conn.on('data', data => {
        handleGuestReceivedData(data);
    });
}

/**
 * 处理来自主持人的数据
 * @param {Object} data - 接收到的数据
 */
function handleHostData(data) {
    console.log('Received data from host:', data);
    
    switch (data.type) {
        case 'room-info':
            // 接收房间信息
            handleRoomInfo(data);
            break;
            
        case 'participants-update':
            // 更新参与者列表
            participants = data.participants;
            updateGuestParticipantsList();
            break;
            
        case 'puzzle':
            // 接收谜题
            document.getElementById('puzzle-display').textContent = data.content;
            showSystemMessage('主持人发布了新谜题', 'guest-chat-messages');
            break;
            
        case 'intel':
            // 接收情报
            const intelDisplay = document.getElementById('intel-display');
            intelDisplay.textContent = data.content;
            showSystemMessage('主持人发布了新情报', 'guest-chat-messages');
            break;
            
        case 'host-response':
            // 接收主持人回应
            handleHostResponse(data);
            break;
            
        case 'game-end':
            // 游戏结束
            showSystemMessage('游戏已结束', 'guest-chat-messages');
            break;
            
        case 'game-continue':
            // 游戏继续
            showSystemMessage('游戏继续', 'guest-chat-messages');
            break;
            
        case 'question-from-other':
            // 其他参与者的问题
            showChatMessage(data.sender, data.question, 'guest', 'guest-chat-messages');
            break;
            
        case 'reaction':
            // 收到反应
            showSystemMessage(`${data.sender} ${data.reaction === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`, 'guest-chat-messages');
            break;
    }
}

/**
 * 处理房间信息
 * @param {Object} data - 房间信息数据
 */
function handleRoomInfo(data) {
    roomName = data.roomName;
    roomRules = data.rules;
    participants = data.participants;
    
    // 更新房间名称显示
    document.getElementById('guest-room-name').textContent = `房间: ${roomName}`;
    
    // 更新主持人信息显示
    const hostInfo = Object.values(participants).find(p => p.isHost);
    if (hostInfo) {
        document.getElementById('host-info-display').textContent = hostInfo.name;
    }
    
    // 更新参与者列表
    updateGuestParticipantsList();
    
    // 更新规则列表
    updateGuestRulesList();
    
    // 设置举手按钮显示
    if (roomRules.answerMethod === 'raise-hand') {
        document.getElementById('raise-hand-btn').style.display = 'block';
    } else {
        document.getElementById('raise-hand-btn').style.display = 'none';
    }
    
    // 设置反应按钮显示
    if (roomRules.interactionMethod === 'enabled') {
        document.getElementById('reaction-buttons').style.display = 'flex';
    } else {
        document.getElementById('reaction-buttons').style.display = 'none';
    }
    
    showSystemMessage(`已加入房间 "${roomName}"`, 'guest-chat-messages');
}

/**
 * 更新参与者列表显示（参与者视角）
 */
function updateGuestParticipantsList() {
    const participantsList = document.getElementById('guest-participants-list');
    participantsList.innerHTML = '';
    
    Object.keys(participants).forEach(pid => {
        const participant = participants[pid];
        
        const li = document.createElement('li');
        li.innerHTML = `${participant.name} ${participant.isHost ? '(主持人)' : ''}`;
        
        if (participant.raisedHand) {
            const handIcon = document.createElement('span');
            handIcon.textContent = ' ✋';
            handIcon.title = '已举手';
            li.appendChild(handIcon);
        }
        
        participantsList.appendChild(li);
    });
}

/**
 * 更新规则列表显示（参与者视角）
 */
function updateGuestRulesList() {
    const rulesList = document.getElementById('guest-rules-list');
    rulesList.innerHTML = '';
    
    // 添加汤类型
    const soupTypeLi = document.createElement('li');
    soupTypeLi.textContent = `汤类型: ${roomRules.soupType === 'red' ? '红汤' : '普通汤'}`;
    rulesList.appendChild(soupTypeLi);
    
    // 添加打分方式
    const scoringMethodLi = document.createElement('li');
    let scoringText = '';
    switch (roomRules.scoringMethod) {
        case 'host':
            scoringText = '仅主持人打分';
            break;
        case 'all':
            scoringText = '所有人打分';
            break;
        case 'none':
            scoringText = '不打分';
            break;
    }
    scoringMethodLi.textContent = `打分方式: ${scoringText}`;
    rulesList.appendChild(scoringMethodLi);
    
    // 添加回答方式
    const answerMethodLi = document.createElement('li');
    answerMethodLi.textContent = `回答方式: ${roomRules.answerMethod === 'raise-hand' ? '举手回答' : '自由回答'}`;
    rulesList.appendChild(answerMethodLi);
    
    // 添加互动方式
    const interactionMethodLi = document.createElement('li');
    interactionMethodLi.textContent = `互动方式: ${roomRules.interactionMethod === 'enabled' ? '允许丢鲜花和垃圾' : '不允许丢鲜花和垃圾'}`;
    rulesList.appendChild(interactionMethodLi);
}

/**
 * 处理主持人回应
 * @param {Object} data - 主持人回应数据
 */
function handleHostResponse(data) {
    const hostInfo = Object.values(participants).find(p => p.isHost);
    const hostName = hostInfo ? hostInfo.name : '主持人';
    
    showChatMessage(hostName, data.response, 'host', 'guest-chat-messages');
    
    // 如果是"是"的回答，可以添加到笔记中
    if (data.response === '是') {
        const notesTextarea = document.getElementById('personal-notes');
        const lastQuestion = document.querySelector('#guest-chat-messages .message.guest:last-of-type .content');
        
        if (lastQuestion) {
            const noteText = `问题: ${lastQuestion.textContent}\n回答: 是\n\n`;
            notesTextarea.value += noteText;
            
            // 保存笔记
            saveNotes();
        }
    }
}

/**
 * 发送问题
 */
function sendQuestion() {
    const questionInput = document.getElementById('question-input');
    const question = questionInput.value.trim();
    
    if (!question) {
        return;
    }
    
    // 检查是否需要举手
    if (roomRules.answerMethod === 'raise-hand' && !participants[peerId].raisedHand) {
        alert('请先举手再提问');
        return;
    }
    
    // 发送问题给主持人
    hostConnection.send({
        type: 'question',
        question: question
    });
    
    // 显示自己的问题
    showChatMessage(userName, question, 'guest', 'guest-chat-messages');
    
    // 清空输入框
    questionInput.value = '';
    
    // 如果已举手，提问后取消举手状态
    if (participants[peerId] && participants[peerId].raisedHand) {
        participants[peerId].raisedHand = false;
        hostConnection.send({
            type: 'lower-hand'
        });
    }
}

/**
 * 举手
 */
function raiseHand() {
    if (!participants[peerId]) return;
    
    if (participants[peerId].raisedHand) {
        // 如果已经举手，则放下手
        participants[peerId].raisedHand = false;
        hostConnection.send({
            type: 'lower-hand'
        });
        document.getElementById('raise-hand-btn').textContent = '举手';
    } else {
        // 如果没有举手，则举手
        participants[peerId].raisedHand = true;
        hostConnection.send({
            type: 'raise-hand'
        });
        document.getElementById('raise-hand-btn').textContent = '放下手';
    }
}

/**
 * 发送反应（鲜花或垃圾）
 * @param {string} reaction - 反应类型
 */
function sendReaction(reaction) {
    if (roomRules.interactionMethod !== 'enabled') {
        return;
    }
    
    hostConnection.send({
        type: 'reaction',
        reaction: reaction
    });
    
    showSystemMessage(`你${reaction === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`, 'guest-chat-messages');
}

/**
 * 保存笔记
 */
function saveNotes() {
    const notesTextarea = document.getElementById('personal-notes');
    if (notesTextarea) {
        notes = notesTextarea.value;
        localStorage.setItem('haiguitang-notes', notes);
    }
}

/**
 * 加载笔记
 */
function loadNotes() {
    const notesTextarea = document.getElementById('personal-notes');
    if (notesTextarea) {
        const savedNotes = localStorage.getItem('haiguitang-notes');
        if (savedNotes) {
            notesTextarea.value = savedNotes;
            notes = savedNotes;
        }
    }
}

// 全局变量
let peer = null;
let conn = null;
let currentServerIndex = 0;
let guestName = '';
let roomId = '';
let participants = {};
let hostName = '';
let isHandRaised = false;

/**
 * 从参与者身份加入房间
 */
function joinRoomAsGuest() {
    // 获取参与者名称和房间ID
    guestName = document.getElementById('guest-name').value.trim();
    roomId = document.getElementById('room-id').value.trim().toUpperCase();
    
    if (!guestName) {
        alert('请输入您的名称');
        return;
    }
    
    if (!roomId) {
        alert('请输入房间ID');
        return;
    }
    
    // 验证房间ID格式
    if (!isValidRoomId(roomId)) {
        alert('房间ID格式不正确，应为4-10位字母和数字');
        return;
    }
    
    // 切换到参与者页面
    showGuestPage();
    
    // 显示房间ID
    document.getElementById('guest-room-id-display').textContent = roomId;
    
    // 尝试加入房间
    tryJoinRoom(roomId);
    
    // 绑定参与者页面事件
    initGuestEvents();
}

/**
 * 验证房间ID格式
 * @param {string} id - 要验证的房间ID
 * @returns {boolean} 是否有效
 */
function isValidRoomId(id) {
    return /^[A-Z0-9]{4,10}$/.test(id);
}

/**
 * 初始化参与者页面事件
 */
function initGuestEvents() {
    // 发送消息
    document.getElementById('guest-send-message-btn').addEventListener('click', sendGuestMessage);
    document.getElementById('guest-chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendGuestMessage();
        }
    });
    
    // 举手按钮
    document.getElementById('raise-hand-btn').addEventListener('click', toggleRaiseHand);
    
    // 保存和清除笔记
    document.getElementById('save-notes-btn').addEventListener('click', saveNotes);
    document.getElementById('clear-notes-btn').addEventListener('click', clearNotes);
}

/**
 * 发送参与者消息
 */
function sendGuestMessage() {
    const chatInput = document.getElementById('guest-chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // 检查连接状态
    if (!conn || !conn.open) {
        showSystemMessage('连接已断开，无法发送消息', 'guest-chat-messages');
        return;
    }
    
    // 在本地显示消息
    addChatMessage(message, guestName, 'guest', 'guest-chat-messages');
    
    // 发送消息给主持人
    conn.send({
        type: 'chat',
        sender: guestName,
        message: message
    });
    
    // 清空输入框
    chatInput.value = '';
}

/**
 * 切换举手状态
 */
function toggleRaiseHand() {
    const raiseHandBtn = document.getElementById('raise-hand-btn');
    
    // 切换举手状态
    isHandRaised = !isHandRaised;
    
    if (isHandRaised) {
        // 更新按钮样式
        raiseHandBtn.innerHTML = '<i class="fas fa-hand-paper"></i> 取消举手';
        raiseHandBtn.classList.add('btn-danger');
        
        // 发送举手消息
        conn.send({
            type: 'raise-hand',
            name: guestName
        });
        
        // 显示系统消息
        showSystemMessage('您已举手，等待主持人回应', 'guest-chat-messages');
    } else {
        // 更新按钮样式
        raiseHandBtn.innerHTML = '<i class="fas fa-hand-paper"></i> 举手';
        raiseHandBtn.classList.remove('btn-danger');
        
        // 发送取消举手消息
        conn.send({
            type: 'cancel-raise-hand',
            name: guestName
        });
        
        // 显示系统消息
        showSystemMessage('您已取消举手', 'guest-chat-messages');
    }
}

/**
 * 保存笔记
 */
function saveNotes() {
    const notes = document.getElementById('personal-notes').value;
    localStorage.setItem('haiguitang_notes_' + roomId, notes);
    showSystemMessage('笔记已保存', 'guest-chat-messages');
}

/**
 * 清除笔记
 */
function clearNotes() {
    if (confirm('确定要清除所有笔记吗？')) {
        document.getElementById('personal-notes').value = '';
        localStorage.removeItem('haiguitang_notes_' + roomId);
        showSystemMessage('笔记已清除', 'guest-chat-messages');
    }
}

/**
 * 处理收到的消息
 * @param {Object} data - 消息数据
 */
function handleGuestReceivedData(data) {
    console.log('参与者收到消息:', data);
    
    switch (data.type) {
        case 'welcome':
            // 欢迎消息
            handleWelcomeMessage(data);
            break;
        case 'chat':
            // 聊天消息
            addChatMessage(data.message, data.sender, 'host', 'guest-chat-messages');
            break;
        case 'rules':
            // 规则更新
            handleRulesUpdate(data);
            break;
        case 'puzzle':
            // 题目更新
            handlePuzzleUpdate(data);
            break;
        case 'clear-puzzle':
            // 清除题目
            handleClearPuzzle();
            break;
        case 'host-response':
            // 主持人回应
            handleHostResponse(data);
            break;
        case 'participant-update':
            // 参与者列表更新
            handleParticipantUpdate(data);
            break;
        default:
            console.log('未知消息类型:', data.type);
    }
}

/**
 * 处理欢迎消息
 * @param {Object} data - 欢迎消息数据
 */
function handleWelcomeMessage(data) {
    hostName = data.host;
    
    // 更新连接状态
    showSystemMessage(`成功连接到主持人 ${hostName} 的房间`, 'guest-chat-messages');
    
    // 加载保存的笔记
    const savedNotes = localStorage.getItem('haiguitang_notes_' + roomId);
    if (savedNotes) {
        document.getElementById('personal-notes').value = savedNotes;
    }
}

/**
 * 处理规则更新
 * @param {Object} data - 规则数据
 */
function handleRulesUpdate(data) {
    const rulesContainer = document.getElementById('guest-rules');
    rulesContainer.innerHTML = data.content.replace(/\n/g, '<br>');
    
    showSystemMessage('主持人更新了游戏规则', 'guest-chat-messages');
}

/**
 * 处理题目更新
 * @param {Object} data - 题目数据
 */
function handlePuzzleUpdate(data) {
    document.getElementById('puzzle-title-display').textContent = data.title;
    document.getElementById('puzzle-content-display').innerHTML = data.content.replace(/\n/g, '<br>');
    
    showSystemMessage('主持人发布了新题目', 'guest-chat-messages');
}

/**
 * 处理清除题目
 */
function handleClearPuzzle() {
    document.getElementById('puzzle-title-display').textContent = '等待主持人设置题目...';
    document.getElementById('puzzle-content-display').textContent = '主持人尚未设置题目，请耐心等待。';
    
    showSystemMessage('主持人清除了题目', 'guest-chat-messages');
}

/**
 * 处理主持人回应
 * @param {Object} data - 回应数据
 */
function handleHostResponse(data) {
    // 更新举手状态
    isHandRaised = false;
    
    // 更新按钮样式
    const raiseHandBtn = document.getElementById('raise-hand-btn');
    raiseHandBtn.innerHTML = '<i class="fas fa-hand-paper"></i> 举手';
    raiseHandBtn.classList.remove('btn-danger');
    
    // 显示系统消息
    showSystemMessage(`主持人回应: ${data.message}`, 'guest-chat-messages');
}

/**
 * 处理参与者列表更新
 * @param {Object} data - 参与者列表数据
 */
function handleParticipantUpdate(data) {
    participants = {};
    
    // 更新参与者列表
    data.participants.forEach(p => {
        participants[p.id] = {
            name: p.name,
            status: p.status
        };
    });
    
    // 更新UI
    updateGuestParticipantsList();
}

/**
 * 更新参与者列表UI
 */
function updateGuestParticipantsList() {
    const participantsList = document.getElementById('guest-participants-list');
    const participantCount = document.getElementById('guest-participant-count');
    
    // 清空列表
    participantsList.innerHTML = '';
    
    // 添加主持人
    const hostItem = document.createElement('li');
    hostItem.className = 'participant-item';
    
    // 创建头像
    const hostAvatar = document.createElement('div');
    hostAvatar.className = 'participant-avatar';
    hostAvatar.style.backgroundColor = '#e74c3c';
    hostAvatar.textContent = hostName.charAt(0).toUpperCase();
    
    // 创建名称
    const hostNameElement = document.createElement('div');
    hostNameElement.className = 'participant-name';
    hostNameElement.textContent = `${hostName} (主持人)`;
    
    hostItem.appendChild(hostAvatar);
    hostItem.appendChild(hostNameElement);
    participantsList.appendChild(hostItem);
    
    // 计算参与者数量（包括主持人）
    const count = Object.keys(participants).length + 1;
    participantCount.textContent = count;
    
    // 添加其他参与者
    for (const peerId in participants) {
        const participant = participants[peerId];
        const listItem = document.createElement('li');
        listItem.className = 'participant-item';
        
        // 创建头像
        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = participant.name.charAt(0).toUpperCase();
        
        // 创建名称
        const name = document.createElement('div');
        name.className = 'participant-name';
        name.textContent = participant.name;
        
        // 创建状态
        const status = document.createElement('div');
        status.className = 'participant-status';
        
        if (participant.status === 'raised-hand') {
            status.textContent = '举手中';
            status.classList.add('status-raised-hand');
        } else {
            status.textContent = '在线';
            status.classList.add('status-online');
        }
        
        // 添加到列表项
        listItem.appendChild(avatar);
        listItem.appendChild(name);
        listItem.appendChild(status);
        
        // 添加到列表
        participantsList.appendChild(listItem);
    }
} 