function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server error';
  if (process.env.NODE_ENV === 'production') {
    console.error(err.message);
  } else {
    console.error(err.stack || err);
  }
  // Do not leak stack traces
  if (status >= 500 && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ message: 'Server error' });
  }
  res.status(status).json({ message });
}

module.exports = errorHandler;
