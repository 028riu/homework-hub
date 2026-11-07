// Public, minimal projection used only by the signed-in leaderboard.
const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function safePhotoURL(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function makePublicProfile(uid, data = {}, serverTimestamp) {
  const currentStreak = Math.max(0, number(data.currentStreak ?? data.streak));
  const longestStreak = Math.max(currentStreak, number(
    data.longestStreak ?? data.highestStreak ?? data.maxStreak
  ));
  const stamp = typeof serverTimestamp === "function"
    ? serverTimestamp()
    : (data.updatedAt || null);

  return {
    displayName: String(data.displayName || data.name || data.username || "Thành viên").trim().slice(0, 80) || "Thành viên",
    photoURL: safePhotoURL(data.photoURL),
    currentStreak,
    longestStreak,
    totalXP: Math.max(0, number(data.totalXP)),
    level: Math.max(1, number(data.level, 1)),
    updatedAt: stamp
  };
}
