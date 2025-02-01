const express = require('express');
const multer = require('multer');
const path = require('path');
const { processAdvancedOptimization } = require('./advancedOptimizer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/optimize', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = await processAdvancedOptimization(req.file);
    console.log('Optimization Result:', result);
    
    if (result.success) {
      res.render('results', {
        message: result.message,
        mapUrl: `/public/maps/${path.basename(result.mapFile)}`,
        trips: result.trips,
        vehicleInfo: result.vehicleInfo
      });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Error processing optimization' });
  }
});

module.exports = router; 