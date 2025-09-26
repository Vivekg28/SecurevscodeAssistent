// package.json snippet to test vulnerable library detection
const packageJson = `
{
  "name": "example-project",
  "version": "1.0.0",
  "dependencies": {
    "express": "1.0.0",
    "lodash": "4.17.21"
  }
}
`;

// Example usage - this file shows outdated express version detected
console.log("This project uses vulnerable express version 1.0.0 - please upgrade.");
