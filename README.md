# 海龟汤互动房间

一个基于PeerJS的点对点海龟汤游戏应用，支持多人在线互动。

## 功能特点

- **角色划分**：分为主持人和参与者两种角色
- **房间创建**：主持人可创建房间并设置房间规则
- **房间规则**：
  - 汤的类型（普通汤/红汤）
  - 打分方式（主持人打分/所有人打分/不打分）
  - 回答方式（自由回答/举手回答）
  - 互动方式（允许/不允许丢鲜花和垃圾）
- **主持人功能**：
  - 出题
  - 回复"是/否/不确定"
  - 发布情报
  - 管理游戏进程
- **参与者功能**：
  - 提问
  - 举手（如果规则要求）
  - 做笔记（自动记录主持人回答"是"的问题）
  - 丢鲜花和垃圾（如果规则允许）
- **实时同步**：参与者列表和聊天记录实时同步

## 技术实现

- **HTML5 + CSS3 + JavaScript**：前端基础技术
- **PeerJS**：实现点对点通信
- **localStorage**：保存参与者笔记
- **响应式设计**：适配不同尺寸的设备

## 使用方法

1. **主持人**：
   - 点击"我是主持人"
   - 填写房间名称和昵称
   - 设置房间规则
   - 创建房间后，将生成的房间ID分享给参与者
   - 在主持人界面发布谜题，回应参与者提问

2. **参与者**：
   - 点击"我是参与者"
   - 填写房间ID和昵称
   - 加入房间后可以阅读谜题，向主持人提问
   - 在笔记区记录重要信息

## 部署方式

此应用使用纯前端技术实现，可以直接部署在任何静态网站托管服务上（如Netlify、GitHub Pages等）。

## 隐私和数据

- 所有通信直接在用户之间进行，不经过中央服务器
- 笔记保存在用户本地，不会上传到任何服务器
- 离开房间后，所有连接会被关闭，数据会被清除

## 注意事项

- 需要现代浏览器支持（Chrome、Firefox、Safari等）
- 主持人作为服务器，需要保持在线状态
- 某些网络环境（如严格的防火墙）可能会阻止P2P连接

## 部署说明

### 1. 基本部署

将所有文件上传到您的Web服务器即可。该应用是纯静态的，不需要后端支持。

### 2. 自托管PeerJS服务器（推荐）

为解决外网NAT穿透问题，强烈推荐自托管PeerJS服务器。

#### 步骤一：安装PeerJS服务器

```bash
# 安装Node.js和npm
# 然后安装PeerJS服务器
npm install -g peer

# 运行服务器（默认端口9000）
peer --port 9000
```

#### 步骤二：配置PeerJS服务器

如果您在自己的服务器上运行PeerJS，请修改`js/config.js`文件：

```javascript
const peerServerOptions = [
    {
        host: '您的服务器IP或域名',
        port: 9000, // 或其他端口
        path: '/',
        secure: false, // 如果使用HTTPS则设为true
        key: 'peerjs'
    }
];
```

#### 步骤三：配置HTTPS（可选但推荐）

为了在生产环境中使用WebRTC，建议配置HTTPS。可以使用Nginx或Caddy等工具作为反向代理，并配置SSL证书。

```
# Nginx配置示例
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        root /path/to/app;
        index index.html;
    }

    location /peerjs {
        proxy_pass http://localhost:9000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. 使用公共TURN服务器

如果您无法自托管PeerJS服务器，可以使用公共TURN服务器作为备选方案。我们已经在配置中添加了一些公共TURN服务器，但这些服务器可能不够稳定或有连接限制。

对于更可靠的生产环境，建议使用如下商业TURN服务：
- [Twilio TURN服务](https://www.twilio.com/stun-turn)
- [XirSys](https://xirsys.com/)

## 常见问题

### 外网连接问题

如果您在外网环境下遇到连接问题，可能是由以下原因导致：

1. NAT类型限制：对称型NAT（Symmetric NAT）通常难以直接建立P2P连接
2. 防火墙限制：某些企业或校园网络可能阻止WebRTC流量
3. 服务器不可用：PeerJS公共服务器可能不稳定

解决方案：

1. 使用自托管PeerJS服务器
2. 确保配置了足够的TURN服务器
3. 考虑使用VPN或其他网络环境测试 