import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coopworkRouter from "./coopwork";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coopworkRouter);

export default router;
