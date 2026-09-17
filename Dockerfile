# 微信云托管用的镜像。
#
# ## 为什么是手写 Dockerfile 而不是平台的"Node 语言包"
#
# 云托管的自动构建要读 package.json 里的 dependencies，而这个项目**零依赖**
# （连 express 都没有，服务端是 Node 内置 http 手写的）。用平台语言包会走
# `npm install` + 启动命令推断，反而多一层不确定。手写一个 20 行的镜像最直接。
#
# ## 三件事必须对上，否则容器起来了但请求到不了
#
#   1. **监听的端口**要和云托管「新建版本」里配置的**容器端口**一致（默认 80）。
#      平台会把端口塞进 PORT 环境变量，代码里是 `num('PORT', 8787)`。
#   2. **监听地址必须是 0.0.0.0**（只绑 127.0.0.1 平台探不到）。
#   3. **健康检查**：平台默认探 `/`，而我们的路由表里没有 `/`（会 404）。
#      所以**要在控制台把健康检查路径改成 `/api/health`** —— 那个接口就是干这个的。
#
# ## 数据库驱动
#
# 本地开发不需要 mysql2（不配 DB_HOST 就完全不加载它，见 server/store-mysql.js）。
# 云托管上要连 MySQL，所以**在镜像里单独装**，而不是写进 package.json 的 dependencies
# —— 这样仓库保持零依赖，本地 `npm start` 不用先 install。

FROM node:20-alpine

# tzdata：容器的时区。配额按"自然日"算，时区错了会跨天错位（云托管默认 UTC）
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

WORKDIR /app

# 先只装依赖，利用镜像层缓存：改代码不会重新装一遍
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund mysql2@^3.11.0

# 服务端代码 + 它依赖的共享模块
# （server 会 require ../core 与 ../data 在本地复算命盘、../config 读玩法旋钮；
#  跑在客户端的那一侧——src/ miniprogram/ services/ utils/——不进镜像）
COPY server ./server
COPY core ./core
COPY data ./data
COPY config ./config

# 云托管需要容器监听 80（控制台里可改，改了这里也要改）
ENV PORT=80
EXPOSE 80

# 用非 root 跑：镜像里默认的 node 用户已经存在
USER node

# 不用 npm start（那条命令带 --env-file=server/.env，云托管上环境变量由控制台注入）
CMD ["node", "server/index.js"]
