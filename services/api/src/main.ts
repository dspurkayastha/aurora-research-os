import express from "express";
import cors from "cors";
import { router } from "./routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(router);

const PORT = process.env.PORT ?? 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

export default app;
