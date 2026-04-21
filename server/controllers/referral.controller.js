const db = require("../config/database");
const { sendOK, sendError } = require("../middleware/response.helper");

function getReferral(req, res, user) {
  const dbUser = db.prepare("SELECT referral_code, referral_points FROM users WHERE id = ?").get(user.id);
  if (!dbUser) return sendError(res, 404, "Benutzer nicht gefunden");

  const events = db.prepare(`
    SELECT COUNT(*) as total_referrals,
           SUM(points_awarded) as total_points
    FROM referral_events WHERE referrer_id = ?
  `).get(user.id);

  sendOK(res, {
    referralCode: dbUser.referral_code,
    referralPoints: dbUser.referral_points,
    totalReferrals: events.total_referrals || 0,
    totalPointsEarned: events.total_points || 0,
  });
}

module.exports = { getReferral };
