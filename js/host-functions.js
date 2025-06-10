/**
 * 主持人功能模块
 * 包含创建房间、管理参与者和游戏等功能
 */

/**
 * 生成随机房间ID（4-10位字符）
 * @returns {string} 随机生成的房间ID
 */
function generateRoomId() {
    // 可用字符集（排除易混淆的字符如0和O、1和l等）
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // 随机长度（4-10位）
    const length = Math.floor(Math.random() * 7) + 4;
    
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset[randomIndex];
    }
    
    return result;
}

/**
 * 从主持人身份创建房间
 */
function createRoomAsHost() {
    // 获取主持人名称
    hostName = document.getElementById('host-name').value.trim();
    
    if (!hostName) {
        alert('请输入您的名称');
        return;
    }
    
    // 切换到主持人页面
    showHostPage();
    
    // 创建房间
    tryCreateRoom();
    
    // 绑定主持人页面事件
    initHostEvents();
}

/**
 * 初始化主持人页面事件
 */
function initHostEvents() {
    // 复制房间ID按钮
    document.getElementById('copy-room-id').addEventListener('click', function() {
        const roomIdText = document.getElementById('room-id-display').textContent;
        navigator.clipboard.writeText(roomIdText)
            .then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> 已复制';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i> 复制';
                }, 2000);
            });
    });
    
    // 发送消息
    document.getElementById('send-message-btn').addEventListener('click', sendHostMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendHostMessage();
        }
    });
    
    // 设置题目
    document.getElementById('set-puzzle-btn').addEventListener('click', setPuzzle);
    document.getElementById('clear-puzzle-btn').addEventListener('click', clearPuzzle);
    
    // 更新规则
    document.getElementById('update-rules-btn').addEventListener('click', updateRules);
}

/**
 * 发送主持人消息
 */
function sendHostMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // 在本地显示消息
    addChatMessage(message, hostName, 'host');
    
    // 发送消息给所有参与者
    broadcastToAll({
        type: 'chat',
        sender: hostName,
        message: message,
        senderType: 'host'
    });
    
    // 清空输入框
    chatInput.value = '';
}

/**
 * 设置题目
 */
function setPuzzle() {
    const puzzleTitle = document.getElementById('puzzle-title').value.trim();
    const puzzleContent = document.getElementById('puzzle-content').value.trim();
    
    if (!puzzleTitle || !puzzleContent) {
        alert('请输入题目标题和内容');
        return;
    }
    
    // 向所有参与者广播题目
    broadcastToAll({
        type: 'puzzle',
        title: puzzleTitle,
        content: puzzleContent
    });
    
    // 显示系统消息
    showSystemMessage(`题目已发布: ${puzzleTitle}`);
}

/**
 * 清除题目
 */
function clearPuzzle() {
    // 向所有参与者广播清除题目的消息
    broadcastToAll({
        type: 'clear-puzzle'
    });
    
    // 清空输入框
    document.getElementById('puzzle-title').value = '';
    document.getElementById('puzzle-content').value = '';
    
    // 显示系统消息
    showSystemMessage('题目已清除');
}

/**
 * 更新规则
 */
function updateRules() {
    const rules = document.getElementById('game-rules').value.trim();
    
    if (!rules) {
        alert('请输入游戏规则');
        return;
    }
    
    // 向所有参与者广播规则
    broadcastToAll({
        type: 'rules',
        content: rules
    });
    
    // 显示系统消息
    showSystemMessage('规则已更新并发送给所有参与者');
}

/**
 * 处理收到的消息
 * @param {Object} data - 消息数据
 * @param {string} peerId - 发送者ID
 */
function handleHostReceivedData(data, peerId) {
    console.log('主持人收到消息:', data);
    
    switch (data.type) {
        case 'join':
            // 参与者加入
            handleParticipantJoin(data, peerId);
            break;
        case 'chat':
            // 聊天消息
            addChatMessage(data.message, data.sender, 'guest');
            break;
        case 'raise-hand':
            // 举手
            handleRaiseHand(data, peerId);
            break;
        case 'leave':
            // 参与者离开
            handleParticipantLeave(peerId);
            break;
        default:
            console.log('未知消息类型:', data.type);
    }
}

/**
 * 处理参与者加入
 * @param {Object} data - 加入数据
 * @param {string} peerId - 参与者ID
 */
function handleParticipantJoin(data, peerId) {
    const { name } = data;
    
    // 保存参与者信息
    participants[peerId] = {
        name: name,
        status: 'online'
    };
    
    // 更新参与者列表
    updateParticipantsList();
    
    // 发送当前房间信息给新参与者
    const conn = connections[peerId];
    if (conn) {
        // 发送欢迎消息
        conn.send({
            type: 'welcome',
            host: hostName,
            roomId: roomId
        });
        
        // 发送当前规则
        const rules = document.getElementById('game-rules').value.trim();
        if (rules) {
            conn.send({
                type: 'rules',
                content: rules
            });
        }
        
        // 发送当前题目
        const puzzleTitle = document.getElementById('puzzle-title').value.trim();
        const puzzleContent = document.getElementById('puzzle-content').value.trim();
        if (puzzleTitle && puzzleContent) {
            conn.send({
                type: 'puzzle',
                title: puzzleTitle,
                content: puzzleContent
            });
        }
    }
    
    // 通知其他参与者有新人加入
    broadcastToAll({
        type: 'participant-update',
        participants: getParticipantsList()
    });
    
    // 显示系统消息
    showSystemMessage(`${name} 加入了房间`);
}

/**
 * 处理参与者离开
 * @param {string} peerId - 参与者ID
 */
function handleParticipantLeave(peerId) {
    if (participants[peerId]) {
        const name = participants[peerId].name;
        
        // 从参与者列表中移除
        delete participants[peerId];
        delete connections[peerId];
        
        // 更新参与者列表
        updateParticipantsList();
        
        // 通知其他参与者有人离开
        broadcastToAll({
            type: 'participant-update',
            participants: getParticipantsList()
        });
        
        // 显示系统消息
        showSystemMessage(`${name} 离开了房间`);
    }
}

/**
 * 处理参与者举手
 * @param {Object} data - 举手数据
 * @param {string} peerId - 参与者ID
 */
function handleRaiseHand(data, peerId) {
    if (participants[peerId]) {
        const name = participants[peerId].name;
        
        // 更新参与者状态
        participants[peerId].status = 'raised-hand';
        
        // 更新参与者列表
        updateParticipantsList();
        
        // 显示系统消息
        showSystemMessage(`${name} 举手提问`);
        
        // 语音提示（如果浏览器支持）
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`${name}举手提问`);
            utterance.lang = 'zh-CN';
            speechSynthesis.speak(utterance);
        }
    }
}

/**
 * 更新参与者列表UI
 */
function updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    const participantCount = document.getElementById('participant-count');
    
    // 清空列表
    participantsList.innerHTML = '';
    
    // 计算参与者数量
    const count = Object.keys(participants).length;
    participantCount.textContent = count;
    
    // 添加参与者
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
            
            // 添加回应按钮
            const respondBtn = document.createElement('button');
            respondBtn.className = 'btn';
            respondBtn.style.padding = '2px 5px';
            respondBtn.style.fontSize = '0.8rem';
            respondBtn.style.marginLeft = '5px';
            respondBtn.textContent = '回应';
            respondBtn.addEventListener('click', () => {
                // 发送回应消息
                const conn = connections[peerId];
                if (conn) {
                    conn.send({
                        type: 'host-response',
                        message: '请提问'
                    });
                    
                    // 更新参与者状态
                    participants[peerId].status = 'online';
                    updateParticipantsList();
                }
            });
            
            status.appendChild(respondBtn);
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

/**
 * 获取参与者列表数据
 * @returns {Array} 参与者列表
 */
function getParticipantsList() {
    const list = [];
    for (const peerId in participants) {
        list.push({
            id: peerId,
            name: participants[peerId].name,
            status: participants[peerId].status
        });
    }
    return list;
}

/**
 * 向所有参与者广播消息
 * @param {Object} data - 要广播的数据
 */
function broadcastToAll(data) {
    for (const peerId in connections) {
        const conn = connections[peerId];
        if (conn && conn.open) {
            conn.send(data);
        }
    }
}

/**
 * 尝试使用当前服务器创建房间
 */
function tryCreateRoom() {
    // 生成自定义房间ID
    const customRoomId = generateRoomId();
    
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
    updateConnectionStatus('connecting', '连接服务器中...');
    
    showSystemMessage(`正在连接到PeerJS服务器 (${serverConfig.host})...`);
    
    // 初始化PeerJS连接，使用自定义ID
    peer = new Peer(customRoomId, {
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
        roomId = id;
        document.getElementById('room-id-display').textContent = roomId;
        
        // 更新服务器状态
        updateServerStatus(currentServerIndex, 'connected');
        
        // 更新连接状态
        updateConnectionStatus('connected', '已连接');
        
        showSystemMessage(`房间创建成功，ID: ${roomId}`);
    });
    
    // 连接错误事件
    peer.on('error', error => {
        console.error('PeerJS 错误:', error);
        
        // 更新服务器状态
        updateServerStatus(currentServerIndex, 'failed');
        
        if (error.type === 'unavailable-id') {
            // ID已被占用，尝试使用新ID
            showSystemMessage('房间ID已被占用，正在尝试新的ID...');
            currentServerIndex = 0;
            tryCreateRoom();
        } else if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
            // 网络/服务器错误，尝试下一个服务器
            showSystemMessage(`服务器 ${serverConfig.host} 连接失败，正在尝试其他服务器...`);
            
            // 尝试下一个服务器
            currentServerIndex = (currentServerIndex + 1) % peerServerOptions.length;
            tryCreateRoom();
        } else {
            // 其他错误
            updateConnectionStatus('disconnected', '连接失败');
            showSystemMessage(`连接错误: ${error.type}`);
        }
    });
    
    // 连接断开事件
    peer.on('disconnected', () => {
        updateConnectionStatus('disconnected', '已断开');
        showSystemMessage('与服务器的连接已断开，尝试重新连接...');
        
        // 尝试重新连接
        peer.reconnect();
    });
    
    // 收到连接请求事件
    peer.on('connection', conn => {
        const peerId = conn.peer;
        connections[peerId] = conn;
        
        // 设置连接事件处理
        setupConnectionEvents(conn);
    });
}

/**
 * 设置PeerJS事件监听
 */
function setupPeerEvents() {
    if (!peer) return;
    
    peer.on('connection', handleNewConnection);
    
    peer.on('disconnected', () => {
        console.log('Peer disconnected');
        updateConnectionStatus('connecting', true);
        showSystemMessage('与服务器断开连接，尝试重新连接...');
        
        // 尝试重新连接
        setTimeout(() => {
            if (peer) {
                peer.reconnect();
            }
        }, 3000);
        
        // 如果长时间未重连成功，提示用户
        setTimeout(() => {
            if (peer && peer.disconnected) {
                showSystemMessage('重连失败，请刷新页面重试');
            }
        }, 10000);
    });
    
    peer.on('close', () => {
        console.log('Peer connection closed');
        connections = {};
        updateConnectionStatus('disconnected', true);
        showSystemMessage('连接已关闭');
    });
}

/**
 * 更新规则列表显示
 */
function updateRulesList() {
    const rulesList = document.getElementById('rules-list');
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
 * 广播参与者列表更新
 */
function broadcastParticipants() {
    const message = {
        type: 'participants-update',
        participants: participants
    };
    
    broadcastToAll(message);
}

/**
 * 发布谜题
 */
function publishPuzzle() {
    const puzzleText = document.getElementById('puzzle-input').value.trim();
    
    if (!puzzleText) {
        alert('请输入谜题内容');
        return;
    }
    
    currentPuzzle = puzzleText;
    gameStarted = true;
    
    // 清空举手列表
    raisedHands = [];
    
    // 广播谜题
    const message = {
        type: 'puzzle',
        content: puzzleText
    };
    
    broadcastToAll(message);
    
    // 显示系统消息
    showSystemMessage('谜题已发布');
}

/**
 * 发布情报
 */
function publishIntel() {
    const intelText = document.getElementById('intel-input').value.trim();
    
    if (!intelText) {
        alert('请输入情报内容');
        return;
    }
    
    // 广播情报
    const message = {
        type: 'intel',
        content: intelText
    };
    
    broadcastToAll(message);
    
    // 显示系统消息
    showSystemMessage(`情报已发布: ${intelText}`);
    
    // 清空情报输入框
    document.getElementById('intel-input').value = '';
}

/**
 * 发送主持人回应
 * @param {string} response - 回应内容（是、否、不确定）
 */
function sendHostResponse(response) {
    // 如果没有选中参与者提问，则发送给所有人
    const message = {
        type: 'host-response',
        response: response
    };
    
    broadcastToAll(message);
    
    // 显示主持人回应
    showChatMessage(userName, response, 'host');
}

/**
 * 结束游戏
 */
function endGame() {
    if (!gameStarted) {
        alert('游戏尚未开始');
        return;
    }
    
    gameStarted = false;
    
    // 广播游戏结束消息
    const message = {
        type: 'game-end'
    };
    
    broadcastToAll(message);
    
    // 显示系统消息
    showSystemMessage('游戏已结束');
}

/**
 * 继续游戏
 */
function continueGame() {
    if (gameStarted) {
        alert('游戏已经在进行中');
        return;
    }
    
    gameStarted = true;
    
    // 广播游戏继续消息
    const message = {
        type: 'game-continue'
    };
    
    broadcastToAll(message);
    
    // 显示系统消息
    showSystemMessage('游戏继续');
}

/**
 * 处理举手请求
 * @param {string} peerId - 举手者的PeerID
 */
function handleRaiseHand(peerId) {
    if (!participants[peerId]) return;
    
    participants[peerId].raisedHand = true;
    
    // 更新参与者列表
    updateParticipantsList();
    
    // 显示系统消息
    showSystemMessage(`${participants[peerId].name} 举手了`);
    
    // 广播更新后的参与者列表
    broadcastParticipants();
}

/**
 * 复制房间ID到剪贴板
 */
function copyRoomId() {
    const roomId = document.getElementById('room-id-display').textContent;
    
    navigator.clipboard.writeText(roomId)
        .then(() => {
            showSystemMessage('房间ID已复制到剪贴板');
            // 临时改变按钮文字提示已复制
            const copyButton = document.getElementById('copy-room-id');
            const originalText = copyButton.textContent;
            copyButton.textContent = '已复制!';
            copyButton.style.backgroundColor = '#27ae60';
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.style.backgroundColor = '';
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy room ID:', err);
            alert('复制失败，请手动复制');
        });
} 