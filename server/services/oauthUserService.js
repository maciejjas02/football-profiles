import { User } from '../models/index.js';

export async function upsertOAuthUser(provider, profile) {
  const providerId = String(profile.id);
  const email = profile.emails?.find(({ value }) => value)?.value?.toLowerCase()
    || `${provider}.${providerId}@oauth.local`;
  const name = profile.displayName?.trim() || profile.username || email.split('@')[0];
  const avatarUrl = profile.photos?.[0]?.value || profile._json?.avatar_url || null;

  let user = await User.findOne({ where: { provider, provider_id: providerId } });
  if (!user) user = await User.findOne({ where: { email } });

  if (user) {
    await user.update({ provider, provider_id: providerId, name, avatar_url: avatarUrl });
    return user.get({ plain: true });
  }

  const baseUsername = profile.username || email.split('@')[0];
  let username = baseUsername;
  let suffix = 1;
  while (await User.findOne({ where: { username } })) {
    username = `${baseUsername}_${suffix++}`;
  }

  user = await User.create({
    email,
    username,
    name,
    avatar_url: avatarUrl,
    provider,
    provider_id: providerId,
    role: 'user'
  });
  return user.get({ plain: true });
}
