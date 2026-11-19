import { Purchase, Player, User } from '../models/index.js';

export async function getUserPurchases(req, res, next) {
  try {
    const purchases = await Purchase.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Player, as: 'player', attributes: ['name', 'team', 'image_url', 'jersey_image_url'] }],
      order: [['purchase_date', 'DESC']]
    });
    res.json(purchases.map(purchase => {
      const row = purchase.get({ plain: true });
      return {
        ...row,
        player_name: row.player?.name,
        team: row.player?.team,
        player_image: row.player?.image_url,
        jersey_image_url: row.player?.jersey_image_url
      };
    }));
  } catch (error) {
    next(error);
  }
}

export async function getAllPurchases(req, res, next) {
  try {
    const purchases = await Purchase.findAll({
      include: [
        { model: User, as: 'user', attributes: ['username', 'email', 'address', 'city', 'postal_code'] },
        { model: Player, as: 'player', attributes: ['name', 'team'] }
      ],
      order: [['purchase_date', 'DESC']]
    });
    res.json(purchases.map(purchase => {
      const row = purchase.get({ plain: true });
      return {
        ...row,
        username: row.user?.username,
        email: row.user?.email,
        address: row.user?.address,
        city: row.user?.city,
        postal_code: row.user?.postal_code,
        player_name: row.player?.name,
        team: row.player?.team
      };
    }));
  } catch (error) {
    next(error);
  }
}

export async function updatePurchaseStatus(req, res, next) {
  try {
    const [updated] = await Purchase.update({ status: req.body.status }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Nie znaleziono zamówienia' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
