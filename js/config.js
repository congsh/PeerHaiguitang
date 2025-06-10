/**
 * 配置模块
 * 包含应用的所有配置项
 */

/**
 * PeerJS服务器选项列表
 */
const peerServerOptions = [
    // 第一选择：使用peerjs.io官方公共服务器
    {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs'
    },
    // 第二选择：使用cloudflare上的PeerJS服务器
    {
        host: 'peerjs-server.herokuapp.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs'
    },
    // 第三选择：另一个备用服务器
    {
        host: 'peer-server.dev',
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