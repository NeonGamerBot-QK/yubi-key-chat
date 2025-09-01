const express = require('express');
const router = express.Router();

// Catch-all route for 404
router.use((req, res) => {
    res.status(404).render('layout', { title: '404 - Page Not Found', view: `404` });
});

module.exports = router;
