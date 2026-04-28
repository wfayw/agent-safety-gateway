import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

export type ApiErrorResponse = {
  code: string;
  message: string;
  details: unknown;
};

const getStatusCode = (error: FastifyError): number => {
  if (error.validation) {
    return 400;
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 600) {
    return error.statusCode;
  }

  return 500;
};

const getErrorCode = (statusCode: number): string => {
  if (statusCode === 400) {
    return "INVALID_REQUEST";
  }

  if (statusCode === 404) {
    return "NOT_FOUND";
  }

  return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED";
};

const getErrorMessage = (error: FastifyError, statusCode: number): string => {
  if (statusCode === 400) {
    return "Invalid request";
  }

  if (statusCode >= 500) {
    return "Internal server error";
  }

  return error.message;
};

const getErrorDetails = (error: FastifyError): unknown => {
  if (error.validation) {
    return {
      validation: error.validation,
      validationContext: error.validationContext,
    };
  }

  return null;
};

export const sendErrorResponse = (
  reply: FastifyReply,
  statusCode: number,
  response: ApiErrorResponse,
) => {
  return reply.status(statusCode).send(response);
};

export const registerErrorHandlers = (server: FastifyInstance) => {
  server.setErrorHandler((error, _request, reply) => {
    const fastifyError = error as FastifyError;
    const statusCode = getStatusCode(fastifyError);

    return sendErrorResponse(reply, statusCode, {
      code: getErrorCode(statusCode),
      message: getErrorMessage(fastifyError, statusCode),
      details: getErrorDetails(fastifyError),
    });
  });

  server.setNotFoundHandler((request, reply) => {
    return sendErrorResponse(reply, 404, {
      code: "NOT_FOUND",
      message: "Route not found",
      details: {
        method: request.method,
        url: request.url,
      },
    });
  });
};
