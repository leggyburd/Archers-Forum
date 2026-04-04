/*
  Mongoose schema and model definition for forum posts, including embedded comments, replies, and reports.
*/

const mongoose = require('mongoose');


// Replies are stored under a comment
const replySchema = new mongoose.Schema({
  authorName:  { type: String, required: true },
  authorEmail: { type: String, required: true },
  body:        { type: String, required: true },
  replyToId:   { type: String, default: null },
  replyToName: { type: String, default: null },
  score:       { type: Number, default: 0 },
  createdAt:   { type: Date,   default: Date.now },
  editedAt:    { type: Date,   default: null },
  isDeleted:   { type: Boolean, default: false }
});

// Reports are stored under a post or comment
const reportSchema = new mongoose.Schema({
  reporterName:  { type: String, required: true },
  reporterEmail: { type: String, required: true },
  reason:        { type: String, required: true },
  details:       { type: String, default: '' },
  createdAt:     { type: Date, default: Date.now },
});

// Comments are stored under a post
const commentSchema = new mongoose.Schema({
  authorName:  { type: String, required: true },
  authorEmail: { type: String, required: true },
  body:        { type: String, required: true },
  score:       { type: Number, default: 0 },
  createdAt:   { type: Date,   default: Date.now },
  editedAt:    { type: Date,   default: null },
  replies:     { type: [replySchema], default: [] },
  reports:     { type: [reportSchema], default: [] },
  isDeleted:   { type: Boolean, default: false }
});

// Document for Archers Forum posts
const postSchema = new mongoose.Schema({
  title:       { type: String,   required: true, trim: true },
  body:        { type: String,   required: true },
  category:    { type: String,   required: true },
  tags:        { type: [String], default: [] },
  authorName:  { type: String,   required: true },
  authorEmail: { type: String,   required: true },
  score:       { type: Number,   default: 0 },
  views:       { type: Number,   default: 0 },
  mediaUrls:   { type: [String], default: [] },
  comments:    { type: [commentSchema], default: [] },
  reports:     { type: [reportSchema], default: [] },
  createdAt:   { type: Date,     default: Date.now },
  isDeleted:   { type: Boolean,  default: false }
});

// Export the Mongoose model for use in other parts of the application
module.exports = mongoose.model('Post', postSchema);
