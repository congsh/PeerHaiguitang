/**
 * 连接模块
 * 处理所有服务器连接相关功能
 */

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