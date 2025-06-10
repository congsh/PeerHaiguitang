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
 * 创建房间
 */
function createRoom() {
    // 获取房间名称和主持人名称
    roomName = document.getElementById('room-name').value.trim();
    userName = document.getElementById('host-name').value.trim();
    
    // 验证输入
    if (!roomName) {
        alert('请输入房间名称');
        return;
    }
    
    if (!userName) {
        alert('请输入你的名称');
        return;
    }
    
    // 获取房间规则
    roomRules = {
        soupType: document.getElementById('soup-type').value,
        scoringMethod: document.getElementById('scoring-method').value,
        answerMethod: document.getElementById('answer-method').value,
        interactionMethod: document.getElementById('interaction-method').value
    };
    
    // 设置主持人身份
    isHost = true;
    
    // 显示创建中状态
    showScreen('host-room-screen');
    document.getElementById('host-room-name').textContent = `房间: ${roomName} (创建中...)`;
    showSystemMessage('正在创建房间，请稍候...');
    
    // 创建房间
    tryCreateRoom();
}

/**
 * 尝试使用API创建房间
 */
function tryCreateRoom() {
    showSystemMessage('正在连接到服务器...');
    
    // 使用API客户端创建房间
    apiClient.createRoom(roomName, roomRules, userName)
        .then(roomId => {
            console.log('房间创建成功:', roomId);
            peerId = roomId;
            
            // 设置房间ID显示
            const roomIdDisplay = document.getElementById('room-id-display');
            roomIdDisplay.textContent = roomId;
            
            // 自动复制ID到剪贴板
            try {
                navigator.clipboard.writeText(roomId).then(() => {
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
            participants[apiClient.clientId] = {
                name: userName,
                isHost: true
            };
            
            // 更新参与者列表显示
            updateParticipantsList();
            
            // 更新规则显示
            updateRulesList();
            
            // 显示欢迎消息
            showSystemMessage(`房间 "${roomName}" 已创建，等待参与者加入...`);
            showSystemMessage(`请将房间ID: ${roomId} 分享给参与者`);
            
            // 更新连接状态
            updateConnectionStatus('connected', true);
            
            // 设置消息处理
            setupMessageHandlers();
        })
        .catch(error => {
            console.error('创建房间失败:', error);
            showSystemMessage(`创建房间失败: ${error.message}`);
            alert('创建房间失败，请检查网络连接或稍后重试');
            showScreen('host-setup-screen');
        });
}

/**
 * 设置消息处理函数
 */
function setupMessageHandlers() {
    // 处理加入请求
    apiClient.onMessage('join-request', message => {
        console.log('收到加入请求:', message);
        
        // 添加到参与者列表
        participants[message.from] = {
            name: message.name,
            isHost: false,
            raisedHand: false
        };
        
        // 更新参与者列表显示
        updateParticipantsList();
        
        // 发送系统消息
        showSystemMessage(`${message.name} 加入了房间`);
        
        // 确认参与者加入
        apiClient.confirmJoin(message.from, true, peerId)
            .then(() => {
                console.log('已确认参与者加入:', message.from);
            })
            .catch(error => {
                console.error('确认参与者加入失败:', error);
            });
    });
    
    // 处理消息
    apiClient.onMessage('message', message => {
        const participant = participants[message.from];
        if (participant) {
            showChatMessage(participant.name, message.content, 'guest');
        }
    });
    
    // 处理举手
    apiClient.onMessage('raise-hand', message => {
        const participant = participants[message.from];
        if (participant) {
            participant.raisedHand = true;
            updateParticipantsList();
            showSystemMessage(`${participant.name} 举手了`);
        }
    });
    
    // 处理放下手
    apiClient.onMessage('lower-hand', message => {
        const participant = participants[message.from];
        if (participant) {
            participant.raisedHand = false;
            updateParticipantsList();
        }
    });
    
    // 处理反应
    apiClient.onMessage('reaction', message => {
        const participant = participants[message.from];
        if (participant) {
            showSystemMessage(`${participant.name} ${message.content === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`);
        }
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
    const list = document.getElementById('rules-list');
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
 * 向所有连接的参与者广播消息
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
    
    // 设置当前谜题
    currentPuzzle = puzzleText;
    
    // 更新谜题显示
    document.getElementById('puzzle-display').textContent = puzzleText;
    
    // 清空谜题输入框
    document.getElementById('puzzle-input').value = '';
    
    // 显示系统消息
    showSystemMessage('已发布新谜题');
    
    // 广播谜题到所有参与者
    broadcastToAll({
        type: 'puzzle',
        content: puzzleText
    });
    
    // 标记游戏已开始
    gameStarted = true;
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
    
    // 更新情报显示
    const intelDisplay = document.getElementById('intel-display');
    intelDisplay.textContent = intelDisplay.textContent 
        ? intelDisplay.textContent + '\n\n' + intelText 
        : intelText;
    
    // 清空情报输入框
    document.getElementById('intel-input').value = '';
    
    // 显示系统消息
    showSystemMessage('已发布新情报');
    
    // 广播情报到所有参与者
    broadcastToAll({
        type: 'intel',
        content: intelText
    });
}

/**
 * 发送主持人回应
 * @param {string} response - 回应内容
 */
function sendHostResponse(response) {
    showChatMessage(userName, response, 'host');
    
    // 广播回应到所有参与者
    broadcastToAll({
        type: 'host-response',
        response: response
    });
}

/**
 * 结束游戏
 */
function endGame() {
    if (!gameStarted) {
        alert('游戏尚未开始');
        return;
    }
    
    // 确认是否结束游戏
    if (!confirm('确定要结束游戏吗？')) {
        return;
    }
    
    // 显示系统消息
    showSystemMessage('游戏已结束');
    
    // 广播游戏结束消息
    broadcastToAll({
        type: 'game-end'
    });
    
    // 更新游戏状态
    gameStarted = false;
}

/**
 * 继续游戏
 */
function continueGame() {
    if (gameStarted) {
        alert('游戏已经在进行中');
        return;
    }
    
    // 检查是否有谜题
    if (!currentPuzzle) {
        alert('请先发布谜题');
        return;
    }
    
    // 显示系统消息
    showSystemMessage('游戏继续');
    
    // 广播游戏继续消息
    broadcastToAll({
        type: 'game-continue'
    });
    
    // 更新游戏状态
    gameStarted = true;
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