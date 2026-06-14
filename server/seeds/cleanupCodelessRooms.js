/**
 * One-time cleanup: delete GD rooms / webinars that have NO invite code.
 *
 * Every room and webinar now gets a unique inviteCode on creation
 * (routes/gdRooms.js + routes/webinars.js). Rooms without one are LEGACY junk
 * created before that logic existed — they can never be joined (join-by-code
 * needs a code) and just clutter the list, so we remove them.
 *
 * The inviteCode field was added to the schema after these rooms existed, so on
 * legacy docs it is usually ABSENT (not ''). In Mongo, { $in: [null, ''] } matches
 * absent + null + empty-string, which is exactly the set we want to delete.
 *
 * Run from server/:  node seeds/cleanupCodelessRooms.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const GDRoom = require('../models/GDRoom');
const MentorshipSession = require('../models/MentorshipSession');

const CODELESS = { inviteCode: { $in: [null, ''] } };

const run = async () => {
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is not set (check server/.env).');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // 1) How many junk rooms, and how many healthy (coded) rooms remain untouched?
    const codeless = await GDRoom.countDocuments(CODELESS);
    const coded = await GDRoom.countDocuments({ inviteCode: { $exists: true, $nin: [null, ''] } });
    console.log(`🔎 Code-less rooms to delete: ${codeless}`);
    console.log(`✅ Coded rooms that stay:     ${coded}`);

    if (codeless === 0) {
        console.log('Nothing to clean up. Done.');
        await mongoose.disconnect();
        return;
    }

    // 2) Safety check: would deleting any code-less WEBINAR orphan a MentorshipSession?
    //    (Expected 0 — code-less predates the webinar→session linking, which always
    //    sets a code in the same path. We only report; we don't touch sessions.)
    const codelessIds = await GDRoom.find(CODELESS).distinct('_id');
    const linkedSessions = await MentorshipSession.countDocuments({ webinar: { $in: codelessIds } });
    if (linkedSessions > 0) {
        console.log(`⚠️  ${linkedSessions} MentorshipSession(s) reference these rooms (their meetingLink will go dead).`);
    } else {
        console.log('✅ No MentorshipSession references these rooms.');
    }

    // 3) Delete.
    const { deletedCount } = await GDRoom.deleteMany(CODELESS);
    console.log(`🗑️  Deleted ${deletedCount} code-less room(s)/webinar(s).`);

    await mongoose.disconnect();
    console.log('Done.');
};

run().catch((err) => {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
});
