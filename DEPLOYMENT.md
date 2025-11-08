# 部署指南 - 拖拉机纸牌游戏模拟器

本文档提供详细的服务器部署步骤和配置说明。

## 目录

- [环境要求](#环境要求)
- [部署方案](#部署方案)
- [手动部署](#手动部署)
- [Docker部署](#docker部署)
- [配置说明](#配置说明)
- [反向代理配置](#反向代理配置)
- [安全建议](#安全建议)
- [故障排查](#故障排查)

---

## 环境要求

### 服务器配置

- **操作系统**: Linux (Ubuntu 20.04+, CentOS 7+) 或其他支持 Node.js 的系统
- **CPU**: 1核心以上
- **内存**: 512MB 以上（推荐 1GB+）
- **硬盘**: 500MB 可用空间
- **网络**: 公网 IP 或域名

### 软件要求

- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Git**: 用于拉取代码

---

## 部署方案

### 方案一：Railway 一键部署（推荐新手）⭐

最简单快速的部署方式，适合快速上线和演示。

### 方案二：手动部署（推荐学习）

适合小规模部署，便于理解整个流程。

### 方案三：Docker部署（推荐生产）

适合生产环境，易于维护和扩展。

### 方案四：进程管理器部署（PM2）

适合需要自动重启和日志管理的场景。

---

## Railway 一键部署

Railway 是最简单的部署方式，Git push 即可自动部署，自带 HTTPS。

### 1. 准备工作

确保项目根目录有以下配置文件（已包含在项目中）：
- `package.json` - 根目录包配置
- `railway.json` - Railway 配置
- `nixpacks.toml` - 构建配置
- `Procfile` - 进程配置

### 2. 部署步骤

**方式 A: 从 GitHub 部署（推荐）**

1. 访问 [Railway.app](https://railway.app/)
2. 点击 "Start a New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权并选择你的仓库 `Tractor-dev/Tractor`
5. Railway 会自动检测并开始构建

**方式 B: 使用 Railway CLI**

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 在项目根目录初始化
railway init

# 链接到项目
railway link

# 部署
railway up
```

### 3. 配置环境变量

在 Railway 控制台设置以下环境变量：

```
PORT=5001
CLIENT_URL=https://your-app.railway.app
NODE_ENV=production
```

**注意**：
- `PORT` 会由 Railway 自动提供，通常不需要手动设置
- `CLIENT_URL` 需要设置为你的 Railway 应用 URL

### 4. 查看部署

Railway 会自动：
- ✅ 安装所有依赖
- ✅ 构建前端
- ✅ 启动后端服务
- ✅ 提供 HTTPS 域名
- ✅ 提供日志查看

访问 Railway 提供的域名即可使用应用！

### 5. 自定义域名（可选）

在 Railway 控制台：
1. 进入项目设置
2. 点击 "Settings" → "Domains"
3. 添加自定义域名
4. 配置 DNS CNAME 记录

### Railway 优势

- ✅ **零配置**：自动检测和构建
- ✅ **免费额度**：$5/月（足够小型项目）
- ✅ **自动 HTTPS**：内置 SSL 证书
- ✅ **Git 集成**：推送代码自动部署
- ✅ **实时日志**：方便调试
- ✅ **环境变量管理**：安全便捷

### Railway 故障排查

**构建失败**：
```bash
# 查看构建日志
railway logs

# 检查依赖安装
railway run npm install
```

**环境变量问题**：
确保在 Railway 控制台正确设置了 `CLIENT_URL`

**WebSocket 连接问题**：
Railway 完全支持 WebSocket，确保前端代码中的 Socket.IO 客户端连接到正确的 URL。

---

## 手动部署

### 1. 安装 Node.js

**Ubuntu/Debian:**
```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

**CentOS/RHEL:**
```bash
# 安装 Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 克隆项目

```bash
# 创建项目目录
cd /var/www  # 或你喜欢的目录
sudo mkdir -p tractor-game
sudo chown $USER:$USER tractor-game
cd tractor-game

# 克隆代码
git clone https://github.com/Tractor-dev/Tractor.git .
cd tractor-game-simulator
```

### 3. 安装依赖

**后端:**
```bash
cd server
npm install --production
```

**前端:**
```bash
cd ../client
npm install
npm run build  # 构建生产版本
```

### 4. 配置环境变量

**后端配置 (.env):**
```bash
cd ../server
cat > .env << EOF
PORT=5001
CLIENT_URL=http://your-domain.com
NODE_ENV=production
LOG_LEVEL=INFO
EOF
```

**前端配置:**

前端构建时已将后端地址硬编码，需要修改 `client/src/services/socket.js`:

```javascript
// 修改为你的服务器地址
const SOCKET_URL = process.env.VITE_SERVER_URL || 'http://your-domain.com:5001';
```

然后重新构建:
```bash
cd ../client
npm run build
```

### 5. 使用 PM2 管理进程

安装 PM2:
```bash
sudo npm install -g pm2
```

启动后端服务:
```bash
cd server
pm2 start src/index.js --name tractor-server
pm2 save  # 保存进程列表
pm2 startup  # 设置开机自启
```

### 6. 配置静态文件服务

**选项A: 使用 Nginx**

安装 Nginx:
```bash
sudo apt-get install nginx  # Ubuntu/Debian
# 或
sudo yum install nginx      # CentOS/RHEL
```

配置 Nginx (创建 `/etc/nginx/sites-available/tractor-game`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/tractor-game/tractor-game-simulator/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 和 WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 其他 API 请求
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用配置:
```bash
sudo ln -s /etc/nginx/sites-available/tractor-game /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

**选项B: 使用 Node.js serve**

```bash
sudo npm install -g serve
pm2 start "serve -s /var/www/tractor-game/tractor-game-simulator/client/dist -l 3000" --name tractor-frontend
```

### 7. 配置防火墙

```bash
# Ubuntu UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5001/tcp  # 如果不使用 Nginx 反向代理

# CentOS firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=5001/tcp
sudo firewall-cmd --reload
```

---

## Docker部署

### 1. 创建 Dockerfile

**后端 Dockerfile** (`server/Dockerfile`):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5001

CMD ["node", "src/index.js"]
```

**前端 Dockerfile** (`client/Dockerfile`):
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**前端 Nginx 配置** (`client/nginx.conf`):
```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://tractor-server:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 2. 创建 Docker Compose

创建 `docker-compose.yml`:
```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
    container_name: tractor-server
    ports:
      - "5001:5001"
    environment:
      - PORT=5001
      - CLIENT_URL=http://localhost
      - NODE_ENV=production
    restart: unless-stopped

  client:
    build:
      context: ./client
    container_name: tractor-client
    ports:
      - "80:80"
    depends_on:
      - server
    restart: unless-stopped
```

### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

---

## 配置说明

### 后端环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `PORT` | 服务器端口 | 5001 | 否 |
| `CLIENT_URL` | 前端地址（CORS） | http://localhost:3000 | 是 |
| `NODE_ENV` | 环境模式 | development | 否 |
| `LOG_LEVEL` | 日志级别 | INFO | 否 |

### 前端配置

修改 `client/src/services/socket.js`:
```javascript
const SOCKET_URL = process.env.VITE_SERVER_URL || 'https://your-domain.com';
```

或在构建时设置环境变量:
```bash
VITE_SERVER_URL=https://your-domain.com npm run build
```

---

## 反向代理配置

### Nginx 完整配置（带 SSL）

安装 Certbot（Let's Encrypt）:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

获取 SSL 证书:
```bash
sudo certbot --nginx -d your-domain.com
```

Nginx 配置会自动更新为 HTTPS。

### Caddy（自动 HTTPS）

安装 Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Caddyfile 配置:
```
your-domain.com {
    root * /var/www/tractor-game/tractor-game-simulator/client/dist
    file_server

    @websocket {
        path /socket.io/*
    }
    reverse_proxy @websocket localhost:5001

    reverse_proxy /api/* localhost:5001

    try_files {path} /index.html
}
```

启动 Caddy:
```bash
sudo systemctl restart caddy
```

---

## 安全建议

### 1. 使用 HTTPS

始终在生产环境使用 HTTPS，保护数据传输安全。

### 2. 配置 CORS

确保 `CLIENT_URL` 只包含你的域名:
```javascript
// server/src/index.js
const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true
};
```

### 3. 限制端口访问

不要直接暴露后端端口（5001）到公网，使用 Nginx 反向代理。

### 4. 定期更新

```bash
# 更新依赖
npm audit fix

# 更新 Node.js
nvm install 18  # 或使用系统包管理器
```

### 5. 设置进程限制

在 PM2 中限制资源使用:
```bash
pm2 start src/index.js --name tractor-server --max-memory-restart 500M
```

### 6. 配置日志轮转

PM2 日志管理:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 故障排查

### 1. 后端无法启动

检查日志:
```bash
pm2 logs tractor-server
# 或
journalctl -u tractor-server -f
```

常见问题:
- 端口被占用: `lsof -i :5001`
- 权限不足: 使用 `sudo` 或修改端口为 >1024
- 环境变量未设置: 检查 `.env` 文件

### 2. WebSocket 连接失败

检查:
- Nginx 配置是否包含 WebSocket 支持
- 防火墙是否允许端口
- CORS 配置是否正确

### 3. 前端无法访问

检查:
- Nginx 是否运行: `sudo systemctl status nginx`
- 文件路径是否正确
- 构建是否成功: 检查 `client/dist` 目录

### 4. 性能问题

监控:
```bash
pm2 monit  # 实时监控
pm2 status  # 查看状态
```

优化建议:
- 启用 Nginx gzip 压缩
- 使用 CDN 加速静态资源
- 增加服务器内存

---

## 快速部署脚本

创建 `deploy.sh`:
```bash
#!/bin/bash

echo "🚀 开始部署拖拉机游戏模拟器..."

# 拉取最新代码
git pull origin game-simulator

# 安装后端依赖
cd server
npm install --production
cd ..

# 构建前端
cd client
npm install
npm run build
cd ..

# 重启服务
pm2 restart tractor-server || pm2 start server/src/index.js --name tractor-server

echo "✅ 部署完成！"
```

使用:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 监控和维护

### 1. 设置健康检查

创建监控脚本:
```bash
#!/bin/bash
# healthcheck.sh

if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    echo "✅ 服务正常"
else
    echo "❌ 服务异常，尝试重启..."
    pm2 restart tractor-server
fi
```

添加到 crontab:
```bash
crontab -e
# 每5分钟检查一次
*/5 * * * * /path/to/healthcheck.sh
```

### 2. 备份数据

虽然当前版本使用内存存储，如果后续添加了持久化存储，需要定期备份。

---

## 相关链接

- [项目仓库](https://github.com/Tractor-dev/Tractor)
- [Node.js 官方文档](https://nodejs.org/docs/)
- [PM2 文档](https://pm2.keymetrics.io/docs/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Docker 文档](https://docs.docker.com/)

---

如有问题，请提交 [Issue](https://github.com/Tractor-dev/Tractor/issues)。
