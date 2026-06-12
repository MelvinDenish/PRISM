/**
 * Artifact — persists generated downloadable files produced by the PRISM Copilot.
 *
 * Storage fields mirror the User avatar pattern (avatarKey / avatarDriver):
 *   artifactKey     the storage key passed to utils/storage.deleteFile
 *   artifactDriver  'local' | 's3' — which backend holds the file
 *
 * The download URL is derived from the document _id at request time
 * (/api/artifacts/:id/download) rather than stored, to avoid stale links.
 */

const mongoose = require('mongoose');

const artifactSchema = new mongoose.Schema(
  {
    user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversation:   { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    kind:           { type: String, enum: ['resume', 'cover_letter', 'document'], required: true },
    title:          { type: String, required: true },
    format:         { type: String, enum: ['docx', 'pdf', 'md'], required: true },
    artifactKey:    { type: String, required: true },
    artifactDriver: { type: String, enum: ['local', 's3'], required: true },
    sizeBytes:      { type: Number, default: 0 },
    createdAt:      { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Newest artifacts for a user first.
artifactSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Artifact', artifactSchema);
