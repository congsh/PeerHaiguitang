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
        
        // 是否使用本地模式（当服务器不可用时）
        this.useLocalMock = true;
        
        // 本地存储的房间数据
        this.localRooms = {};
        
        // 本地消息队列
        this.localMessages = {};
        
        console.log('API客户端初始化，客户端ID:', this.clientId);
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