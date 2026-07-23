type ErrorResponseRef = { description: string; $ref: "ErrorResponse#" };

const error = (description: string): ErrorResponseRef => ({
  description,
  $ref: "ErrorResponse#"
});

export const apiErrors = {
  validation: error("Dados inválidos ou campos obrigatórios ausentes"),
  unauthorized: error("Token JWT ausente, expirado ou inválido"),
  notFound: error("Recurso não encontrado"),
  conflict: error("Conflito — duplicidade ou transição de estado inválida"),
  internal: error("Erro interno do servidor")
};

export function publicResponses<T extends Record<number, unknown>>(success: T) {
  return {
    ...success,
    400: apiErrors.validation,
    500: apiErrors.internal
  };
}

export function authResponses<T extends Record<number, unknown>>(success: T) {
  return {
    ...success,
    400: apiErrors.validation,
    401: apiErrors.unauthorized,
    500: apiErrors.internal
  };
}
