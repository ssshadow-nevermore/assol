import {
  AdminApiError,
  assertAdminRequest,
  createResource,
  deleteResource,
  errorResponse,
  getResource,
  hideResource,
  jsonResponse,
  listResource,
  readJsonRecord,
  updateResource,
} from "./admin-api";

function idFromUrl(request: Request): string {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new AdminApiError("Не указан id записи");
  return id;
}

export async function GET(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const resource = getResource(new URL(request.url).searchParams.get("resource"));
    return jsonResponse({ resource, items: await listResource(resource) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const resource = getResource(new URL(request.url).searchParams.get("resource"));
    return jsonResponse({ resource, item: await createResource(resource, await readJsonRecord(request)) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const resource = getResource(new URL(request.url).searchParams.get("resource"));
    return jsonResponse({ resource, item: await updateResource(resource, idFromUrl(request), await readJsonRecord(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const resource = getResource(new URL(request.url).searchParams.get("resource"));
    const url = new URL(request.url);
    if (url.searchParams.get("hard") === "1") {
      await deleteResource(resource, idFromUrl(request));
      return jsonResponse({ resource, deleted: true });
    }
    return jsonResponse({ resource, item: await hideResource(resource, idFromUrl(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
