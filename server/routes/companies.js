const express = require('express');
const Company = require('../models/Company');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/companies
router.get('/', async (req, res) => {
    try {
        const companies = await Company.find().sort({ name: 1 });
        res.json({ success: true, companies });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// POST /api/companies
router.post('/', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const company = await Company.create(req.body);
        res.status(201).json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PUT /api/companies/:id
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// DELETE /api/companies/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await Company.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Company deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
