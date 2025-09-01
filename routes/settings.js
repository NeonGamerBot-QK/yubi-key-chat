const express = require('express');
const router = express.Router();

router.get('/settings', (req, res) => {
    res.render('layout', { title: 'Settings', view: `settings` });
});

module.exports = router;
