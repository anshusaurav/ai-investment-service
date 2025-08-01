const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// URL ingestion endpoint
router.post('/ingest-urls', (req, res) => documentController.ingestUrls(req, res));

// List uploaded documents
router.get('/documents', (req, res) => documentController.listDocuments(req, res));

// Chat endpoint
router.post('/sendMessage', (req, res) => documentController.chat(req, res));

// Transform prompt
router.post('/transform', (req, res) => documentController.transformPrompt(req, res));

// Transform and chat endpoint (combines transform + response generation)
router.post('/transformAndChat', (req, res) => documentController.transformAndChat(req, res));

// Service status (for debugging)
router.get('/status', (req, res) => documentController.getStatus(req, res));

module.exports = router;