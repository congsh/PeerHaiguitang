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
 * 创建新房间
 */
function createRoom() {
    // 获取表单数据
    roomName = document.getElementById('room-name').value.trim();
    userName = document.getElementById('host-name').value.trim();
    
    // 验证输入
    if (!roomName || !userName) {
        alert('请填写房间名称和主持人昵称');
        return;
    }
    
    // 获取房间规则
    roomRules = {
        soupType: document.getElementById('soup-type').value,
        scoringMethod: document.getElementById('scoring-method').value,
        answerMethod: document.getElementById('answer-method').value,
        interactionMethod: document.getElementById('interaction-method').value
    };
    
    // 初始化主持人
    isHost = true;
    
    // 显示创建中状态
    showScreen('host-room-screen');
    document.getElementById('host-room-name').textContent = `房间: ${roomName} (创建中...)`;
    showSystemMessage('正在创建房间，请稍候...');
    
    // 重置服务器索引
    resetPeerServerIndex();
    
    // 尝试创建房间
    tryCreateRoom();
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
    
    // 设置连接超时
    const peerTimeout = setTimeout(() => {
        if (peer) {
            peer.destroy();
            peer = null;
        }
        
        // 更新服务器状态
        updateServerStatus(currentServerIndex, 'failed');
        
        // 如果还有其他服务器可尝试
        if (currentServerIndex < peerServerOptions.length - 1) {
            showSystemMessage(`当前服务器连接超时，尝试下一个服务器...`);
            getNextPeerServer();
            tryCreateRoom();
        } else {
            // 所有服务器都尝试失败
            resetPeerServerIndex();
            showSystemMessage('创建房间失败，所有服务器均无法连接');
            alert('创建房间失败，请检查网络连接或稍后重试');
            showScreen('host-setup-screen');
        }
    }, 10000); // 10秒超时
    
    peer.on('open', (id) => {
        clearTimeout(peerTimeout);
        console.log('Room created with ID:', id);
        peerId = id;
        
        // 更新服务器状态
        updateServerStatus(currentServerIndex, 'connected');
        
        // 设置房间ID显示
        const roomIdDisplay = document.getElementById('room-id-display');
        roomIdDisplay.textContent = id;
        
        // 自动复制ID到剪贴板
        try {
            navigator.clipboard.writeText(id).then(() => {
                showSystemMessage('房间ID已自动复制到剪贴板');
            }).catch(err => {
                console.error('Failed to auto-copy room ID:', err);
            });
        } catch (err) {
            console.error('Clipboard API not available:', err);
        }
        
        // 设置房间名称显示
        document.getElementById('host-room-name').textContent = `房间: ${roomName}`;
        
        // 添加主持人到参与者列表
        participants[id] = {
            name: userName,
            isHost: true
        };
        
        // 更新参与者列表显示
        updateParticipantsList();
        
        // 更新规则显示
        updateRulesList();
        
        // 显示欢迎消息
        showSystemMessage(`房间 "${roomName}" 已创建，等待参与者加入...`);
        showSystemMessage(`请将房间ID: ${id} 分享给参与者`);
        showSystemMessage(`已连接到服务器: ${serverConfig.host}`);
        
        // 更新连接状态
        updateConnectionStatus('connected', true);
        
        // 设置PeerJS事件监听
        setupPeerEvents();
    });
    
    peer.on('error', (err) => {
        clearTimeout(peerTimeout);
        console.error('PeerJS error:', err);
        
        // 更新服务器状态
        updateServerStatus(currentServerIndex, 'failed');
        
        // 检查是否是ID已被占用错误
        if (err.type === 'unavailable-id') {
            // ID被占用，重新尝试创建房间
            tryCreateRoom();
            return;
        }
        
        // 检查是否是服务器连接错误
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
            // 如果还有其他服务器可尝试
            if (currentServerIndex < peerServerOptions.length - 1) {
                showSystemMessage(`服务器连接失败，尝试下一个服务器...`);
                getNextPeerServer();
                tryCreateRoom();
            } else {
                // 所有服务器都尝试失败
                resetPeerServerIndex();
                showSystemMessage('创建房间失败，所有服务器均无法连接');
                alert('创建房间失败，请检查网络连接或稍后重试');
                showScreen('host-setup-screen');
            }
            return;
        }
        
        // 其他错误
        showSystemMessage(`创建房间失败: ${err.message || err.type}`);
        alert('创建房间失败，请重试');
        showScreen('host-setup-screen');
        
        if (peer) {
            peer.destroy();
            peer = null;
        }
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
 * 更新参与者列表显示
 */
function updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = '';
    
    // 先添加主持人
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
 * 向所有参与者广播消息
 * @param {Object} message - 要广播的消息对象
 */
function broadcastToAll(message) {
    Object.values(connections).forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
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