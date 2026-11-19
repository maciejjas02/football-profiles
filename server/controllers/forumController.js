import { literal } from 'sequelize';
import { Category, Post, User } from '../models/index.js';

function flattenPost(post) {
  const row = post.get({ plain: true });
  return {
    ...row,
    author_username: row.author?.username ?? null,
    category_name: row.category?.name ?? null
  };
}

const postIncludes = [
  { model: User, as: 'author', attributes: ['username'], required: false },
  { model: Category, as: 'category', attributes: ['name'], required: false }
];

export async function listPosts(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const where = { status: 'approved' };
    if (req.query.category_id) where.category_id = req.query.category_id;
    const posts = await Post.findAll({
      where,
      include: postIncludes,
      attributes: { include: [[literal("(SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = Post.id AND post_comments.status = 'approved')"), 'comment_count']] },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    res.json(posts.map(flattenPost));
  } catch (error) {
    next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await Post.findByPk(req.params.id, { include: postIncludes });
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(flattenPost(post));
  } catch (error) {
    next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    const categoryId = Number.parseInt(req.body.category_id, 10);
    if (req.user.role !== 'admin' && !await req.db.isModOfCategory(req.user.id, categoryId)) {
      return res.status(403).json({ error: 'Brak uprawnień do tworzenia postów w tej kategorii.' });
    }
    const post = await Post.create({
      title: req.body.title,
      content: req.body.content || '',
      category_id: categoryId,
      author_id: req.user.id,
      status: 'approved'
    });
    res.json({ success: true, id: post.id });
  } catch (error) {
    next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const [updated] = await Post.update({
      title: req.body.title,
      content: req.body.content,
      category_id: req.body.category_id
    }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

async function checkPostPermission(req, postId) {
  return req.user.role === 'admin' || await req.db.checkModPermission(req.user.id, req.user.role, postId);
}

export async function deletePost(req, res, next) {
  try {
    if (!await checkPostPermission(req, req.params.id)) {
      return res.status(403).json({ error: 'Brak uprawnień do tej kategorii' });
    }
    await Post.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function moderatePost(status, req, res, next) {
  try {
    if (!await checkPostPermission(req, req.params.id)) {
      return res.status(403).json({ error: 'Brak uprawnień do tej kategorii' });
    }
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    await post.update({ status });
    const message = status === 'approved'
      ? `Twój post "${post.title}" został zatwierdzony.`
      : `Twój post "${post.title}" został odrzucony.`;
    const link = status === 'approved' ? `/post.html?id=${post.id}` : '/moderator-posts.html';
    req.db.createNotification(post.author_id, status === 'approved' ? 'post_approved' : 'post_rejected', status === 'approved' ? 'Post zatwierdzony' : 'Post odrzucony', message, link);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
