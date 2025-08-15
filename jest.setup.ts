ts
// Fail tests on unhandled promise rejections (keeps things honest)
process.on("unhandledRejection", (err) => {
  throw err;
});

// Useful if logs are noisy during tests
// jest.spyOn(console, "error").mockImplementation(() => {});
// jest.spyOn(console, "warn").mockImplementation(() => {});