/**
 * 连接模块
 * 处理所有P2P连接相关功能
 */

// 服务器相关变量
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
        
        // 获取当前服务器配置
        const serverConfig = getCurrentPeerServer();
        console.log('使用服务器配置:', serverConfig);
        
        // 创建一个新的Peer实例
        peer = new Peer(null, {
            debug: 3, // 提高调试级别
            // 增加多个STUN服务器以增强连接成功率
            config: {
                'iceServers': getStunServers()
            },
            // 增加连接超时设置
            pingInterval: 5000, // 5秒ping一次
            host: serverConfig.host,
            port: serverConfig.port,
            path: serverConfig.path,
            secure: serverConfig.secure,
            key: serverConfig.key
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
    console.log('New connection from peer:', conn.peer);
    console.log('Connection metadata:', conn.metadata);
    
    // 添加超时检测
    const openTimeout = setTimeout(() => {
        console.warn('连接打开超时:', conn.peer);
        if (!connections[conn.peer]) {
            console.warn('连接可能已断开或未正确建立');
        }
    }, 5000);
    
    conn.on('open', () => {
        clearTimeout(openTimeout);
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
            console.log('发送房间信息给新连接:', roomInfo);
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
        console.log('收到数据:', data, '来自:', conn.peer);
        handleDataReceived(data, conn);
    });
    
    conn.on('error', (err) => {
        console.error('连接错误:', err, '来自:', conn.peer);
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
}

/**
 * 测试服务器连接
 */
function testServerConnections() {
    const serverStatus = document.getElementById('server-status');
    if (!serverStatus) return;
    
    // 显示状态面板
    serverStatus.classList.add('active');
    
    // 更新服务器状态
    const serverItem = document.querySelector('.server-item');
    if (serverItem) {
        const indicator = serverItem.querySelector('.server-indicator');
        if (indicator) {
            // 先显示为连接中
            indicator.textContent = '测试中...';
            indicator.className = 'server-indicator server-connecting';
            
            // 测试API服务器连接
            fetch('/api/room-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'ping',
                    peerId: apiClient.clientId
                })
            })
            .then(response => {
                if (response.ok) {
                    // 连接成功
                    indicator.textContent = '可用';
                    indicator.className = 'server-indicator server-connected';
                    return;
                }
                throw new Error('服务器响应错误');
            })
            .catch(error => {
                console.error('测试服务器连接失败:', error);
                // 连接失败
                indicator.textContent = '不可用';
                indicator.className = 'server-indicator server-failed';
                
                // 在状态面板中显示错误信息
                const errorDiv = document.createElement('div');
                errorDiv.className = 'server-error';
                errorDiv.innerHTML = `
                    <div class="server-status-title">服务器不可用</div>
                    <div>API服务器连接失败，将使用本地模式。某些功能可能不可用。</div>
                    <div class="error-details">错误信息: ${error.message}</div>
                `;
                serverStatus.appendChild(errorDiv);
                
                // 切换到本地模式
                apiClient.useLocalMock = true;
            });
        }
    }
    
    // 添加网络信息
    try {
        if (navigator.connection) {
            const connectionInfo = document.createElement('div');
            connectionInfo.classList.add('connection-info');
            connectionInfo.innerHTML = `
                <div class="server-status-title">网络连接信息</div>
                <div>连接类型: ${navigator.connection.type || '未知'}</div>
                <div>网络下行速度: ${(navigator.connection.downlink || 0).toFixed(1)} Mbps</div>
                <div>网络延迟: ${navigator.connection.rtt || '未知'} ms</div>
            `;
            serverStatus.appendChild(connectionInfo);
        }
    } catch (e) {
        console.error('获取网络信息失败:', e);
    }
}

/**
 * 更新服务器状态显示
 * @param {number} index - 服务器索引
 * @param {string} status - 状态: 'connecting', 'connected', 'failed'
 */
function updateServerStatus(index, status) {
    const serverItem = document.querySelector(`.server-item[data-server="${index}"]`);
    if (!serverItem) return;
    
    const indicator = serverItem.querySelector('.server-indicator');
    if (!indicator) return;
    
    // 移除所有状态类
    indicator.classList.remove('server-connecting', 'server-connected', 'server-failed');
    
    // 添加新的状态类
    indicator.classList.add(`server-${status}`);
    
    // 更新文本
    switch (status) {
        case 'connecting':
            indicator.textContent = '连接中...';
            break;
        case 'connected':
            indicator.textContent = '已连接';
            break;
        case 'failed':
            indicator.textContent = '连接失败';
            break;
        default:
            indicator.textContent = '未知状态';
    }
}

/**
 * 更新连接状态显示
 * @param {string} status - 状态: 'connecting', 'connected', 'disconnected'
 * @param {boolean} isHost - 是否为主持人
 */
function updateConnectionStatus(status, isHost) {
    const statusIndicator = document.querySelector(
        isHost ? '.host-connection-status .status-indicator' : '.guest-connection-status .status-indicator'
    );
    
    if (!statusIndicator) return;
    
    // 移除所有状态类
    statusIndicator.classList.remove('status-connecting', 'status-connected', 'status-disconnected');
    
    // 添加新的状态类
    statusIndicator.classList.add(`status-${status}`);
    
    // 更新文本
    switch (status) {
        case 'connecting':
            statusIndicator.textContent = '连接中...';
            break;
        case 'connected':
            statusIndicator.textContent = '已连接';
            break;
        case 'disconnected':
            statusIndicator.textContent = '未连接';
            break;
        default:
            statusIndicator.textContent = '未知状态';
    }
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

/**
 * 测试STUN服务器
 */
function testStunServers() {
    // 创建服务器状态显示区域
    const serverStatus = document.getElementById('server-status');
    const stunStatusDiv = document.createElement('div');
    stunStatusDiv.classList.add('stun-status');
    stunStatusDiv.innerHTML = `
        <div class="server-status-title">STUN服务器状态检测中...</div>
        <div class="stun-result">测试中，请稍候...</div>
    `;
    serverStatus.appendChild(stunStatusDiv);
    
    // 获取本地网络配置信息（如果可能）
    try {
        if (navigator.connection) {
            const connectionInfo = document.createElement('div');
            connectionInfo.classList.add('connection-info');
            connectionInfo.innerHTML = `
                <div class="server-status-title">网络连接信息</div>
                <div>连接类型: ${navigator.connection.type || '未知'}</div>
                <div>网络下行速度: ${(navigator.connection.downlink || 0).toFixed(1)} Mbps</div>
                <div>网络延迟: ${navigator.connection.rtt || '未知'} ms</div>
            `;
            serverStatus.appendChild(connectionInfo);
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
                stunStatusDiv.querySelector('.stun-result').innerHTML = 
                    `发现 ${workingStunCount} 个可用的STUN服务器`;
            }
        }
    };
    
    pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
            // ICE收集完成
            stunStatusDiv.querySelector('.stun-result').innerHTML = 
                `检测完成，找到 ${workingStunCount} 个可用的STUN服务器`;
            
            // 添加优化建议
            const optimizationTip = document.createElement('div');
            optimizationTip.classList.add('optimization-tip');
            optimizationTip.innerHTML = `
                <div class="server-status-title">连接优化建议</div>
                <div>• 如果无法连接，尝试更换网络环境</div>
                <div>• 确保没有防火墙阻止WebRTC连接</div>
                <div>• 移动设备用户建议使用WiFi网络</div>
            `;
            serverStatus.appendChild(optimizationTip);
            
            pc.close();
        }
    };
    
    // 开始收集ICE候选项
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
            console.error('STUN测试失败:', err);
            stunStatusDiv.querySelector('.stun-result').innerHTML = 
                `STUN服务器测试失败: ${err.message}`;
        });
} 