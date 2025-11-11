// Load environment variables from .env file
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { router } = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(router);

const PORT = process.env.PORT ?? 3001;
const reqAny: any = require;

if (reqAny.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

export default app;
