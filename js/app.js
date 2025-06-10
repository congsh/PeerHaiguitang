/**
 * 海龟汤互动房间应用
 * 基于服务器API实现实时通信
 * 主应用入口文件
 */

// 全局变量
let peerId; // 当前用户的ID
let hostId; // 主持人ID
let isHost = false; // 是否为主持人
let userName = ''; // 用户昵称
let roomName = ''; // 房间名称
let roomRules = {}; // 房间规则
let participants = {}; // 参与者列表 {peerId: {name, ...}}
let notes = ''; // 个人笔记
let currentPuzzle = ''; // 当前谜题
let gameStarted = false; // 游戏是否已开始

// DOM元素初始化
document.addEventListener('DOMContentLoaded', () => {
    // 添加事件监听器
    initEventListeners();
    
    // 测试服务器连接
    setTimeout(() => {
        testServerConnections();
    }, 1000);
});

/**
 * 初始化所有事件监听器
 */
function initEventListeners() {
    // 角色选择
    document.getElementById('host-btn').addEventListener('click', () => showScreen('host-setup-screen'));
    document.getElementById('guest-btn').addEventListener('click', () => showScreen('guest-setup-screen'));
    
    // 返回按钮
    document.getElementById('back-from-host').addEventListener('click', () => showScreen('welcome-screen'));
    document.getElementById('back-from-guest').addEventListener('click', () => showScreen('welcome-screen'));
    
    // 创建房间
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    
    // 加入房间
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);
    
    // 取消加入
    document.getElementById('cancel-join-btn').addEventListener('click', () => {
        apiClient.stopPolling();
        showScreen('guest-setup-screen');
    });
    
    // 复制房间ID
    document.getElementById('copy-room-id').addEventListener('click', copyRoomId);
    
    // 主持人控制
    document.getElementById('publish-puzzle-btn').addEventListener('click', publishPuzzle);
    document.getElementById('publish-intel-btn').addEventListener('click', publishIntel);
    document.getElementById('yes-btn').addEventListener('click', () => sendHostResponse('是'));
    document.getElementById('no-btn').addEventListener('click', () => sendHostResponse('否'));
    document.getElementById('uncertain-btn').addEventListener('click', () => sendHostResponse('不确定'));
    document.getElementById('end-game-btn').addEventListener('click', endGame);
    document.getElementById('continue-game-btn').addEventListener('click', continueGame);
    document.getElementById('leave-room-btn').addEventListener('click', leaveRoom);
    
    // 参与者控制
    document.getElementById('send-question-btn').addEventListener('click', sendQuestion);
    document.getElementById('question-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendQuestion();
    });
    document.getElementById('raise-hand-btn').addEventListener('click', raiseHand);
    document.getElementById('flower-btn').addEventListener('click', () => sendReaction('🌹'));
    document.getElementById('trash-btn').addEventListener('click', () => sendReaction('🗑️'));
    document.getElementById('guest-leave-room-btn').addEventListener('click', leaveRoom);
    
    // 笔记自动保存
    document.getElementById('personal-notes').addEventListener('input', saveNotes);
}

/**
 * 广播参与者列表更新
 */
function broadcastParticipants() {
    if (!isHost) return;
    
    const participantsUpdate = {
        type: 'participants-update',
        participants: participants
    };
    
    // 向所有连接的参与者发送更新
    Object.values(connections).forEach(conn => {
        if (conn.open) {
            conn.send(participantsUpdate);
        }
    });
}

/**
 * 复制房间ID到剪贴板
 */
function copyRoomId() {
    const roomIdElement = document.getElementById('room-id-display');
    if (!roomIdElement) return;
    
    const roomId = roomIdElement.textContent;
    
    copyToClipboard(roomId)
        .then(() => {
            showSystemMessage('房间ID已复制到剪贴板');
            
            // 显示复制成功动画
            roomIdElement.classList.add('copied');
            setTimeout(() => {
                roomIdElement.classList.remove('copied');
            }, 1500);
        })
        .catch(err => {
            console.error('复制失败:', err);
            showSystemMessage('复制失败，请手动复制房间ID');
        });
}

/**
 * 处理参与者举手
 * @param {string} peerId - 参与者的PeerID
 */
function handleRaiseHand(peerId) {
    if (!participants[peerId]) return;
    
    participants[peerId].raisedHand = true;
    
    // 更新举手列表
    if (!raisedHands.includes(peerId)) {
        raisedHands.push(peerId);
    }
    
    // 更新参与者列表显示
    updateParticipantsList();
    
    // 广播更新
    broadcastParticipants();
    
    // 显示系统消息
    showSystemMessage(`${participants[peerId].name} 举手了`);
}

/**
 * 保存个人笔记
 */
function saveNotes() {
    const notesTextarea = document.getElementById('personal-notes');
    if (notesTextarea) {
        notes = notesTextarea.value;
        
        // 可以添加本地存储，确保刷新页面后不丢失
        try {
            localStorage.setItem('personal-notes', notes);
        } catch (e) {
            console.error('无法保存笔记到本地存储:', e);
        }
    }
}

/**
 * 加载个人笔记
 */
function loadNotes() {
    const notesTextarea = document.getElementById('personal-notes');
    if (notesTextarea) {
        // 尝试从本地存储加载
        try {
            const savedNotes = localStorage.getItem('personal-notes');
            if (savedNotes) {
                notes = savedNotes;
                notesTextarea.value = notes;
            }
        } catch (e) {
            console.error('无法从本地存储加载笔记:', e);
        }
    }
}

// 应用的其他代码将在其他文件中实现 