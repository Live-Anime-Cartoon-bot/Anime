import { Router, type IRouter } from "express";
import healthRouter from "./health";
import streamsRouter from "./streams";

const router: IRouter = Router();

router.use(healthRouter);
router.use(streamsRouter);

export default router;
