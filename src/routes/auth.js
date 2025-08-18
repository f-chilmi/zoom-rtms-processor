import express from "express";
import * as authController from "../controllers/auth.js";

const router = express.Router();

router
  .use("/proxy", authController.proxy)
  .use("/sockjs-node", authController.proxy)
  .get("/install", authController.install)
  .get("/auth", authController.auth)
  .get("/home", authController.home)
  .get("/authorize", authController.inClientAuthorize)
  .post("/onauthorized", authController.inClientOnAuthorized);

export default router;
