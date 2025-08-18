import express from "express";
import * as authController from "../controllers/auth.js";
import * as staticController from "../controllers/static.js";
import { addSecurityHeaders } from "../middleware/security.js";

const router = express.Router();

router
  .get("/install", authController.install)
  .get("/auth", authController.auth)
  .get("/authorize", authController.inClientAuthorize)
  .post("/onauthorized", authController.inClientOnAuthorized)
  .get("/home", addSecurityHeaders, authController.home)
  // .use("/proxy", addSecurityHeaders, authController.proxy)
  .use("/proxy", staticController.serveZoomApp)
  .use("/sockjs-node", addSecurityHeaders, authController.proxy);

export default router;
