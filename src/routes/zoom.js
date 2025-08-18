import express from "express";
import * as zoomController from "../controllers/zoom.js";
import {
  getUser,
  refreshToken,
  setZoomAuthHeader,
} from "../middleware/zoom.js";

const router = express.Router();

router.use(
  "/api",
  getUser,
  refreshToken,
  setZoomAuthHeader,
  zoomController.proxy
);

export default router;
