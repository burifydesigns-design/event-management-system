function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  const message = status >= 500 ? 'Server error' : err.message || 'Request failed';
  if (process.env.NODE_ENV === 'production') {
    console.error(err.message);
  } else {
    console.error(err.stack);
  }
  res.status(status).json({ message });
}

module.exports = errorHandler;
