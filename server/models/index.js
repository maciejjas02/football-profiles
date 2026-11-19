import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true },
  username: { type: DataTypes.STRING, unique: true },
  password_hash: DataTypes.STRING,
  name: DataTypes.STRING,
  avatar_url: DataTypes.STRING,
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  reputation: { type: DataTypes.INTEGER, defaultValue: 0 },
  provider: DataTypes.STRING,
  provider_id: DataTypes.STRING,
  address: DataTypes.STRING,
  city: DataTypes.STRING,
  postal_code: DataTypes.STRING,
  theme_id: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at: DataTypes.STRING,
  updated_at: DataTypes.STRING
}, { tableName: 'users', timestamps: false });

const Club = sequelize.define('Club', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: DataTypes.STRING,
  full_name: DataTypes.STRING,
  country: DataTypes.STRING,
  league: DataTypes.STRING,
  founded: DataTypes.INTEGER,
  stadium: DataTypes.STRING,
  logo_url: DataTypes.STRING,
  primary_color: DataTypes.STRING,
  secondary_color: DataTypes.STRING,
  created_at: DataTypes.STRING,
  updated_at: DataTypes.STRING
}, { tableName: 'clubs', timestamps: false });

const Player = sequelize.define('Player', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: DataTypes.STRING,
  full_name: DataTypes.STRING,
  club_id: DataTypes.STRING,
  team: DataTypes.STRING,
  position: DataTypes.STRING,
  nationality: DataTypes.STRING,
  age: DataTypes.INTEGER,
  height: DataTypes.STRING,
  weight: DataTypes.STRING,
  market_value: DataTypes.STRING,
  biography: DataTypes.TEXT,
  jersey_price: DataTypes.INTEGER,
  jersey_available: DataTypes.BOOLEAN,
  jersey_image_url: DataTypes.STRING,
  image_url: DataTypes.STRING,
  team_logo: DataTypes.STRING,
  national_flag: DataTypes.STRING,
  category: DataTypes.STRING,
  deceased: DataTypes.BOOLEAN,
  created_at: DataTypes.STRING,
  updated_at: DataTypes.STRING
}, { tableName: 'players', timestamps: false });

const PlayerStat = sequelize.define('PlayerStat', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  player_id: DataTypes.STRING,
  goals: DataTypes.INTEGER,
  assists: DataTypes.INTEGER,
  matches: DataTypes.INTEGER,
  trophies: DataTypes.INTEGER
}, { tableName: 'player_stats', timestamps: false });

const PlayerAchievement = sequelize.define('PlayerAchievement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  player_id: DataTypes.STRING,
  achievement: DataTypes.STRING,
  year: DataTypes.INTEGER,
  description: DataTypes.TEXT
}, { tableName: 'player_achievements', timestamps: false });

const Post = sequelize.define('Post', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  category_id: DataTypes.INTEGER,
  author_id: DataTypes.INTEGER,
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  created_at: DataTypes.STRING
}, { tableName: 'posts', timestamps: false });

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: DataTypes.STRING,
  slug: { type: DataTypes.STRING, unique: true },
  description: DataTypes.TEXT,
  parent_id: DataTypes.INTEGER
}, { tableName: 'categories', timestamps: false });

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  post_id: DataTypes.INTEGER,
  author_id: DataTypes.INTEGER,
  content: DataTypes.TEXT,
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  created_at: DataTypes.STRING
}, { tableName: 'post_comments', timestamps: false });

const Purchase = sequelize.define('Purchase', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: DataTypes.INTEGER,
  player_id: DataTypes.STRING,
  jersey_price: DataTypes.INTEGER,
  purchase_date: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
}, { tableName: 'purchases', timestamps: false });

const GalleryImage = sequelize.define('GalleryImage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  filename: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  width: DataTypes.INTEGER,
  height: DataTypes.INTEGER,
  created_at: DataTypes.STRING
}, { tableName: 'gallery_images', timestamps: false });

const GalleryCollection = sequelize.define('GalleryCollection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: DataTypes.STRING
}, { tableName: 'gallery_collections', timestamps: false });

const GalleryItem = sequelize.define('GalleryItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  collection_id: { type: DataTypes.INTEGER, allowNull: false },
  image_id: { type: DataTypes.INTEGER, allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false },
  created_at: DataTypes.STRING
}, { tableName: 'gallery_items', timestamps: false });

User.hasMany(Post, { foreignKey: 'author_id', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Category.hasMany(Post, { foreignKey: 'category_id', as: 'posts' });
Post.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
User.hasMany(Comment, { foreignKey: 'author_id', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Player.hasMany(Purchase, { foreignKey: 'player_id', as: 'purchases' });
Purchase.belongsTo(Player, { foreignKey: 'player_id', as: 'player' });
Club.hasMany(Player, { foreignKey: 'club_id', as: 'players' });
Player.belongsTo(Club, { foreignKey: 'club_id', as: 'club' });
Player.hasOne(PlayerStat, { foreignKey: 'player_id', as: 'stats' });
Player.hasMany(PlayerAchievement, { foreignKey: 'player_id', as: 'achievements' });
GalleryCollection.belongsToMany(GalleryImage, {
  through: GalleryItem,
  foreignKey: 'collection_id',
  otherKey: 'image_id',
  as: 'images'
});
GalleryImage.belongsToMany(GalleryCollection, {
  through: GalleryItem,
  foreignKey: 'image_id',
  otherKey: 'collection_id',
  as: 'collections'
});

export { sequelize, User, Club, Player, PlayerStat, PlayerAchievement, Post, Category, Comment, Purchase, GalleryImage, GalleryCollection, GalleryItem };
