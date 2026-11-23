import { IBaseNodeData } from "./IBaseNode.js";

export default interface INodeRepoTreeItem {
    id: string;
    name: string;
    nodeInfo?: IBaseNodeData;
    children?: INodeRepoTreeItem[];
}