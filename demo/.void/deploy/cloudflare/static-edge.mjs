import { createStaticEdgeHandler } from "void/edge";
export default createStaticEdgeHandler({"headerRules":[{"pattern":"/*","headers":[["X-Content-Type-Options","nosniff"],["Referrer-Policy","strict-origin-when-cross-origin"]]}],"versionMetadataBinding":"__VOID_VERSION_METADATA"});
