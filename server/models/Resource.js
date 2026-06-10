const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    resourceType: { type: String, enum: ['video', 'article', 'pdf', 'link', 'ppt', 'doc', 'image', 'file'] },
    link: String,
    // Uploaded-file fields (populated when a mentor uploads instead of linking).
    fileUrl: String,                 // public URL to the stored file
    fileKey: String,                 // storage key (for deletion)
    fileName: String,                // original filename (display/download)
    fileSize: Number,                // bytes
    mimeType: String,                // e.g. application/pdf
    storageDriver: String,           // 'local' | 's3' (which backend holds it)
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyTag: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    createdAt: { type: Date, default: Date.now }
});

// Indexes (plan §3): resources are filtered by topic/level/type and sorted newest-first.
resourceSchema.index({ topic: 1, level: 1 });
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Resource', resourceSchema);
