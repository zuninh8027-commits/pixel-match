FROM node:20

WORKDIR /workspace

# パッケージファイルを先にコピーして依存関係をインストール
COPY package.json package-lock.json ./
RUN npm install

# 残りのコード（prismaフォルダやsrcフォルダなど）をすべてコピー
COPY . .

# コードが揃った状態でPrisma Clientのコードを生成
RUN npx prisma generate

# ポートを開放
EXPOSE 3000

# アプリを起動
CMD ["npm", "run", "start"]