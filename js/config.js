/**
 * 配置模块
 * 包含应用的所有配置项
 */

/**
 * PeerJS服务器选项列表
 */
const peerServerOptions = [
    // 使用0.peerjs.com作为唯一服务器选项
    {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
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
        { urls: 'stun:stun.3cx.com:3478' },
        
        // 添加公共TURN服务器，解决严格NAT环境的连接问题
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        },
        {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            credential: 'webrtc',
            username: 'webrtc'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            credential: 'openrelayproject',
            username: 'openrelayproject'
        },
        {
            urls: 'turn:relay.metered.ca:80',
            username: 'ad0e0c2c9ad4bdd82c0ee943',
            credential: 'fDi6dwXQmYMbP1OF'
        }
    ];
} 