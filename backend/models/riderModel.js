const db = require('../config/db');
const { hashPassword } = require('../utils/password');

function formatAuthUserName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ')
    || user.full_name
    || user.name
    || 'Authorized Rider';
}

async function findRiderByEmail(email) {
  const [rows] = await db.execute(
    'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

async function findRiderById(riderId) {
  const [rows] = await db.execute(
    'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE rider_id = ?',
    [riderId]
  );
  return rows[0] || null;
}

async function findRiderWithPasswordByEmail(email) {
  const [rows] = await db.execute('SELECT * FROM riders WHERE email = ?', [email]);
  return rows[0] || null;
}

async function ensureLocalRiderFromAuthUser(authUser) {
  if (!authUser) {
    throw new Error('Authentication service did not return user details.');
  }

  const authUserId = Number(authUser.rider_id || authUser.user_id || authUser.id);
  const email = authUser.email || (authUserId ? `rider${authUserId}@auth.local` : `rider-${Date.now()}@auth.local`);

  let rider = email ? await findRiderByEmail(email) : null;

  if (!rider && Number.isInteger(authUserId) && authUserId > 0) {
    rider = await findRiderById(authUserId);
  }

  if (rider) {
    return rider;
  }

  const fullName = formatAuthUserName(authUser);
  const contactNumber = authUser.phoneNumber || authUser.contact_number || 'Not provided';
  const vehicleType = authUser.vehicle_type || 'Motorcycle';
  const plateNumber = authUser.plate_number || 'Not provided';

  if (Number.isInteger(authUserId) && authUserId > 0) {
    try {
      await db.execute(
        `INSERT INTO riders (rider_id, full_name, email, password_hash, contact_number, vehicle_type, plate_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [authUserId, fullName, email, hashPassword(`external-${authUserId}-${email}`), contactNumber, vehicleType, plateNumber]
      );
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
  }

  rider = await findRiderByEmail(email);

  if (!rider) {
    await db.execute(
      `INSERT INTO riders (full_name, email, password_hash, contact_number, vehicle_type, plate_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, hashPassword(`external-${Date.now()}-${email}`), contactNumber, vehicleType, plateNumber]
    );

    rider = await findRiderByEmail(email);
  }

  return rider;
}

module.exports = {
  findRiderByEmail,
  findRiderById,
  findRiderWithPasswordByEmail,
  ensureLocalRiderFromAuthUser
};
