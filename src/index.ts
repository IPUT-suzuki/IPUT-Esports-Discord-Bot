import process from "node:process";

const startedAt = new Date().toISOString();

console.log(
  `IPUT Esports Discord Bot development environment is ready on Node ${process.version}. Started at ${startedAt}`,
);
