require('dotenv').config(); // 加载 .env 文件中的环境变量

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client'); // 引入 Prisma Client
const bcrypt = require('bcrypt'); // 引入 bcrypt 库
const jwt = require('jsonwebtoken'); // 引入 jwt 库
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient(); // 创建 Prisma 实例

app.use(cors());
app.use(express.json());

// 配置存储路径和文件名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 使用时间戳命名文件
  },
});

const upload = multer({ storage });

// 验证 JWT 中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // 提取 Bearer Token

  if (!token) {
    return res.status(401).json({ error: '未提供 Token！' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效或过期的 Token！' });
    }
    req.user = user; // 将解码后的用户信息附加到请求对象
    next();
  });
};

// 测试路由
app.get('/api/test', (req, res) => {
  res.send({ message: '后端服务器运行正常！' });
});

// 注册接口
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, phone, town, village } = req.body;

  try {
    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在！' });
    }

    // 使用 bcrypt 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        phone,
        town,
        village,
      },
    });

    console.log('新用户已创建:', newUser);

    res.status(201).json({ message: '注册成功！', user: newUser });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ message: '服务器错误，请稍后再试！' });
  }
});

// 登录接口
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 查找用户
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: '用户名不存在！' });
    }

    // 使用 bcrypt 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '密码错误！' });
    }

    // 生成 JWT
    const token = jwt.sign({ userId: user.id }, 'your-secret-key', { expiresIn: '1h' });

    res.status(200).json({ message: '登录成功！', token });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '服务器错误，请稍后再试！' });
  }
});

// 获取用户信息接口
app.get('/api/user/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id); // 获取用户 ID

    // 确保用户只能访问自己的信息
    if (userId !== req.user.userId) {
      return res.status(403).json({ error: '无权访问此资源！' });
    }

    // 查询用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        address: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在！' });
    }

    // 返回用户信息
    res.status(200).json({ message: '获取用户信息成功！', user });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 更新用户信息接口
app.put('/api/user/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id); // 获取用户 ID

    // 确保用户只能更新自己的信息
    if (userId !== req.user.userId) {
      return res.status(403).json({ error: '无权访问此资源！' });
    }

    const { name, phone, address } = req.body; // 获取更新的数据

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        address,
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        address: true,
      },
    });

    // 返回更新后的用户信息
    res.status(200).json({ message: '更新用户信息成功！', user: updatedUser });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 获取所有分类
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json(categories);
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 创建分类
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.create({
      data: { name },
    });
    res.status(201).json(category);
  } catch (error) {
    console.error('创建分类失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 获取所有帖子
app.get('/api/posts', async (req, res) => {
  try {
    const { category } = req.query;
    const posts = category
      ? await prisma.post.findMany({ where: { categoryId: parseInt(category) } })
      : await prisma.post.findMany();
    res.status(200).json(posts);
  } catch (error) {
    console.error('获取帖子失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 创建帖子
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { title, description, imageUrl, categoryId } = req.body;
    const post = await prisma.post.create({
      data: {
        title,
        description,
        imageUrl,
        categoryId: parseInt(categoryId),
        authorId: req.user.userId,
      },
    });
    res.status(201).json(post);
  } catch (error) {
    console.error('创建帖子失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 更新浏览量
app.put('/api/posts/:id/views', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = await prisma.post.update({
      where: { id: postId },
      data: { views: { increment: 1 } },
    });
    res.status(200).json(post);
  } catch (error) {
    console.error('更新浏览量失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 获取某个帖子的评论
app.get('/api/comments', async (req, res) => {
  try {
    const { postId } = req.query;
    const comments = await prisma.comment.findMany({
      where: { postId: parseInt(postId) },
    });
    res.status(200).json(comments);
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 创建评论
app.post('/api/comments', authenticateToken, async (req, res) => {
  try {
    const { content, postId } = req.body;
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: parseInt(postId),
        userId: req.user.userId,
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error('创建评论失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 点赞或取消点赞
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { action } = req.body; // action: 'like' 或 'unlike'

    if (action === 'like') {
      await prisma.post.update({
        where: { id: postId },
        data: { likes: { increment: 1 } },
      });
    } else if (action === 'unlike') {
      await prisma.post.update({
        where: { id: postId },
        data: { likes: { decrement: 1 } },
      });
    }

    const updatedPost = await prisma.post.findUnique({ where: { id: postId } });
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 收藏帖子
app.post('/api/posts/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;

    await prisma.favorite.create({
      data: { postId, userId },
    });

    res.status(201).json({ message: '收藏成功！' });
  } catch (error) {
    console.error('收藏失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 取消收藏
app.delete('/api/posts/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;

    await prisma.favorite.deleteMany({
      where: { postId, userId },
    });

    res.status(200).json({ message: '已取消收藏！' });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 获取热门帖子排行榜
app.get('/api/posts/top', async (req, res) => {
  try {
    const topPosts = await prisma.post.findMany({
      orderBy: { likes: 'desc' },
      take: 10, // 返回前 10 个热门帖子
    });
    res.status(200).json(topPosts);
  } catch (error) {
    console.error('获取热门帖子失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 获取用户贡献度统计
app.get('/api/users/:id/contribution', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // 查询该用户的所有帖子
    const userPosts = await prisma.post.findMany({
      where: { authorId: userId },
    });

    // 计算总点赞数
    const totalLikes = userPosts.reduce((sum, post) => sum + post.likes, 0);

    // 返回统计数据
    res.status(200).json({
      postCount: userPosts.length, // 发帖数量
      totalLikes, // 总点赞数
    });
  } catch (error) {
    console.error('获取用户贡献度失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 图片上传接口
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传任何文件！' });
    }
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ imageUrl: fileUrl });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ error: '服务器错误，请稍后再试！' });
  }
});

// 打印环境变量（仅用于测试）
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

// 启动服务器
app.listen(PORT, () => {
  console.log(`后端服务器正在运行：http://localhost:${PORT}`);
});