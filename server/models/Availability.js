const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    availableSlots: [{
        date: Date,
        startTime: String,
        endTime: String,
        isBooked: { type: Boolean, default: false }
    }]
});

module.exports = mongoose.model('Availability', availabilitySchema);
