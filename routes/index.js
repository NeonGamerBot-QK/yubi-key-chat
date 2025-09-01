const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('layout', { title: 'Home', view: `home` });
});

module.exports = router;
