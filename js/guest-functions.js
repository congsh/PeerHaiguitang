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
        
        // 设置PeerJS连接超时
        const peerTimeout = setTimeout(() => {
            if (peer && !peerId) {
                if (peer) {
                    peer.destroy();
                    peer = null;
                }
                
                // 更新服务器状态
                updateServerStatus(currentServerIndex, 'failed');
                
                // 如果还有其他服务器可尝试
                if (currentServerIndex < peerServerOptions.length - 1) {
                    showSystemMessage(`当前服务器连接超时，尝试下一个服务器...`, 'guest-chat-messages');
                    getNextPeerServer();
                    tryJoinRoom(roomId);
                } else {
                    // 所有服务器都尝试失败
                    resetPeerServerIndex();
                    showSystemMessage('连接失败，所有服务器均无法连接', 'guest-chat-messages');
                    alert('连接失败，请检查网络连接或稍后重试');
                    showScreen('guest-setup-screen');
                }
            }
        }, 10000); // 10秒超时
        
        // 设置PeerJS事件监听
        peer.on('open', (myPeerId) => {
            clearTimeout(peerTimeout);
            console.log('My peer ID is:', myPeerId);
            peerId = myPeerId;
            
            // 更新服务器状态
            updateServerStatus(currentServerIndex, 'connected');
            
            showSystemMessage(`已连接到服务器: ${serverConfig.host}`, 'guest-chat-messages');
            showSystemMessage(`正在连接到房间: ${roomId}...`, 'guest-chat-messages');
            
            try {
                // 连接到主持人
                hostConnection = peer.connect(roomId, {
                    metadata: {
                        name: userName
                    },
                    reliable: true
                });
                
                if (!hostConnection) {
                    throw new Error('无法创建连接');
                }
                
                // 设置连接超时
                const connectionTimeout = setTimeout(() => {
                    if (hostConnection && !hostConnection.open) {
                        // 如果还有其他服务器可尝试
                        if (currentServerIndex < peerServerOptions.length - 1) {
                            showSystemMessage(`房间连接超时，尝试下一个服务器...`, 'guest-chat-messages');
                            getNextPeerServer();
                            tryJoinRoom(roomId);
                        } else {
                            // 所有服务器都尝试失败
                            resetPeerServerIndex();
                            showSystemMessage('连接超时，请检查房间ID是否正确', 'guest-chat-messages');
                            alert('连接超时，请检查房间ID是否正确');
                            resetState();
                            showScreen('guest-setup-screen');
                        }
                    }
                }, 8000); // 8秒超时
                
                hostConnection.on('open', () => {
                    clearTimeout(connectionTimeout);
                    console.log('Connected to host');
                    updateConnectionStatus('connected', false);
                    
                    // 发送加入请求
                    hostConnection.send({
                        type: 'join-request',
                        name: userName,
                        peerId: myPeerId
                    });
                    
                    // 显示欢迎消息
                    showSystemMessage('已连接到房间，等待主持人确认...', 'guest-chat-messages');
                });
                
                hostConnection.on('data', handleHostData);
                
                hostConnection.on('close', () => {
                    console.log('Connection to host closed');
                    updateConnectionStatus('disconnected', false);
                    showSystemMessage('与主持人的连接已关闭', 'guest-chat-messages');
                    
                    // 返回欢迎界面
                    setTimeout(() => {
                        alert('房间已关闭或主持人已离开');
                        showScreen('welcome-screen');
                    }, 1000);
                });
                
                hostConnection.on('error', (err) => {
                    console.error('Connection to host error:', err);
                    updateConnectionStatus('disconnected', false);
                    showSystemMessage(`连接错误: ${err}`, 'guest-chat-messages');
                    
                    setTimeout(() => {
                        alert('连接错误，请检查房间ID后重试');
                        showScreen('guest-setup-screen');
                    }, 1000);
                });
            } catch (error) {
                console.error('Failed to establish connection:', error);
                showSystemMessage(`连接错误: ${error.message}`, 'guest-chat-messages');
                updateConnectionStatus('disconnected', false);
                
                setTimeout(() => {
                    alert(`连接错误: ${error.message}`);
                    showScreen('guest-setup-screen');
                }, 1000);
            }
        });
        
        peer.on('error', (err) => {
            clearTimeout(peerTimeout);
            console.error('PeerJS error:', err);
            
            // 更新服务器状态
            updateServerStatus(currentServerIndex, 'failed');
            
            // 检查是否是服务器连接错误
            if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
                // 如果还有其他服务器可尝试
                if (currentServerIndex < peerServerOptions.length - 1) {
                    showSystemMessage(`服务器连接失败，尝试下一个服务器...`, 'guest-chat-messages');
                    getNextPeerServer();
                    tryJoinRoom(roomId);
                    return;
                }
            }
            
            // 检查是否是找不到主持人错误
            if (err.type === 'peer-unavailable') {
                // 如果还有其他服务器可尝试
                if (currentServerIndex < peerServerOptions.length - 1) {
                    showSystemMessage(`在当前服务器找不到房间，尝试下一个服务器...`, 'guest-chat-messages');
                    getNextPeerServer();
                    tryJoinRoom(roomId);
                    return;
                } else {
                    resetPeerServerIndex();
                    let errorMessage = '找不到该房间，请检查房间ID是否正确';
                    showSystemMessage(errorMessage, 'guest-chat-messages');
                    updateConnectionStatus('disconnected', false);
                    
                    setTimeout(() => {
                        alert(errorMessage);
                        showScreen('guest-setup-screen');
                    }, 1000);
                    return;
                }
            }
            
            // 其他错误
            let errorMessage = `连接错误: ${err.type}`;
            showSystemMessage(errorMessage, 'guest-chat-messages');
            updateConnectionStatus('disconnected', false);
            
            setTimeout(() => {
                alert(errorMessage);
                showScreen('guest-setup-screen');
            }, 1000);
        });
        
    } catch (err) {
        console.error('Failed to join room:', err);
        showSystemMessage(`初始化错误: ${err.message}`, 'guest-chat-messages');
        alert('加入房间失败，请检查房间ID是否正确');
        showScreen('guest-setup-screen');
    }
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