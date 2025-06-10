/**
 * API客户端
 * 用于与服务器端API通信
 */

/**
 * 生成唯一ID
 * @returns {string} 生成的唯一ID
 */
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * API客户端类
 */
class ApiClient {
    /**
     * 构造函数
     */
    constructor() {
        // 设置API基础URL，根据环境自动切换
        this.baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8888/api' 
            : '/api';
        
        // 生成客户端唯一ID
        this.clientId = localStorage.getItem('client_id') || generateUniqueId();
        localStorage.setItem('client_id', this.clientId);
        
        // 消息轮询间隔（毫秒）
        this.pollInterval = 2000;
        
        // 消息回调处理函数
        this.messageHandlers = {};
        
        // 轮询定时器
        this.pollTimer = null;
        
        // 默认使用本地模式，直到API可用性检测完成
        this.useLocalMock = true;
        
        // 本地存储的房间数据
        this.localRooms = {};
        
        // 本地消息队列
        this.localMessages = {};
        
        console.log('API客户端初始化，客户端ID:', this.clientId);
        
        // 检测API可用性
        this.detectApiAvailability();
    }
    
    /**
     * 检测API可用性
     */
    async detectApiAvailability() {
        try {
            console.log('正在检测API服务器可用性...');
            const response = await fetch(this.baseUrl + '/room-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'ping',
                    peerId: this.clientId
                })
            });
            
            if (response.ok) {
                console.log('API服务器可用，使用远程模式');
                this.useLocalMock = false;
                return;
            }
            
            throw new Error('API服务器响应错误');
        } catch (error) {
            console.warn('API服务器不可用，使用本地模式:', error.message);
            this.useLocalMock = true;
            
            // 显示本地模式通知
            this.showLocalModeNotification();
        }
    }
    
    /**
     * 显示本地模式通知
     */
    showLocalModeNotification() {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'local-mode-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">本地模式</div>
                <div class="notification-message">
                    API服务器不可用，已切换到本地模式。
                    <br>房间数据将保存在浏览器中，刷新页面后可能丢失。
                </div>
                <button class="notification-close">确定</button>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .local-mode-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 15px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            }
            .notification-title {
                font-weight: bold;
                margin-bottom: 8px;
            }
            .notification-message {
                font-size: 14px;
                margin-bottom: 10px;
            }
            .notification-close {
                background: white;
                color: #f44336;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                float: right;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // 点击关闭按钮移除通知
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
        
        // 10秒后自动关闭
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 10000);
    }
    
    /**
     * 发送API请求
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} - 响应数据
     */
    async sendRequest(data) {
        // 如果使用本地模式，则使用本地模拟
        if (this.useLocalMock) {
            return this.mockRequest(data);
        }
        
        try {
            const response = await fetch(this.baseUrl + '/room-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...data,
                    peerId: this.clientId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API请求错误:', error);
            
            // 如果服务器请求失败，切换到本地模式
            this.useLocalMock = true;
            console.warn('切换到本地模式');
            
            // 重试请求（使用本地模式）
            return this.mockRequest(data);
        }
    }
    
    /**
     * 本地模拟请求处理
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} - 响应数据
     */
    async mockRequest(data) {
        console.log('使用本地模式处理请求:', data);
        
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { action, roomId, peerId = this.clientId } = data;
        
        switch (action) {
            case 'ping':
                return { success: true };
                
            case 'create-room':
                // 创建房间
                const roomData = {
                    host: peerId,
                    name: data.data.roomName,
                    rules: data.data.rules,
                    participants: [{ 
                        id: peerId, 
                        name: data.data.hostName, 
                        isHost: true 
                    }],
                    created: Date.now()
                };
                
                this.localRooms[roomId] = roomData;
                return { success: true, roomId };
                
            case 'join-room':
                // 加入房间
                if (!this.localRooms[roomId]) {
                    return { 
                        success: false, 
                        error: '找不到房间' 
                    };
                }
                
                // 添加参与者
                const room = this.localRooms[roomId];
                room.participants.push({ 
                    id: peerId, 
                    name: data.data.name, 
                    isHost: false 
                });
                
                // 发送加入请求消息给主持人
                this.addLocalMessage(room.host, {
                    type: 'join-request',
                    from: peerId,
                    name: data.data.name,
                    timestamp: Date.now()
                });
                
                return { success: true, room };
                
            case 'check-messages':
                // 检查消息
                return { 
                    success: true, 
                    messages: this.localMessages[peerId] || [] 
                };
                
            case 'ack-messages':
                // 确认消息
                this.localMessages[peerId] = [];
                return { success: true };
                
            case 'confirm-join':
                // 确认加入
                const { participantId, approved } = data.data;
                
                // 发送确认消息给参与者
                this.addLocalMessage(participantId, {
                    type: 'join-response',
                    approved,
                    roomId,
                    from: peerId,
                    timestamp: Date.now()
                });
                
                return { success: true };
                
            case 'send-message':
                // 发送消息
                const { to, message } = data.data;
                
                // 添加消息到接收者的队列
                this.addLocalMessage(to, {
                    type: 'message',
                    from: peerId,
                    content: message,
                    timestamp: Date.now()
                });
                
                return { success: true };
                
            case 'broadcast-message':
                // 广播消息
                if (!this.localRooms[roomId]) {
                    return { 
                        success: false, 
                        error: '找不到房间' 
                    };
                }
                
                // 向所有参与者发送消息
                const { type, content } = data.data;
                const targetRoom = this.localRooms[roomId];
                
                targetRoom.participants.forEach(p => {
                    if (p.id !== peerId) {
                        this.addLocalMessage(p.id, {
                            type: type || 'broadcast',
                            from: peerId,
                            roomId,
                            content,
                            timestamp: Date.now()
                        });
                    }
                });
                
                return { success: true };
                
            default:
                return { 
                    success: false, 
                    error: '未知操作' 
                };
        }
    }
    
    /**
     * 添加本地消息
     * @param {string} to - 接收者ID
     * @param {Object} message - 消息对象
     */
    addLocalMessage(to, message) {
        if (!this.localMessages[to]) {
            this.localMessages[to] = [];
        }
        this.localMessages[to].push(message);
    }
    
    /**
     * 创建房间
     * @param {string} roomName - 房间名称
     * @param {Object} rules - 房间规则
     * @param {string} hostName - 主持人名称
     * @returns {Promise<string>} - 创建的房间ID
     */
    async createRoom(roomName, rules, hostName) {
        // 生成房间ID
        const roomId = generateUniqueId().substring(0, 8).toUpperCase();
        
        const result = await this.sendRequest({
            action: 'create-room',
            roomId,
            data: {
                roomName,
                rules,
                hostName
            }
        });
        
        if (result.success) {
            // 开始轮询消息
            this.startPolling();
            return roomId;
        } else {
            throw new Error(result.error || '创建房间失败');
        }
    }
    
    /**
     * 加入房间
     * @param {string} roomId - 房间ID
     * @param {string} name - 参与者名称
     * @returns {Promise<Object>} - 房间信息
     */
    async joinRoom(roomId, name) {
        const result = await this.sendRequest({
            action: 'join-room',
            roomId,
            data: {
                name
            }
        });
        
        if (result.success) {
            // 开始轮询消息
            this.startPolling();
            return result.room;
        } else {
            throw new Error(result.error || '加入房间失败');
        }
    }
    
    /**
     * 确认参与者加入请求
     * @param {string} participantId - 参与者ID
     * @param {boolean} approved - 是否批准
     * @param {string} roomId - 房间ID
     * @returns {Promise<boolean>} - 操作是否成功
     */
    async confirmJoin(participantId, approved, roomId) {
        const result = await this.sendRequest({
            action: 'confirm-join',
            roomId,
            data: {
                participantId,
                approved
            }
        });
        
        return result.success;
    }
    
    /**
     * 发送消息
     * @param {string} to - 接收者ID
     * @param {*} message - 消息内容
     * @returns {Promise<boolean>} - 操作是否成功
     */
    async sendMessage(to, message) {
        const result = await this.sendRequest({
            action: 'send-message',
            data: {
                to,
                message
            }
        });
        
        return result.success;
    }
    
    /**
     * 广播消息到房间
     * @param {string} roomId - 房间ID
     * @param {string} type - 消息类型
     * @param {*} content - 消息内容
     * @returns {Promise<boolean>} - 操作是否成功
     */
    async broadcastMessage(roomId, type, content) {
        const result = await this.sendRequest({
            action: 'broadcast-message',
            roomId,
            data: {
                type,
                content
            }
        });
        
        return result.success;
    }
    
    /**
     * 开始轮询消息
     */
    startPolling() {
        if (this.pollTimer) return; // 已经在轮询中
        
        const pollMessages = async () => {
            try {
                const result = await this.sendRequest({
                    action: 'check-messages'
                });
                
                if (result.success && result.messages && result.messages.length > 0) {
                    console.log('收到消息:', result.messages);
                    
                    // 处理消息
                    this.handleMessages(result.messages);
                    
                    // 确认消息已处理
                    await this.sendRequest({
                        action: 'ack-messages'
                    });
                }
            } catch (error) {
                console.error('轮询消息错误:', error);
            }
            
            // 继续轮询
            this.pollTimer = setTimeout(pollMessages, this.pollInterval);
        };
        
        // 开始第一次轮询
        pollMessages();
    }
    
    /**
     * 停止轮询消息
     */
    stopPolling() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }
    
    /**
     * 处理收到的消息
     * @param {Array} messages - 消息列表
     */
    handleMessages(messages) {
        messages.forEach(message => {
            const handler = this.messageHandlers[message.type];
            if (handler) {
                handler(message);
            } else {
                console.warn('未处理的消息类型:', message.type, message);
            }
        });
    }
    
    /**
     * 注册消息处理函数
     * @param {string} messageType - 消息类型
     * @param {Function} handler - 处理函数
     */
    onMessage(messageType, handler) {
        this.messageHandlers[messageType] = handler;
    }
}

// 创建API客户端实例
const apiClient = new ApiClient();

// 导出实例
window.apiClient = apiClient; 