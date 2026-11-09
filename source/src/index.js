import express from 'express'
import { env } from './config/env';
const app = express();
const PORT = env.PORT;

// Base route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
