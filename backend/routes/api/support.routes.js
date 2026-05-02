const express = require('express');
const router = express.Router();
const supportController = require('../../controllers/support.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

router.use(authenticateToken);

router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getTickets);
router.get('/tickets/:ticketId', supportController.getTicketDetail);
router.post('/tickets/:ticketId/messages', supportController.addMessage);

module.exports = router;
