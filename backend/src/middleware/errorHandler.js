function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Server error';
  if (process.env.NODE_ENV === 'production') {
    console.error(err.message);
  } else {
    console.error(err.stack);
  }
  res.status(status).json({ message });
}

module.exports = errorHandler;
