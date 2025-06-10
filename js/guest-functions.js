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
            
            if (err.type === 'peer-unavailable') {
                showSystemMessage('找不到指定的房间，请检查房间ID是否正确', 'guest-chat-messages');
                
                // 如果还有其他服务器可尝试
                if (currentServerIndex < peerServerOptions.length - 1) {
                    showSystemMessage(`尝试使用下一个服务器...`, 'guest-chat-messages');
                    getNextPeerServer();
                    tryJoinRoom(roomId);
                } else {
                    // 所有服务器都尝试失败
                    resetPeerServerIndex();
                    setTimeout(() => {
                        alert('找不到指定的房间，请检查房间ID后重试');
                        showScreen('guest-setup-screen');
                    }, 1000);
                }
                return;
            }
            
            if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
                // 如果还有其他服务器可尝试
                if (currentServerIndex < peerServerOptions.length - 1) {
                    showSystemMessage(`服务器连接失败，尝试下一个服务器...`, 'guest-chat-messages');
                    getNextPeerServer();
                    tryJoinRoom(roomId);
                } else {
                    // 所有服务器都尝试失败
                    resetPeerServerIndex();
                    showSystemMessage('连接失败，所有服务器均无法连接', 'guest-chat-messages');
                    setTimeout(() => {
                        alert('连接失败，请检查网络连接或稍后重试');
                        showScreen('guest-setup-screen');
                    }, 1000);
                }
                return;
            }
            
            // 其他错误
            showSystemMessage(`连接错误: ${err.type}`, 'guest-chat-messages');
            setTimeout(() => {
                alert(`连接错误: ${err.type}`);
                showScreen('guest-setup-screen');
            }, 1000);
        });
    } catch (error) {
        console.error('Setup error:', error);
        showSystemMessage(`设置错误: ${error.message}`, 'guest-chat-messages');
        updateConnectionStatus('disconnected', false);
        
        setTimeout(() => {
            alert(`设置错误: ${error.message}`);
            showScreen('guest-setup-screen');
        }, 1000);
    }
}

/**
 * 处理来自主持人的数据
 * @param {Object} data - 主持人发送的数据
 */
function handleHostData(data) {
    console.log('Received data from host:', data);
    
    switch (data.type) {
        case 'room-info':
            // 处理房间信息
            handleRoomInfo(data);
            break;
            
        case 'join-confirmed':
            // 处理加入确认
            showSystemMessage('主持人已确认你的加入请求', 'guest-chat-messages');
            showScreen('guest-room-screen');
            document.getElementById('guest-room-name').textContent = `房间: ${data.roomName}`;
            break;
            
        case 'participants-update':
            // 更新参与者列表
            participants = data.participants;
            updateParticipantsList('guest-participants-list');
            break;
            
        case 'puzzle':
            // 接收谜题
            document.getElementById('guest-puzzle-display').textContent = data.content;
            showSystemMessage('主持人发布了新谜题', 'guest-chat-messages');
            break;
            
        case 'intel':
            // 接收情报
            const intelDisplay = document.getElementById('guest-intel-display');
            intelDisplay.textContent = intelDisplay.textContent 
                ? intelDisplay.textContent + '\n\n' + data.content 
                : data.content;
            showSystemMessage('主持人发布了新情报', 'guest-chat-messages');
            break;
            
        case 'host-response':
            // 处理主持人回应
            handleHostResponse(data);
            break;
            
        case 'question-from-other':
            // 其他参与者的问题
            showChatMessage(data.sender, data.question, 'guest', 'guest-chat-messages');
            break;
            
        case 'game-end':
            // 游戏结束
            showSystemMessage('主持人结束了游戏', 'guest-chat-messages');
            gameStarted = false;
            break;
            
        case 'game-continue':
            // 游戏继续
            showSystemMessage('主持人继续了游戏', 'guest-chat-messages');
            gameStarted = true;
            break;
            
        case 'reaction':
            // 处理其他参与者的反应
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
    
    // 更新参与者列表
    updateParticipantsList('guest-participants-list');
    
    // 更新规则列表
    updateGuestRulesList();
    
    // 显示欢迎消息
    showSystemMessage(`欢迎加入房间 "${roomName}"`, 'guest-chat-messages');
    showSystemMessage(`主持人: ${data.hostName}`, 'guest-chat-messages');
    
    // 加载笔记
    loadNotes();
}

/**
 * 更新参与者规则列表显示
 */
function updateGuestRulesList() {
    const list = document.getElementById('guest-rules-list');
    if (!list) return;
    
    // 清空列表
    list.innerHTML = '';
    
    // 添加规则
    const rules = [
        { name: '汤类型', value: getSoupTypeName(roomRules.soupType) },
        { name: '计分方式', value: getScoringMethodName(roomRules.scoringMethod) },
        { name: '答题方式', value: getAnswerMethodName(roomRules.answerMethod) },
        { name: '互动方式', value: getInteractionMethodName(roomRules.interactionMethod) }
    ];
    
    rules.forEach(rule => {
        const item = document.createElement('div');
        item.className = 'rule-item';
        item.innerHTML = `
            <span class="rule-name">${rule.name}</span>
            <span class="rule-value">${rule.value}</span>
        `;
        list.appendChild(item);
    });
}

/**
 * 获取汤类型名称
 * @param {string} type - 汤类型代码
 * @returns {string} 汤类型名称
 */
function getSoupTypeName(type) {
    switch (type) {
        case 'classic': return '经典海龟汤';
        case 'crime': return '犯罪推理';
        case 'fantasy': return '奇幻冒险';
        case 'scifi': return '科幻故事';
        case 'horror': return '恐怖故事';
        case 'custom': return '自定义';
        default: return '未知';
    }
}

/**
 * 获取计分方式名称
 * @param {string} method - 计分方式代码
 * @returns {string} 计分方式名称
 */
function getScoringMethodName(method) {
    switch (method) {
        case 'none': return '不计分';
        case 'time': return '按时间计分';
        case 'questions': return '按问题数计分';
        case 'custom': return '自定义计分';
        default: return '未知';
    }
}

/**
 * 获取答题方式名称
 * @param {string} method - 答题方式代码
 * @returns {string} 答题方式名称
 */
function getAnswerMethodName(method) {
    switch (method) {
        case 'host': return '只有主持人可以解谜';
        case 'anyone': return '任何人都可以提交答案';
        case 'vote': return '投票决定正确答案';
        default: return '未知';
    }
}

/**
 * 获取互动方式名称
 * @param {string} method - 互动方式代码
 * @returns {string} 互动方式名称
 */
function getInteractionMethodName(method) {
    switch (method) {
        case 'enabled': return '允许举手和反应';
        case 'handsonly': return '只允许举手';
        case 'disabled': return '禁止互动';
        default: return '未知';
    }
}

/**
 * 处理主持人回应
 * @param {Object} data - 主持人回应数据
 */
function handleHostResponse(data) {
    // 显示主持人回应
    showChatMessage('主持人', data.response, 'host', 'guest-chat-messages');
}

/**
 * 发送问题
 */
function sendQuestion() {
    if (!hostConnection || !hostConnection.open) {
        alert('与主持人的连接已断开');
        return;
    }
    
    const questionInput = document.getElementById('question-input');
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('请输入问题内容');
        return;
    }
    
    // 发送问题
    hostConnection.send({
        type: 'question',
        question: question
    });
    
    // 显示自己的问题
    showChatMessage(userName, question, 'self', 'guest-chat-messages');
    
    // 清空输入框
    questionInput.value = '';
    
    // 如果有举手状态，则放下手
    if (raisedHands.includes(peerId)) {
        hostConnection.send({
            type: 'lower-hand'
        });
        
        const raiseHandBtn = document.getElementById('raise-hand-btn');
        if (raiseHandBtn) {
            raiseHandBtn.textContent = '举手';
            raiseHandBtn.classList.remove('active');
        }
    }
}

/**
 * 举手/放下手
 */
function raiseHand() {
    if (!hostConnection || !hostConnection.open) {
        alert('与主持人的连接已断开');
        return;
    }
    
    const raiseHandBtn = document.getElementById('raise-hand-btn');
    
    if (raisedHands.includes(peerId)) {
        // 放下手
        hostConnection.send({
            type: 'lower-hand'
        });
        
        if (raiseHandBtn) {
            raiseHandBtn.textContent = '举手';
            raiseHandBtn.classList.remove('active');
        }
        
        // 从举手列表中移除
        const index = raisedHands.indexOf(peerId);
        if (index > -1) {
            raisedHands.splice(index, 1);
        }
    } else {
        // 举手
        hostConnection.send({
            type: 'raise-hand'
        });
        
        if (raiseHandBtn) {
            raiseHandBtn.textContent = '放下手';
            raiseHandBtn.classList.add('active');
        }
        
        // 添加到举手列表
        raisedHands.push(peerId);
    }
}

/**
 * 发送反应（鲜花或垃圾）
 * @param {string} reaction - 反应类型
 */
function sendReaction(reaction) {
    if (!hostConnection || !hostConnection.open) {
        alert('与主持人的连接已断开');
        return;
    }
    
    // 检查是否允许互动
    if (roomRules.interactionMethod !== 'enabled') {
        alert('当前房间设置不允许发送反应');
        return;
    }
    
    // 发送反应
    hostConnection.send({
        type: 'reaction',
        reaction: reaction
    });
    
    // 显示本地反应消息
    showSystemMessage(`你${reaction === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`, 'guest-chat-messages');
} 