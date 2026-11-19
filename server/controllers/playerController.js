import { Player, PlayerAchievement, PlayerStat } from '../models/index.js';

function serializePlayer(player, includeAchievements = false) {
  const data = player.get({ plain: true });
  const stats = data.stats ?? {};
  const result = {
    ...data,
    imageUrl: data.image_url,
    jerseyImageUrl: data.jersey_image_url,
    marketValue: data.market_value,
    jerseyPrice: data.jersey_price,
    jerseyAvailable: data.jersey_available,
    fullName: data.full_name,
    teamLogo: data.team_logo,
    nationalFlag: data.national_flag,
    goals: stats.goals || 0,
    assists: stats.assists || 0,
    matches: stats.matches || 0,
    trophies: stats.trophies || 0,
    stats: {
      goals: stats.goals || 0,
      assists: stats.assists || 0,
      matches: stats.matches || 0,
      trophies: stats.trophies || 0
    }
  };

  if (includeAchievements) {
    result.achievements = (data.achievements ?? []).map(({ achievement }) => achievement);
  }

  return result;
}

export async function getPlayer(req, res, next) {
  try {
    const player = await Player.findByPk(req.params.id, {
      include: [
        { model: PlayerStat, as: 'stats', required: false },
        { model: PlayerAchievement, as: 'achievements', required: false }
      ]
    });
    if (!player) return res.status(404).send();
    res.json(serializePlayer(player, true));
  } catch (error) {
    next(error);
  }
}

export async function getPlayersByCategory(req, res, next) {
  try {
    const players = await Player.findAll({
      where: { category: req.params.cat },
      include: [{ model: PlayerStat, as: 'stats', required: false }]
    });
    res.json(players.map(player => serializePlayer(player)));
  } catch (error) {
    next(error);
  }
}
