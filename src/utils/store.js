// Simple in-memory store for user data
// In production, this should be replaced with a proper database
const users = new Map();

export const upsertUser = async (
  userId,
  accessToken,
  refreshToken,
  expiredAt
) => {
  users.set(userId, {
    accessToken,
    refreshToken,
    expired_at: expiredAt,
  });
  return users.get(userId);
};

export const getUser = async (userId) => {
  const user = users.get(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return user;
};

export const updateUser = async (userId, updates) => {
  const user = users.get(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const updatedUser = { ...user, ...updates };
  users.set(userId, updatedUser);
  return updatedUser;
};

export const deleteUser = async (userId) => {
  return users.delete(userId);
};
