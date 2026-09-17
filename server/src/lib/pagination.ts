export function pagination(
  input: { page?: unknown; limit?: unknown },
  defaultLimit = 20,
  maxLimit = 100,
) {
  const page = Math.max(1, Math.floor(Number(input.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(input.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pagedResult<T>(items: T[], total: number, page: number, limit: number) {
  return { total, page, limit, items };
}