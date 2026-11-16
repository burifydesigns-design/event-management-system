function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  const isClientError = status < 500;
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify({
      requestId: req.requestId,
      status,
      message: err && err.message ? err.message : 'Unknown error',
    }));
  } else {
    console.error(err.stack || err);
  }
  res.status(status).json({
    message: isClientError ? (err.message || 'Request failed') : 'An unexpected server error occurred',
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}

module.exports = errorHandler;
