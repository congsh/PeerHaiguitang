/**
 * 消息处理模块
 * 处理各类消息的发送与接收
 */

/**
 * 处理接收到的数据
 * @param {Object} data - 接收到的数据
 * @param {DataConnection} conn - PeerJS数据连接
 */
function handleDataReceived(data, conn) {
    console.log('Received data:', data);
    
    if (isHost) {
        // 主持人处理参与者的消息
        handleGuestMessage(data, conn);
    } else {
        // 参与者处理主持人的消息
        handleHostData(data);
    }
}

/**
 * 主持人处理参与者的消息
 * @param {Object} data - 参与者发送的数据
 * @param {DataConnection} conn - 与参与者的连接
 */
function handleGuestMessage(data, conn) {
    switch (data.type) {
        case 'join-request':
            // 处理加入请求
            handleJoinRequest(data, conn);
            break;
            
        case 'question':
            // 处理参与者提问
            handleQuestion(data, conn);
            break;
            
        case 'raise-hand':
            // 处理举手
            handleRaiseHand(conn.peer);
            break;
            
        case 'lower-hand':
            // 处理放下手
            handleLowerHand(conn.peer);
            break;
            
        case 'reaction':
            // 处理反应（鲜花或垃圾）
            handleReaction(data, conn);
            break;
    }
}

/**
 * 处理参与者加入请求
 * @param {Object} data - 加入请求数据
 * @param {DataConnection} conn - 与参与者的连接
 */
function handleJoinRequest(data, conn) {
    console.log('收到加入请求:', data);
    
    // 添加到参与者列表
    participants[conn.peer] = {
        name: data.name,
        isHost: false,
        raisedHand: false
    };
    
    // 更新参与者列表显示
    updateParticipantsList();
    
    // 发送系统消息
    showSystemMessage(`${data.name} 加入了房间`);
    
    // 发送确认消息回参与者
    const confirmMessage = {
        type: 'join-confirmed',
        roomName: roomName,
        hostName: userName,
        timestamp: Date.now()
    };
    
    console.log('发送确认消息:', confirmMessage);
    conn.send(confirmMessage);
    
    // 为确保参与者收到确认，设置重试机制
    setTimeout(() => {
        // 再次发送确认，以防第一次没收到
        console.log('重新发送确认消息');
        confirmMessage.timestamp = Date.now();
        conn.send(confirmMessage);
    }, 2000);
    
    // 广播参与者列表更新
    broadcastParticipants();
    
    console.log('已处理加入请求，当前参与者:', participants);
}

/**
 * 处理参与者提问
 * @param {Object} data - 提问数据
 * @param {DataConnection} conn - 与提问者的连接
 */
function handleQuestion(data, conn) {
    const participant = participants[conn.peer];
    
    if (!participant) {
        return;
    }
    
    // 显示参与者的问题
    showChatMessage(participant.name, data.question, 'guest');
    
    // 如果参与者已举手，提问后取消举手状态
    if (participant.raisedHand) {
        participant.raisedHand = false;
        updateParticipantsList();
        broadcastParticipants();
    }
    
    // 广播该问题给其他参与者
    broadcastToAllExcept(conn.peer, {
        type: 'question-from-other',
        sender: participant.name,
        question: data.question
    });
}

/**
 * 处理参与者放下手
 * @param {string} peerId - 参与者的PeerID
 */
function handleLowerHand(peerId) {
    if (!participants[peerId]) return;
    
    participants[peerId].raisedHand = false;
    
    // 更新参与者列表
    updateParticipantsList();
    
    // 广播更新后的参与者列表
    broadcastParticipants();
}

/**
 * 处理反应（鲜花或垃圾）
 * @param {Object} data - 反应数据
 * @param {DataConnection} conn - 与反应者的连接
 */
function handleReaction(data, conn) {
    const participant = participants[conn.peer];
    
    if (!participant || roomRules.interactionMethod !== 'enabled') {
        return;
    }
    
    // 显示反应消息
    showSystemMessage(`${participant.name} ${data.reaction === '🌹' ? '送出了一朵鲜花' : '丢了一个垃圾'}`);
    
    // 广播反应给其他参与者
    broadcastToAllExcept(conn.peer, {
        type: 'reaction',
        sender: participant.name,
        reaction: data.reaction
    });
}

/**
 * 向除特定参与者外的所有人广播消息
 * @param {string} excludePeerId - 要排除的参与者ID
 * @param {Object} message - 要广播的消息对象
 */
function broadcastToAllExcept(excludePeerId, message) {
    Object.entries(connections).forEach(([pid, conn]) => {
        if (pid !== excludePeerId && conn.open) {
            conn.send(message);
        }
    });
}

/**
 * 离开房间
 */
function leaveRoom() {
    if (isHost) {
        // 主持人离开，关闭所有连接
        Object.values(connections).forEach(conn => {
            if (conn.open) {
                conn.close();
            }
        });
    } else if (hostConnection && hostConnection.open) {
        // 参与者离开，关闭与主持人的连接
        hostConnection.close();
    }
    
    // 重置状态
    resetState();
    
    // 返回欢迎界面
    showScreen('welcome-screen');
}

/**
 * 重置应用状态
 */
function resetState() {
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    peerId = null;
    connections = {};
    hostConnection = null;
    isHost = false;
    roomName = '';
    roomRules = {};
    participants = {};
    currentPuzzle = '';
    gameStarted = false;
    raisedHands = [];
    
    // 清空聊天记录
    document.getElementById('host-chat-messages').innerHTML = '';
    document.getElementById('guest-chat-messages').innerHTML = '';
    
    // 清空谜题和情报显示
    document.getElementById('puzzle-display').textContent = '';
    document.getElementById('intel-display').textContent = '';
    
    // 清空参与者列表
    document.getElementById('participants-list').innerHTML = '';
    document.getElementById('guest-participants-list').innerHTML = '';
    
    // 清空规则列表
    document.getElementById('rules-list').innerHTML = '';
    document.getElementById('guest-rules-list').innerHTML = '';
} 