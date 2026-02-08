export interface WebflowNode {
  _id: string;
  type?: string;
  tag?: string;
  classes?: string[];
  children?: string[];
  data?: any;
  text?: boolean;
  v?: string;
}

export interface WebflowStyle {
  _id: string;
  fake: boolean;
  type: string;
  name: string;
  namespace: string;
  comb: string;
  styleLess: string;
  variants: Record<string, { styleLess: string }>;
  children: string[];
  createdBy: string;
  origin: null;
  selector: null;
}

export interface WebflowPayload {
  nodes: WebflowNode[];
  styles: WebflowStyle[];
  assets: any[];
  ix1: any[];
  ix2: {
    interactions: any[];
    events: any[];
    actionLists: any[];
  };
}

export interface WebflowClipboardData {
  type: "@webflow/XscpData";
  payload: WebflowPayload;
  meta: {
    droppedLinks: number;
    dynBindRemovedCount: number;
    dynListBindRemovedCount: number;
    paginationRemovedCount: number;
    universalBindingsRemovedCount: number;
    unlinkedSymbolCount: number;
    codeComponentsRemovedCount: number;
  };
}
