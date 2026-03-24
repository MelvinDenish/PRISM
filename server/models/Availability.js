const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Weekly recurring slots
    weeklySlots: [{
        day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
        startTime: String,      // "09:00"
        endTime: String,        // "10:00"
        isAvailable: { type: Boolean, default: true }
    }],
    // Specific date slots (for one-off availability)
    availableSlots: [{
        date: Date,
        startTime: String,
        endTime: String,
        isBooked: { type: Boolean, default: false },
        bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    timezone: { type: String, default: 'Asia/Kolkata' }
});

module.exports = mongoose.model('Availability', availabilitySchema);
