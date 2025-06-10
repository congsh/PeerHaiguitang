/**
 * 参与者功能模块
 * 包含加入房间、提问和互动等功能
 */

/**
 * 加入房间
 */
function joinRoom() {
    // 获取房间ID和参与者名称
    const roomId = document.getElementById('room-id').value.trim().toUpperCase();
    userName = document.getElementById('guest-name').value.trim();
    
    // 验证输入
    if (!roomId) {
        alert('请输入房间ID');
        return;
    }
    
    if (!userName) {
        alert('请输入你的名称');
        return;
    }
    
    // 设置参与者身份
    isHost = false;
    
    // 显示加入中状态
    showScreen('guest-waiting-screen');
    document.getElementById('guest-waiting-message').textContent = `正在加入房间: ${roomId}...`;
    
    // 尝试加入房间
    tryJoinRoom(roomId);
}

/**
 * 尝试使用API加入房间
 * @param {string} roomId - 房间ID
 */
function tryJoinRoom(roomId) {
    showSystemMessage('正在连接到服务器...', 'guest-chat-messages');
    
    // 使用API客户端加入房间
    apiClient.joinRoom(roomId, userName)
        .then(room => {
            console.log('成功加入房间:', room);
            
            // 保存房间信息
            roomName = room.name;
            roomRules = room.rules;
            
            // 保存房间ID
            peerId = roomId;
            
            // 保存主持人ID
            hostId = room.host;
            
            // 设置参与者列表
            participants = {};
            room.participants.forEach(p => {
                participants[p.id] = {
                    name: p.name,
                    isHost: p.isHost,
                    raisedHand: p.raisedHand || false
                };
            });
            
            // 更新参与者列表显示
            updateParticipantsList('guest-participants-list');
            
            // 更新规则显示
            updateGuestRulesList();
            
            // 显示等待确认消息
            showSystemMessage('已连接到房间，等待主持人确认...', 'guest-chat-messages');
            
            // 更新连接状态
            updateConnectionStatus('connected', false);
            
            // 设置消息处理
            setupGuestMessageHandlers();
        })
        .catch(error => {
            console.error('加入房间失败:', error);
            showSystemMessage(`加入房间失败: ${error.message}`, 'guest-chat-messages');
            alert('加入房间失败，请检查房间ID是否正确');
            showScreen('guest-setup-screen');
        });
}

/**
 * 设置参与者消息处理函数
 */
function setupGuestMessageHandlers() {
    // 处理加入确认
    apiClient.onMessage('join-response', message => {
        console.log('收到加入确认:', message);
        
        if (message.approved) {
            // 加入成功
            showSystemMessage('主持人已确认你的加入请求', 'guest-chat-messages');
            showScreen('guest-room-screen');
            document.getElementById('guest-room-name').textContent = `房间: ${roomName}`;
        } else {
            // 被拒绝
            showSystemMessage('主持人拒绝了你的加入请求', 'guest-chat-messages');
            alert('主持人拒绝了你的加入请求');
            showScreen('guest-setup-screen');
        }
    });
    
    // 处理房间更新
    apiClient.onMessage('room-update', message => {
        console.log('收到房间更新:', message);
        
        // 更新参与者列表
        participants = message.content.participants;
        updateParticipantsList('guest-participants-list');
    });
    
    // 处理谜题
    apiClient.onMessage('puzzle', message => {
        console.log('收到谜题:', message);
        document.getElementById('guest-puzzle-display').textContent = message.content;
        showSystemMessage('主持人发布了新谜题', 'guest-chat-messages');
    });
    
    // 处理情报
    apiClient.onMessage('intel', message => {
        console.log('收到情报:', message);
        const intelDisplay = document.getElementById('guest-intel-display');
        intelDisplay.textContent = intelDisplay.textContent 
            ? intelDisplay.textContent + '\n\n' + message.content 
            : message.content;
        showSystemMessage('主持人发布了新情报', 'guest-chat-messages');
    });
    
    // 处理主持人回应
    apiClient.onMessage('host-response', message => {
        console.log('收到主持人回应:', message);
        showChatMessage('主持人', message.content, 'host', 'guest-chat-messages');
    });
    
    // 处理其他参与者的问题
    apiClient.onMessage('question-from-other', message => {
        console.log('收到其他参与者问题:', message);
        showChatMessage(message.sender, message.content, 'guest', 'guest-chat-messages');
    });
    
    // 处理游戏结束
    apiClient.onMessage('game-end', message => {
        console.log('收到游戏结束消息:', message);
        showSystemMessage('主持人结束了游戏', 'guest-chat-messages');
        gameStarted = false;
    });
    
    // 处理游戏继续
    apiClient.onMessage('game-continue', message => {
        console.log('收到游戏继续消息:', message);
        showSystemMessage('主持人继续了游戏', 'guest-chat-messages');
        gameStarted = true;
    });
    
    // 处理反应
    apiClient.onMessage('reaction', message => {
        console.log('收到反应:', message);
        showSystemMessage(`${message.sender} ${message.content === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`, 'guest-chat-messages');
    });
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