import React from "react";
import Documentation from "@open-rpc/docs-react";

import schema from "./schema.json";

export function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Minecraft JSON-RPC API Documentation</h1>
      <Documentation schema={schema} />
    </div>
  );
}
