/**
 * UI工具模块
 * 包含所有界面相关的工具函数
 */

/**
 * 显示指定的屏幕，隐藏其他屏幕
 * @param {string} screenId - 要显示的屏幕ID
 */
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

/**
 * 显示系统消息
 * @param {string} message - 消息内容
 * @param {string} chatId - 聊天区域ID
 */
function showSystemMessage(message, chatId = 'host-chat-messages') {
    const chatMessages = document.getElementById(chatId);
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = message;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(content);
    messageDiv.appendChild(timestamp);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 显示聊天消息
 * @param {string} sender - 发送者昵称
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (host/guest)
 * @param {string} chatId - 聊天区域ID
 */
function showChatMessage(sender, message, type, chatId = 'host-chat-messages') {
    const chatMessages = document.getElementById(chatId);
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = sender;
    
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = message;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(content);
    messageDiv.appendChild(timestamp);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 更新连接状态显示
 * @param {string} status - 连接状态 ('connected', 'disconnected', 'connecting')
 * @param {boolean} isHostStatus - 是否为主持人状态
 */
function updateConnectionStatus(status, isHostStatus = true) {
    const statusElement = document.querySelector(
        isHostStatus ? '#host-connection-status .status-indicator' : '#guest-connection-status .status-indicator'
    );
    
    if (!statusElement) return;
    
    // 移除所有状态类
    statusElement.classList.remove('status-connected', 'status-disconnected', 'status-connecting');
    
    // 设置状态文本和类
    switch (status) {
        case 'connected':
            statusElement.textContent = '已连接';
            statusElement.classList.add('status-connected');
            break;
        case 'disconnected':
            statusElement.textContent = '已断开';
            statusElement.classList.add('status-disconnected');
            break;
        case 'connecting':
            statusElement.textContent = '连接中';
            statusElement.classList.add('status-connecting');
            break;
        default:
            statusElement.textContent = status;
    }
}

/**
 * 更新服务器状态指示器
 * @param {number} serverIndex - 服务器索引
 * @param {string} status - 状态 ('connecting', 'connected', 'failed')
 */
function updateServerStatus(serverIndex, status) {
    const serverItem = document.querySelector(`.server-item[data-server="${serverIndex}"]`);
    if (!serverItem) return;
    
    const indicator = serverItem.querySelector('.server-indicator');
    if (!indicator) return;
    
    // 移除所有状态类
    indicator.classList.remove('connecting', 'connected', 'failed');
    
    // 设置状态类
    indicator.classList.add(status);
    
    // 根据状态设置文本
    switch (status) {
        case 'connecting':
            indicator.textContent = '连接中';
            break;
        case 'connected':
            indicator.textContent = '已连接';
            break;
        case 'failed':
            indicator.textContent = '连接失败';
            break;
        default:
            indicator.textContent = '待检测';
    }
    
    // 显示服务器状态面板
    document.getElementById('server-status').classList.add('active');
}

/**
 * 重置所有服务器状态指示器
 */
function resetServerStatus() {
    for (let i = 0; i < peerServerOptions.length; i++) {
        const serverItem = document.querySelector(`.server-item[data-server="${i}"]`);
        if (!serverItem) continue;
        
        const indicator = serverItem.querySelector('.server-indicator');
        if (!indicator) continue;
        
        indicator.classList.remove('connecting', 'connected', 'failed');
        indicator.textContent = '待检测';
    }
}

/**
 * 生成房间ID（4-10位随机字母数字组合）
 * @returns {string} 生成的房间ID
 */
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let result = '';
    // 生成4-10位的ID
    const length = Math.floor(Math.random() * 7) + 4;
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise} 返回一个Promise，解析为成功或失败
 */
function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => resolve(true))
                .catch(err => {
                    console.error('无法复制到剪贴板:', err);
                    reject(err);
                });
        } else {
            // 备用方法（对于不支持Clipboard API的浏览器）
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // 使文本区域不可见
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve(true);
                } else {
                    reject(new Error('复制命令执行失败'));
                }
            } catch (err) {
                document.body.removeChild(textArea);
                console.error('无法复制到剪贴板:', err);
                reject(err);
            }
        }
    });
}

/**
 * 更新参与者列表显示
 * @param {string} targetListId - 目标列表ID
 */
function updateParticipantsList(targetListId = 'participants-list') {
    const list = document.getElementById(targetListId);
    if (!list) return;
    
    // 清空列表
    list.innerHTML = '';
    
    // 添加主持人（如果是主持人视图）
    if (targetListId === 'participants-list' && isHost) {
        const hostItem = document.createElement('div');
        hostItem.className = 'participant host';
        hostItem.innerHTML = `
            <span class="name">${userName}</span>
            <span class="badge host-badge">主持人</span>
        `;
        list.appendChild(hostItem);
    }
    
    // 添加参与者
    Object.entries(participants).forEach(([pid, participant]) => {
        const item = document.createElement('div');
        item.className = 'participant';
        
        let badges = '';
        
        // 添加举手标记
        if (participant.raisedHand) {
            badges += '<span class="badge hand-badge">✋</span>';
        }
        
        // 为参与者列表项添加额外信息
        item.innerHTML = `
            <span class="name">${participant.name}</span>
            ${badges}
        `;
        
        list.appendChild(item);
    });
} 