import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const app = new Hono()

// GitHub OAuth設定（あなたの環境に合わせてください）
const CLIENT_ID = 'Ov23li7V8vgIgpGb5sYK'
const CLIENT_SECRET = 'd81cfc45d97fcb200d12d03d6318a87f0be70c52'

// 1. ログインページ（GitHub認証へ飛ばす）
app.get('/auth/github', (c) => {
  const redirectUri = 'http://localhost:3000/auth/github/callback'
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`
  return c.redirect(url)
})

// 2. コールバック（GitHubから戻ってくる場所）
app.get('/auth/github/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.text('認証コードがありません', 400)

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    })
    const tokenData: any = await tokenRes.json()
    const accessToken = tokenData.access_token
    if (!accessToken) return c.text('アクセストークンの取得に失敗しました', 400)

    const userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'PixelMatch' },
    })
    const userData: any = await userRes.json()
    const username = userData.login

    // Cookieにユーザー名を保存してボードへリダイレクト
    c.header('Set-Cookie', `username=${encodeURIComponent(username)}; Path=/; HttpOnly`)
    return c.redirect('/board')
  } catch (err: any) {
    return c.text(`認証エラー: ${err.message}`, 500)
  }
})

// ログアウト
app.get('/logout', (c) => {
  c.header('Set-Cookie', 'username=; Path=/; Max-Age=0')
  return c.redirect('/')
})

// トップページ（ログイン前）
app.get('/', (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (usernameMatch) {
    return c.redirect('/board')
  }

  return c.html(
    html`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>PixelMatch - ログイン</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
      <style>
        body { background-color: #111; color: #fff; font-family: 'DotGothic16', sans-serif; }
        .neon { color: #00ff00; text-shadow: 0 0 10px #00ff00; }
      </style>
    </head>
    <body class="container mt-5 text-center">
      <h1 class="neon mb-4">👾 PixelMatch 👾</h1>
      <p class="lead">PvE・PvP マルチプレイ募集ボード</p>
      <a href="/auth/github" class="btn btn-outline-light btn-lg mt-3">GitHubでログインして参加</a>
    </body>
    </html>
    `
  )
})

// メインボード（募集一覧・作成・参加）
app.get('/board', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const posts = await prisma.post.findMany({
    include: { members: true },
    orderBy: { id: 'desc' },
  })

  return c.html(
    html`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>PixelMatch - ボード</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
      <style>
        body { background-color: #111; color: #eee; font-family: 'DotGothic16', sans-serif; }
        .card { background-color: #222; border: 1px solid #444; color: #fff; }
        .neon { color: #00ff00; }
      </style>
    </head>
    <body class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="neon">👾 PixelMatch Board</h2>
        <div>
          <span>ログイン中: <strong>${username}</strong></span>
          <a href="/logout" class="btn btn-sm btn-outline-danger ms-3">ログアウト</a>
        </div>
      </div>

      <!-- 新規作成フォーム -->
      <div class="card p-4 mb-4">
        <h4>＋ 新規募集を作成</h4>
        <form action="/posts" method="POST" class="mt-2">
          <div class="mb-3">
            <label class="form-label">タイトル</label>
            <input type="text" name="title" class="form-control bg-dark text-white border-secondary" required placeholder="例: 高難易度レイドボス周回！">
          </div>
          <div class="mb-3">
            <label class="form-label">詳細コメント</label>
            <textarea name="description" class="form-control bg-dark text-white border-secondary" rows="2" placeholder="例: 初心者歓迎！Discordあり"></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">ゲームモード</label>
            <select name="gameType" class="form-select bg-dark text-white border-secondary">
              <option value="PvE">PvE (協力)</option>
              <option value="PvP">PvP (対戦)</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">最大人数</label>
            <input type="number" name="maxMembers" class="form-control bg-dark text-white border-secondary" value="4" min="2" max="8" required>
          </div>
          <button type="submit" class="btn btn-success">募集を投稿する</button>
        </form>
      </div>

      <!-- 募集一覧 -->
      <h3 class="mb-3">募集中の一覧</h3>
      ${posts.length === 0 ? '<p class="text-muted">現在、募集はありません。</p>' : ''}
      <div class="row">
        ${posts.map(post => {
          const isJoined = post.members.some(m => m.name === username)
          const isFull = post.members.length >= post.maxMembers
          const isAuthor = post.author === username

          return html`
          <div class="col-md-6 mb-3">
            <div class="card p-3 h-100">
              <div class="d-flex justify-content-between">
                <span class="badge ${post.gameType === 'PvP' ? 'bg-danger' : 'bg-primary'}">${post.gameType}</span>
                <small class="text-muted">投稿者: ${post.author}</small>
              </div>
              <h5 class="mt-2">${post.title}</h5>
              ${post.description ? html`<p class="small mb-2 text-white">${post.description}</p>` : ''}
              <p class="mb-2 text-info">メンバー: ${post.members.map(m => m.name).join(', ')} (${post.members.length}/${post.maxMembers}人)</p>
              
              <div class="mt-auto d-flex gap-2">
                ${isAuthor ? html`
                  <a href="/posts/${post.id}/edit" class="btn btn-sm btn-outline-warning">編集</a>
                  <form action="/posts/${post.id}/delete" method="POST" style="display:inline;">
                    <button type="submit" class="btn btn-sm btn-outline-danger">削除</button>
                  </form>
                ` : ''}

                ${!isJoined && !isFull ? html`
                  <form action="/posts/${post.id}/join" method="POST" style="display:inline;">
                    <button type="submit" class="btn btn-sm btn-outline-success">参加する</button>
                  </form>
                ` : isJoined ? html`
                  <form action="/posts/${post.id}/leave" method="POST" style="display:inline;">
                    <button type="submit" class="btn btn-sm btn-outline-warning">参加を取り消す</button>
                  </form>
                ` : html`
                  <span class="text-warning small align-self-center">満員です</span>
                `}
              </div>
            </div>
          </div>
          `
        })}
      </div>
    </body>
    </html>
    `
  )
})

// 募集の作成処理
app.post('/posts', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const body = await c.req.parseBody()
  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  const gameType = String(body.gameType || 'PvE')
  const maxMembers = Number(body.maxMembers) || 4

  if (title) {
    await prisma.post.create({
      data: {
        title,
        description,
        gameType,
        author: username,
        maxMembers,
        members: {
          create: { name: username }
        }
      }
    })
  }

  return c.redirect('/board')
})

// 編集画面を表示する
app.get('/posts/:id/edit', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const postId = Number(c.req.param('id'))
  const post = await prisma.post.findUnique({ where: { id: postId } })

  if (!post || post.author !== username) return c.redirect('/board')

  return c.html(
    html`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>PixelMatch - 募集を編集</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
      <style>
        body { background-color: #111; color: #eee; font-family: 'DotGothic16', sans-serif; }
        .card { background-color: #222; border: 1px solid #444; color: #fff; }
        .neon { color: #00ff00; }
      </style>
    </head>
    <body class="container mt-5" style="max-width: 600px;">
      <h2 class="neon mb-4">✏️ 募集を編集</h2>
      <div class="card p-4">
        <form action="/posts/${post.id}/edit" method="POST">
          <div class="mb-3">
            <label class="form-label">タイトル</label>
            <input type="text" name="title" class="form-control bg-dark text-white border-secondary" value="${post.title}" required>
          </div>
          <div class="mb-3">
            <label class="form-label">詳細コメント</label>
            <textarea name="description" class="form-control bg-dark text-white border-secondary" rows="3">${post.description || ''}</textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">ゲームモード</label>
            <select name="gameType" class="form-select bg-dark text-white border-secondary">
              <option value="PvE" ${post.gameType === 'PvE' ? 'selected' : ''}>PvE (協力)</option>
              <option value="PvP" ${post.gameType === 'PvP' ? 'selected' : ''}>PvP (対戦)</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">最大人数</label>
            <input type="number" name="maxMembers" class="form-control bg-dark text-white border-secondary" value="${post.maxMembers}" min="2" max="8" required>
          </div>
          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-success">更新する</button>
            <a href="/board" class="btn btn-outline-secondary">キャンセル</a>
          </div>
        </form>
      </div>
    </body>
    </html>
    `
  )
})

// 編集内容を保存する処理
app.post('/posts/:id/edit', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const postId = Number(c.req.param('id'))
  const post = await prisma.post.findUnique({ where: { id: postId } })

  if (post && post.author === username) {
    const body = await c.req.parseBody()
    const title = String(body.title || '').trim()
    const description = String(body.description || '').trim()
    const gameType = String(body.gameType || 'PvE')
    const maxMembers = Number(body.maxMembers) || 4

    if (title) {
      await prisma.post.update({
        where: { id: postId },
        data: { title, description, gameType, maxMembers }
      })
    }
  }

  return c.redirect('/board')
})

// 募集に参加する処理
app.post('/posts/:id/join', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const postId = Number(c.req.param('id'))
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { members: true }
  })

  if (post && post.members.length < post.maxMembers) {
    const alreadyJoined = post.members.some(m => m.name === username)
    if (!alreadyJoined) {
      await prisma.member.create({
        data: { name: username, postId }
      })
    }
  }

  return c.redirect('/board')
})

// 募集の参加を取り消す処理
app.post('/posts/:id/leave', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const postId = Number(c.req.param('id'))

  await prisma.member.deleteMany({
    where: {
      postId: postId,
      name: username
    }
  })

  return c.redirect('/board')
})

// 募集を削除する処理
app.post('/posts/:id/delete', async (c) => {
  const cookie = c.req.header('cookie')
  const usernameMatch = cookie?.match(/username=([^;]+)/)
  if (!usernameMatch) return c.redirect('/')
  const username = decodeURIComponent(usernameMatch[1])

  const postId = Number(c.req.param('id'))
  const post = await prisma.post.findUnique({ where: { id: postId } })

  if (post && post.author === username) {
    await prisma.post.delete({ where: { id: postId } })
  }

  return c.redirect('/board')
})

const port = 3000
serve({ fetch: app.fetch, port })
