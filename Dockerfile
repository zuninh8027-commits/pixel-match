FROM node:20

WORKDIR /workspace

# パッケージファイルを先にコピーして依存関係をインストール
COPY package.json package-lock.json ./
RUN npm install

# Prisma Clientのコードを生成
RUN npx prisma generate

# 残りのコードをすべてコピー
COPY . .

# ポートを開放
EXPOSE 3000

# アプリを起動
CMD ["npm", "run", "start"]