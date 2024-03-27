export const ApiResponse = {
  // Generic success response
  success: (data: any, message: string = 'Success') => ({
    success: true,
    message,
    data,
  }),

  // Generic error response
  error: (message: string, errorCode: number = 400) => ({
    success: false,
    errorCode,
    message,
  }),

  // Validation errors (e.g., from request body validation)
  validationError: (errors: any[]) => ({
    success: false,
    errorCode: 422,
    message: 'Validation errors',
    errors,
  }),

  // Not found errors (e.g., specific resource does not exist)
  notFound: (message: string = 'Resource not found') => ({
    success: false,
    errorCode: 404,
    message,
  }),

  // Unauthorized access
  unauthorized: (message: string = 'Unauthorized') => ({
    success: false,
    errorCode: 401,
    message,
  }),

  // Forbidden access
  forbidden: (message: string = 'Forbidden') => ({
    success: false,
    errorCode: 403,
    message,
  }),

  // Handling paginated responses
  paginatedSuccess: (data: any[], pageNumber: number, pageSize: number, totalRecords: number, message: string = 'Success') => {
    const totalPages = Math.ceil(totalRecords / pageSize);
    return {
      success: true,
      message,
      data,
      pagination: {
        pageNumber,
        pageSize,
        totalPages,
        totalRecords,
      },
    };
  },
};
