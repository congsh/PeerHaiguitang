/**
 * 房间管理函数
 * 用于创建、加入房间以及在参与者之间传递消息
 */
const { getStore } = require('@netlify/blobs');

exports.handler = async function(event, context) {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }
  
  try {
    const { action, roomId, peerId, data } = JSON.parse(event.body);
    
    // 使用Netlify Blobs存储
    const store = getStore("haitang-rooms");
    
    // 处理ping请求，用于测试连接
    if (action === 'ping') {
      return { 
        statusCode: 200, 
        headers,
        body: JSON.stringify({ success: true, message: 'API服务器连接成功' }) 
      };
    }
    
    switch (action) {
      case 'create-room':
        // 创建房间
        await store.set(`room:${roomId}`, JSON.stringify({
          host: peerId,
          name: data.roomName,
          rules: data.rules,
          participants: [{ id: peerId, name: data.hostName, isHost: true }],
          created: Date.now()
        }));
        console.log(`Created room: ${roomId}`);
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true, roomId }) 
        };
      
      case 'join-room':
        // 加入房间
        const roomData = await store.get(`room:${roomId}`);
        if (!roomData) {
          return { 
            statusCode: 404, 
            headers,
            body: JSON.stringify({ success: false, error: '找不到房间' }) 
          };
        }
        
        const room = JSON.parse(roomData);
        
        // 添加参与者
        const participant = { id: peerId, name: data.name, isHost: false };
        room.participants.push(participant);
        await store.set(`room:${roomId}`, JSON.stringify(room));
        
        // 写入消息队列通知主持人
        let hostMessagesData = await store.get(`messages:${room.host}`);
        let hostMessages = hostMessagesData ? JSON.parse(hostMessagesData) : [];
        
        hostMessages.push({
          type: 'join-request',
          from: peerId,
          name: data.name,
          timestamp: Date.now()
        });
        await store.set(`messages:${room.host}`, JSON.stringify(hostMessages));
        
        console.log(`User ${peerId} joined room ${roomId}`);
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true, room }) 
        };
      
      case 'check-messages':
        // 检查消息
        const messagesData = await store.get(`messages:${peerId}`);
        const messages = messagesData ? JSON.parse(messagesData) : [];
        // 获取后不清空，由客户端确认后清空
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true, messages }) 
        };
      
      case 'ack-messages':
        // 确认消息（清空消息队列）
        await store.set(`messages:${peerId}`, JSON.stringify([]));
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true }) 
        };
      
      case 'send-message':
        // 发送消息
        const { to, message } = data;
        const targetMessagesData = await store.get(`messages:${to}`);
        const targetMessages = targetMessagesData ? JSON.parse(targetMessagesData) : [];
        
        targetMessages.push({
          type: 'message',
          from: peerId,
          content: message,
          timestamp: Date.now()
        });
        await store.set(`messages:${to}`, JSON.stringify(targetMessages));
        
        console.log(`Message sent from ${peerId} to ${to}`);
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true }) 
        };
      
      case 'broadcast-message':
        // 广播消息到房间所有参与者
        const targetRoomData = await store.get(`room:${roomId}`);
        if (!targetRoomData) {
          return { 
            statusCode: 404, 
            headers,
            body: JSON.stringify({ success: false, error: '找不到房间' }) 
          };
        }
        
        const targetRoom = JSON.parse(targetRoomData);
        
        // 确保发送者是房间成员
        const isMember = targetRoom.participants.some(p => p.id === peerId);
        if (!isMember) {
          return { 
            statusCode: 403, 
            headers,
            body: JSON.stringify({ success: false, error: '不是房间成员' }) 
          };
        }
        
        // 向所有其他参与者发送消息
        const promises = targetRoom.participants
          .filter(p => p.id !== peerId) // 不发给自己
          .map(async p => {
            const pMessagesData = await store.get(`messages:${p.id}`);
            const pMessages = pMessagesData ? JSON.parse(pMessagesData) : [];
            
            pMessages.push({
              type: data.type || 'broadcast',
              from: peerId,
              roomId,
              content: data.content,
              timestamp: Date.now()
            });
            return store.set(`messages:${p.id}`, JSON.stringify(pMessages));
          });
        
        await Promise.all(promises);
        console.log(`Broadcast message sent to room ${roomId}`);
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true }) 
        };
      
      case 'confirm-join':
        // 主持人确认参与者加入
        const { participantId, approved } = data;
        const targetParticipantData = await store.get(`messages:${participantId}`);
        const targetParticipant = targetParticipantData ? JSON.parse(targetParticipantData) : [];
        
        targetParticipant.push({
          type: 'join-response',
          approved,
          roomId,
          from: peerId,
          timestamp: Date.now()
        });
        
        await store.set(`messages:${participantId}`, JSON.stringify(targetParticipant));
        console.log(`Join request ${approved ? 'approved' : 'rejected'}: ${participantId}`);
        return { 
          statusCode: 200, 
          headers,
          body: JSON.stringify({ success: true }) 
        };
      
      default:
        return { 
          statusCode: 400, 
          headers,
          body: JSON.stringify({ success: false, error: '无效的操作' }) 
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return { 
      statusCode: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ success: false, error: error.message }) 
    };
  }
}; 