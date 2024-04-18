import { Router } from 'express';
import { ftgTemplate, ftgText, ftgImage } from '../controllers/ftgController';

const router = Router();

router.post('/template', ftgTemplate);
router.post('/text', ftgText);
router.post('/image', ftgImage);

export default router;