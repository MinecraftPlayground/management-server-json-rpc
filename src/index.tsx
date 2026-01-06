import {Documentation} from "@open-rpc/docs-react";
import ReactDOM from 'react-dom';
import './index.css';

import schema from './schema.json' with {type: "json"}

ReactDOM.render(
  <div className="app">
    <Documentation schema={schema}/>
  </div>,
  document.body
);
