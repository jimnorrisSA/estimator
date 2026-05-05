import { Router } from "express";

export const projectRouter = Router();

// Placeholder routes — implementation follows data layer setup
projectRouter.get("/", (_req, res) => {
  res.json([]);
});

projectRouter.post("/", (req, res) => {
  res.status(201).json({ id: "todo", ...req.body });
});

projectRouter.get("/:id", (req, res) => {
  res.json({ id: req.params.id });
});

projectRouter.put("/:id", (req, res) => {
  res.json({ id: req.params.id, ...req.body });
});

projectRouter.delete("/:id", (req, res) => {
  res.status(204).end();
});
