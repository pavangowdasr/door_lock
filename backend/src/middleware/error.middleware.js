/**
 * Centralized 404 Not Found handler for undefined routes.
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Centralized Express error-handling middleware.
 */
export function errorHandler(err, req, res, next) {
  // If headers have already been sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(409).json({
      success: false,
      message: `Duplicate registration: Card with ${field} '${value}' already exists.`,
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: `Validation error: ${messages.join('; ')}`,
    });
  }

  // Handle Mongoose cast errors (e.g. invalid type)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for parameter '${err.path}'.`,
    });
  }

  // Handle MongoDB connection/network errors
  if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
    console.error(`[Database Error] ${err.message}`);
    return res.status(503).json({
      success: false,
      message: 'Database service is currently unavailable. Please try again later.',
    });
  }

  // Handle custom application errors with an explicit statusCode
  const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
  const message = err.message || 'Internal server error';

  if (statusCode === 500) {
    console.error(`[Server Error] ${err.stack || err}`);
  }

  const response = {
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message,
  };

  // Never expose stack trace in production
  if (process.env.NODE_ENV !== 'production' && statusCode === 500 && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}
