import { Router } from 'express';
import {
  registerCard,
  listCards,
  getCardByUID,
  updateCardStatus,
} from '../controllers/card.controller.js';
import { requireAdminApiKey } from '../middleware/auth.middleware.js';

const router = Router();

// All card routes require ADMIN_API_KEY
router.use(requireAdminApiKey);

router.post('/', registerCard);
router.get('/', listCards);
router.get('/:uid', getCardByUID);
router.patch('/:uid/status', updateCardStatus);

export default router;
