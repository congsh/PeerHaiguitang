/**
 * 海龟汤互动房间应用
 * 基于PeerJS实现P2P通信
 */

// 全局变量
let peer; // PeerJS实例
let peerId; // 当前用户的PeerID
let connections = {}; // 保存所有连接 {peerId: connection}
let hostConnection; // 参与者连接到主持人的连接
let isHost = false; // 是否为主持人
let userName = ''; // 用户昵称
let roomName = ''; // 房间名称
let roomRules = {}; // 房间规则
let participants = {}; // 参与者列表 {peerId: {name, ...}}
let notes = ''; // 个人笔记
let currentPuzzle = ''; // 当前谜题
let gameStarted = false; // 游戏是否已开始
let raisedHands = []; // 举手列表

let peerServerOptions = [
    // 第一选择：使用公共服务器
    {
        host: 'peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs'
    },
    // 第二选择：备用公共服务器
    {
        host: 'peerjsbin.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs'
    },
    // 第三选择：另一个备用服务器
    {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs'
    },
    // 第四选择：使用本地PeerJS服务器（如果用户自己部署）
    {
        host: 'localhost',
        port: 9000,
        path: '/',
        secure: false,
        key: 'peerjs'
    }
];

let currentServerIndex = 0; // 当前使用的服务器索引

/**
 * 尝试下一个PeerJS服务器
 * @returns {Object} 服务器配置
 */
function getNextPeerServer() {
    currentServerIndex = (currentServerIndex + 1) % peerServerOptions.length;
    return peerServerOptions[currentServerIndex];
}

/**
 * 获取当前PeerJS服务器配置
 * @returns {Object} 服务器配置
 */
function getCurrentPeerServer() {
    return peerServerOptions[currentServerIndex];
}

/**
 * 重置服务器索引到第一个服务器
 */
function resetPeerServerIndex() {
    currentServerIndex = 0;
}

// DOM元素
document.addEventListener('DOMContentLoaded', function() {
    // 初始化服务器状态显示
    initServerStatus();
    
    // 绑定首页按钮事件
    document.getElementById('create-room-btn').addEventListener('click', createRoomAsHost);
    document.getElementById('join-room-btn').addEventListener('click', joinRoomAsGuest);
    
    // 监听输入框的Enter按键事件
    document.getElementById('host-name').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            createRoomAsHost();
        }
    });
    
    document.getElementById('guest-name').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            joinRoomAsGuest();
        }
    });
    
    document.getElementById('room-id').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            joinRoomAsGuest();
        }
    });
});

/**
 * 初始化服务器状态显示
 */
function initServerStatus() {
    const serverStatus = document.getElementById('server-status');
    
    // 清空状态区域
    serverStatus.innerHTML = '';
    
    // 创建服务器状态元素
    for (let i = 0; i < peerServerOptions.length; i++) {
        const server = peerServerOptions[i];
        const serverItem = document.createElement('div');
        serverItem.className = 'server-item';
        serverItem.setAttribute('data-server', i);
        
        const serverName = server.host + (server.port !== 443 ? `:${server.port}` : '');
        
        serverItem.innerHTML = `
            <div class="server-indicator"></div>
            <div class="server-name">${serverName}</div>
        `;
        
        serverStatus.appendChild(serverItem);
    }
    
    // 添加刷新按钮事件
    document.getElementById('refresh-servers-btn').addEventListener('click', function() {
        // 重置服务器状态
        resetServerStatus();
        // 显示提示信息
        showSystemMessage('正在重新检测服务器状态...');
        // 重新测试服务器
        testNextServer(0);
    });
    
    // 开始测试服务器
    testNextServer(0);
}

/**
 * 重置服务器状态显示
 */
function resetServerStatus() {
    const serverItems = document.querySelectorAll('.server-item .server-indicator');
    serverItems.forEach(item => {
        item.className = 'server-indicator';
    });
    
    // 移除之前的STUN测试结果
    const stunStatus = document.querySelector('.stun-status');
    if (stunStatus) stunStatus.remove();
    
    const connectionInfo = document.querySelector('.connection-info');
    if (connectionInfo) connectionInfo.remove();
    
    const optimizationTip = document.querySelector('.optimization-tip');
    if (optimizationTip) optimizationTip.remove();
}

/**
 * 更新服务器状态指示器
 * @param {number} index - 服务器索引
 * @param {string} status - 状态 (connecting/connected/failed)
 */
function updateServerStatus(index, status) {
    const serverItem = document.querySelector(`.server-item[data-server="${index}"] .server-indicator`);
    if (serverItem) {
        // 移除所有状态类
        serverItem.className = 'server-indicator';
        // 添加当前状态类
        serverItem.classList.add(status);
    }
}

/**
 * 测试STUN服务器
 */
function testStunServers() {
    // 创建服务器状态显示区域
    const serverStatus = document.getElementById('server-status');
    
    // 检查是否已存在STUN状态显示
    let stunStatusDiv = document.querySelector('.stun-status');
    if (!stunStatusDiv) {
        stunStatusDiv = document.createElement('div');
        stunStatusDiv.classList.add('stun-status');
        stunStatusDiv.innerHTML = `
            <div class="server-status-title">STUN服务器状态</div>
            <div class="stun-result">检测中，请稍候...</div>
        `;
        serverStatus.parentNode.appendChild(stunStatusDiv);
    } else {
        stunStatusDiv.querySelector('.stun-result').innerHTML = '检测中，请稍候...';
    }
    
    // 获取本地网络配置信息（如果可能）
    try {
        if (navigator.connection) {
            // 检查是否已存在连接信息显示
            let connectionInfo = document.querySelector('.connection-info');
            if (!connectionInfo) {
                connectionInfo = document.createElement('div');
                connectionInfo.classList.add('connection-info');
                connectionInfo.innerHTML = `
                    <div class="server-status-title">网络连接信息</div>
                    <div>连接类型: ${navigator.connection.type || '未知'}</div>
                    <div>网络下行速度: ${(navigator.connection.downlink || 0).toFixed(1)} Mbps</div>
                    <div>网络延迟: ${navigator.connection.rtt || '未知'} ms</div>
                `;
                serverStatus.parentNode.appendChild(connectionInfo);
            }
        }
    } catch (e) {
        console.error('获取网络信息失败:', e);
    }
    
    // 创建RTCPeerConnection来测试STUN服务器
    const stunServers = getStunServers();
    let workingStunCount = 0;
    
    // 使用一个公共的STUN服务器进行简单测试
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc.createDataChannel('test');
    
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            if (e.candidate.candidate.indexOf('srflx') !== -1) {
                workingStunCount++;
                const resultElement = stunStatusDiv.querySelector('.stun-result');
                if (resultElement) {
                    resultElement.innerHTML = `发现 ${workingStunCount} 个可用的STUN服务器`;
                }
            }
        }
    };
    
    pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
            // ICE收集完成
            const resultElement = stunStatusDiv.querySelector('.stun-result');
            if (resultElement) {
                resultElement.innerHTML = `检测完成，找到 ${workingStunCount} 个可用的STUN服务器`;
            }
            
            // 添加优化建议
            let optimizationTip = document.querySelector('.optimization-tip');
            if (!optimizationTip) {
                optimizationTip = document.createElement('div');
                optimizationTip.classList.add('optimization-tip');
                optimizationTip.innerHTML = `
                    <div class="server-status-title">连接优化建议</div>
                    <div>• 如果无法连接，尝试更换网络环境</div>
                    <div>• 确保没有防火墙阻止WebRTC连接</div>
                    <div>• 移动设备用户建议使用WiFi网络</div>
                `;
                serverStatus.parentNode.appendChild(optimizationTip);
            }
            
            pc.close();
        }
    };
    
    // 开始收集ICE候选项
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
            console.error('STUN测试失败:', err);
            const resultElement = stunStatusDiv.querySelector('.stun-result');
            if (resultElement) {
                resultElement.innerHTML = `STUN服务器测试失败: ${err.message}`;
            }
        });
}

/**
 * 更新连接状态显示
 * @param {string} status - 连接状态 (connecting/connected/disconnected)
 * @param {string} [message] - 可选的状态消息
 * @param {string} [elementId='connection-status'] - 状态元素ID
 */
function updateConnectionStatus(status, message, elementId = 'connection-status') {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) return;
    
    // 清除所有状态类
    statusElement.className = 'connection-badge';
    
    // 设置状态类和文本
    statusElement.classList.add(status);
    
    switch (status) {
        case 'connecting':
            statusElement.textContent = message || '连接中...';
            break;
        case 'connected':
            statusElement.textContent = message || '已连接';
            break;
        case 'disconnected':
            statusElement.textContent = message || '已断开';
            break;
        default:
            statusElement.textContent = message || '未知状态';
    }
}

// 页面切换函数
/**
 * 显示主持人页面
 */
function showHostPage() {
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('host-page').style.display = 'block';
    document.getElementById('guest-page').style.display = 'none';
}

/**
 * 显示参与者页面
 */
function showGuestPage() {
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('host-page').style.display = 'none';
    document.getElementById('guest-page').style.display = 'block';
}

/**
 * 显示首页
 */
function showHomePage() {
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('host-page').style.display = 'none';
    document.getElementById('guest-page').style.display = 'none';
}

/**
 * 创建或格式化聊天消息元素
 * @param {string} message - 消息内容
 * @param {string} sender - 发送者名称
 * @param {string} type - 消息类型 (host/guest/system)
 * @param {string} [containerId='chat-messages'] - 消息容器ID
 */
function addChatMessage(message, sender, type, containerId = 'chat-messages') {
    const chatMessages = document.getElementById(containerId);
    const messageElement = document.createElement('div');
    
    if (type === 'system') {
        // 系统消息
        messageElement.className = 'message message-system';
        messageElement.textContent = message;
    } else {
        // 用户消息
        messageElement.className = `message message-${type}`;
        
        // 创建消息头部（发送者和时间）
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const senderElement = document.createElement('span');
        senderElement.className = 'message-sender';
        senderElement.textContent = sender;
        
        const timeElement = document.createElement('span');
        timeElement.className = 'message-time';
        timeElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageHeader.appendChild(senderElement);
        messageHeader.appendChild(timeElement);
        
        // 创建消息内容
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        messageElement.appendChild(messageHeader);
        messageElement.appendChild(messageContent);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 系统消息显示
 * @param {string} message - 系统消息
 * @param {string} [containerId='chat-messages'] - 消息容器ID
 */
function showSystemMessage(message, containerId = 'chat-messages') {
    addChatMessage(message, 'System', 'system', containerId);
}

/**
 * 获取扩展的STUN服务器列表
 * 包含国内外可用的STUN服务器
 * @returns {Array} STUN服务器配置数组
 */
function getStunServers() {
    return [
        // 全球通用STUN服务器
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        
        // 国内可用的STUN服务器
        { urls: 'stun:stun.miwifi.com:3478' },     // 小米
        { urls: 'stun:stun.chat.bilibili.com:3478' }, // B站
        { urls: 'stun:stun.voip.eutelia.it:3478' },
        { urls: 'stun:stun.qq.com:3478' },         // 腾讯
        { urls: 'stun:stun.voxgratia.org:3478' },
        { urls: 'stun:stun.ideasip.com:3478' },
        { urls: 'stun:stun.iptel.org:3478' },
        { urls: 'stun:stun.rixtelecom.se:3478' },
        { urls: 'stun:stun.schlund.de:3478' },
        { urls: 'stun:stun.12connect.com:3478' },
        { urls: 'stun:stun.12voip.com:3478' },
        { urls: 'stun:stun.1und1.de:3478' },
        { urls: 'stun:stun.3cx.com:3478' }
    ];
}

/**
 * 初始化PeerJS
 * @returns {Promise} - 返回一个Promise，解析为peerId
 */
function initPeer() {
    return new Promise((resolve, reject) => {
        // 如果已有Peer实例，先销毁
        if (peer) {
            peer.destroy();
            peer = null;
        }
        
        // 创建一个新的Peer实例
        peer = new Peer(null, {
            debug: 2,
            // 增加多个STUN服务器以增强连接成功率
            config: {
                'iceServers': getStunServers()
            },
            // 增加连接超时设置
            pingInterval: 5000, // 5秒ping一次
            path: '/',  // 默认路径
            secure: true, // 使用安全连接
            host: 'peerjs.com', // 默认的PeerJS服务器
            port: 443 // 默认端口
        });
        
        // 设置连接超时
        const peerTimeout = setTimeout(() => {
            if (!peerId) {
                const error = new Error('PeerJS连接超时');
                console.error(error);
                reject(error);
                
                if (peer) {
                    peer.destroy();
                    peer = null;
                }
            }
        }, 15000); // 15秒超时
        
        peer.on('open', (id) => {
            clearTimeout(peerTimeout);
            console.log('My peer ID is: ' + id);
            peerId = id;
            updateConnectionStatus('connected', isHost);
            resolve(id);
        });
        
        peer.on('error', (err) => {
            clearTimeout(peerTimeout);
            console.error('PeerJS error:', err);
            updateConnectionStatus('disconnected', isHost);
            
            // 根据错误类型处理
            let errorMessage = `连接错误: ${err.type}`;
            
            switch (err.type) {
                case 'peer-unavailable':
                    errorMessage = '无法连接到指定房间，请检查房间ID是否正确';
                    break;
                case 'network':
                    errorMessage = '网络错误，请检查您的网络连接';
                    break;
                case 'server-error':
                    errorMessage = 'PeerJS服务器错误，请稍后重试';
                    break;
                case 'browser-incompatible':
                    errorMessage = '您的浏览器不支持WebRTC，请使用Chrome、Firefox或Safari最新版本';
                    break;
            }
            
            showSystemMessage(errorMessage, isHost ? 'host-chat-messages' : 'guest-chat-messages');
            reject(err);
        });
        
        peer.on('disconnected', () => {
            console.log('Peer disconnected');
            updateConnectionStatus('connecting', isHost);
            showSystemMessage('与服务器断开连接，尝试重新连接...', 
                isHost ? 'host-chat-messages' : 'guest-chat-messages');
            
            // 尝试重新连接
            setTimeout(() => {
                if (peer) {
                    peer.reconnect();
                }
            }, 3000); // 3秒后重连
            
            // 如果长时间未重连成功，提示用户
            setTimeout(() => {
                if (peer && peer.disconnected) {
                    showSystemMessage('重连失败，请刷新页面重试', 
                        isHost ? 'host-chat-messages' : 'guest-chat-messages');
                }
            }, 10000); // 10秒后检查
        });
        
        peer.on('close', () => {
            console.log('Peer connection closed');
            connections = {};
            updateConnectionStatus('disconnected', isHost);
            showSystemMessage('连接已关闭', 
                isHost ? 'host-chat-messages' : 'guest-chat-messages');
                
            // 提示用户刷新页面
            setTimeout(() => {
                if (isHost || (hostConnection && !hostConnection.open)) {
                    showSystemMessage('连接已断开，请刷新页面重新连接', 
                        isHost ? 'host-chat-messages' : 'guest-chat-messages');
                }
            }, 2000);
        });
        
        // 主持人接收连接
        peer.on('connection', handleNewConnection);
    });
}

/**
 * 处理新的连接请求
 * @param {DataConnection} conn - PeerJS数据连接
 */
function handleNewConnection(conn) {
    console.log('New connection from:', conn.peer);
    
    conn.on('open', () => {
        console.log('Connection opened with:', conn.peer);
        connections[conn.peer] = conn;
        
        // 如果是主持人，发送当前房间信息
        if (isHost) {
            const roomInfo = {
                type: 'room-info',
                roomName: roomName,
                hostName: userName,
                rules: roomRules,
                participants: participants
            };
            conn.send(roomInfo);
            
            // 通知其他参与者有新人加入
            broadcastParticipants();
            
            // 如果游戏已经开始，发送当前谜题
            if (gameStarted && currentPuzzle) {
                conn.send({
                    type: 'puzzle',
                    content: currentPuzzle
                });
            }
        }
    });
    
    conn.on('data', (data) => {
        handleDataReceived(data, conn);
    });
    
    conn.on('close', () => {
        console.log('Connection closed with:', conn.peer);
        
        // 如果是主持人，移除参与者并通知其他人
        if (isHost && connections[conn.peer]) {
            const leavingParticipant = participants[conn.peer];
            delete connections[conn.peer];
            delete participants[conn.peer];
            
            if (leavingParticipant) {
                showSystemMessage(`${leavingParticipant.name} 离开了房间`, 'host-chat-messages');
                broadcastParticipants();
            }
        }
    });
    
    conn.on('error', (err) => {
        console.error('Connection error:', err);
        showSystemMessage(`连接错误: ${err}`, 
            isHost ? 'host-chat-messages' : 'guest-chat-messages');
    });
}

/**
 * 测试服务器连接
 */
function testServerConnections() {
    resetServerStatus();
    document.getElementById('server-status').classList.add('active');
    
    // 逐个测试服务器
    testNextServer(0);
}

/**
 * 测试下一个服务器
 * @param {number} index - 服务器索引
 */
function testNextServer(index) {
    if (index >= peerServerOptions.length) {
        // 所有服务器测试完毕后，开始测试STUN服务器
        testStunServers();
        return;
    }
    
    const serverConfig = peerServerOptions[index];
    updateServerStatus(index, 'connecting');
    
    // 创建临时Peer连接测试
    const testPeer = new Peer(null, {
        host: serverConfig.host,
        port: serverConfig.port,
        path: serverConfig.path,
        secure: serverConfig.secure,
        key: serverConfig.key,
        debug: 0
    });
    
    // 设置超时
    const timeout = setTimeout(() => {
        updateServerStatus(index, 'failed');
        testPeer.destroy();
        // 测试下一个服务器
        testNextServer(index + 1);
    }, 5000);
    
    testPeer.on('open', () => {
        clearTimeout(timeout);
        updateServerStatus(index, 'connected');
        testPeer.destroy();
        // 测试下一个服务器
        testNextServer(index + 1);
    });
    
    testPeer.on('error', () => {
        clearTimeout(timeout);
        updateServerStatus(index, 'failed');
        testPeer.destroy();
        // 测试下一个服务器
        testNextServer(index + 1);
    });
}

// 应用的其他代码将在其他文件中实现 