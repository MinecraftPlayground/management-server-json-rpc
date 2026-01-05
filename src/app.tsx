import React from "react";
import Documentation from "@open-rpc/docs-react";

import schema from "./schema.json";

export function App() {
  return <Documentation schema={schema} />;
}
