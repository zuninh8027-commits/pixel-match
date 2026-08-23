FROM node:20

WORKDIR /workspace

# パッケージファイルを先にコピーして依存関係をインストール
COPY package.json package-lock.json ./
RUN npm install

# 残りのコードをすべてコピー
COPY . .

# TypeScriptなどをビルド（もしビルドが必要な場合）
# RUN npm run build

# ポートを開放
EXPOSE 3000

# アプリを起動
CMD ["npm", "run", "start"]