import express from "express";
import cors from "cors";

export const app = express();

// Permite que o frontend local acesse a API.
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Endpoint inicial para verificar se a API esta no ar.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sistema-de-matriculas-api",
  });
});
